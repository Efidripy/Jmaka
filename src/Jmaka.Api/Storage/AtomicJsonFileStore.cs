using System.Collections.Concurrent;
using System.Text.Json;

namespace Jmaka.Api.Storage;

/// <summary>
/// Persists one JSON document with process-wide serialization of operations for the same path.
/// Call <see cref="InitializeAsync"/> explicitly before reading or changing the document.
/// </summary>
public sealed class AtomicJsonFileStore<T> where T : notnull
{
    private readonly string _filePath;
    private readonly string _backupPath;
    private readonly Func<T> _defaultFactory;
    private readonly ILogger<AtomicJsonFileStore<T>> _logger;
    private readonly JsonSerializerOptions _serializerOptions;
    private readonly SemaphoreSlim _gate;

    public AtomicJsonFileStore(
        string filePath,
        Func<T> defaultFactory,
        ILogger<AtomicJsonFileStore<T>> logger,
        JsonSerializerOptions? serializerOptions = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(filePath);
        ArgumentNullException.ThrowIfNull(defaultFactory);
        ArgumentNullException.ThrowIfNull(logger);

        _filePath = Path.GetFullPath(filePath);
        _backupPath = $"{_filePath}.bak";
        _defaultFactory = defaultFactory;
        _logger = logger;
        _serializerOptions = serializerOptions ?? new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        };
        _gate = AtomicJsonPathLockRegistry.Get(_filePath);
    }

    public string FilePath => _filePath;

    public string BackupPath => _backupPath;

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (File.Exists(_filePath))
            {
                _ = await ReadUnderLockAsync(cancellationToken);
                _logger.LogDebug("JSON store already initialized at {StorePath}", _filePath);
                return;
            }

            var initialValue = _defaultFactory()
                ?? throw new InvalidOperationException($"The default factory for '{_filePath}' returned null.");

            Directory.CreateDirectory(GetDirectoryPath());
            await WriteAtomicUnderLockAsync(initialValue, destinationExists: false, cancellationToken);
            _logger.LogInformation("Initialized JSON store at {StorePath}", _filePath);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<T> ReadAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            EnsureInitialized();
            return await ReadUnderLockAsync(cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task WriteAsync(T value, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(value);

        await _gate.WaitAsync(cancellationToken);
        try
        {
            EnsureInitialized();
            _ = await ReadUnderLockAsync(cancellationToken);
            await WriteAtomicUnderLockAsync(value, destinationExists: true, cancellationToken);
            _logger.LogInformation("Replaced JSON document at {StorePath}; backup is {BackupPath}", _filePath, _backupPath);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<T> UpdateAsync(Func<T, T> update, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(update);

        return await UpdateAsync(
            (current, _) => ValueTask.FromResult(update(current)),
            cancellationToken);
    }

    public async Task<T> UpdateAsync(
        Func<T, CancellationToken, ValueTask<T>> update,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(update);

        await _gate.WaitAsync(cancellationToken);
        try
        {
            EnsureInitialized();
            var current = await ReadUnderLockAsync(cancellationToken);
            var updated = await update(current, cancellationToken)
                ?? throw new InvalidOperationException($"The update callback for '{_filePath}' returned null.");

            cancellationToken.ThrowIfCancellationRequested();
            await WriteAtomicUnderLockAsync(updated, destinationExists: true, cancellationToken);
            _logger.LogInformation("Updated JSON document at {StorePath}; backup is {BackupPath}", _filePath, _backupPath);
            return updated;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<T> ReadUnderLockAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = new FileStream(
                _filePath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 16 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan);

            var value = await JsonSerializer.DeserializeAsync<T>(stream, _serializerOptions, cancellationToken);
            if (value is null)
            {
                throw new JsonException("The JSON root value is null.");
            }

            return value;
        }
        catch (JsonException exception)
        {
            var quarantinePath = QuarantineCorruptFile();
            _logger.LogError(
                exception,
                "JSON store corruption detected at {StorePath}; quarantined as {QuarantinePath}; backup remains at {BackupPath}",
                _filePath,
                quarantinePath,
                _backupPath);

            throw new JsonFileStoreCorruptionException(
                _filePath,
                quarantinePath,
                File.Exists(_backupPath) ? _backupPath : null,
                exception);
        }
    }

    private async Task WriteAtomicUnderLockAsync(
        T value,
        bool destinationExists,
        CancellationToken cancellationToken)
    {
        var directoryPath = GetDirectoryPath();
        Directory.CreateDirectory(directoryPath);

        var tempPath = Path.Combine(
            directoryPath,
            $".{Path.GetFileName(_filePath)}.{Guid.NewGuid():N}.tmp");

        try
        {
            await using (var stream = new FileStream(
                tempPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 16 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await JsonSerializer.SerializeAsync(stream, value, _serializerOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }

            cancellationToken.ThrowIfCancellationRequested();

            if (destinationExists)
            {
                File.Replace(tempPath, _filePath, _backupPath, ignoreMetadataErrors: true);
            }
            else
            {
                File.Move(tempPath, _filePath);
            }
        }
        finally
        {
            TryDeleteTempFile(tempPath);
        }
    }

    private string? QuarantineCorruptFile()
    {
        var quarantinePath = Path.Combine(
            GetDirectoryPath(),
            $"{Path.GetFileName(_filePath)}.corrupt-{DateTimeOffset.UtcNow:yyyyMMddTHHmmssfffffffZ}-{Guid.NewGuid():N}");

        try
        {
            File.Move(_filePath, quarantinePath);
            return quarantinePath;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            _logger.LogError(
                exception,
                "Failed to quarantine corrupt JSON store {StorePath} as {QuarantinePath}",
                _filePath,
                quarantinePath);
            return null;
        }
    }

    private void EnsureInitialized()
    {
        if (!File.Exists(_filePath))
        {
            throw new FileNotFoundException(
                $"JSON store '{_filePath}' is not initialized. Call InitializeAsync before using it.",
                _filePath);
        }
    }

    private string GetDirectoryPath() =>
        Path.GetDirectoryName(_filePath)
        ?? throw new InvalidOperationException($"Cannot determine the directory for '{_filePath}'.");

    private void TryDeleteTempFile(string tempPath)
    {
        try
        {
            File.Delete(tempPath);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(exception, "Failed to remove JSON store temp file {TempPath}", tempPath);
        }
    }
}

internal static class AtomicJsonPathLockRegistry
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> PathLocks = new(
        OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal);

    public static SemaphoreSlim Get(string fullPath) =>
        PathLocks.GetOrAdd(fullPath, static _ => new SemaphoreSlim(1, 1));
}

public sealed class JsonFileStoreCorruptionException : IOException
{
    public JsonFileStoreCorruptionException(
        string storePath,
        string? quarantinePath,
        string? backupPath,
        Exception innerException)
        : base($"JSON store '{storePath}' is corrupt.", innerException)
    {
        StorePath = storePath;
        QuarantinePath = quarantinePath;
        BackupPath = backupPath;
    }

    public string StorePath { get; }

    public string? QuarantinePath { get; }

    public string? BackupPath { get; }
}
