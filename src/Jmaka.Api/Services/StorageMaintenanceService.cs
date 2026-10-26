using Jmaka.Api.Storage;

namespace Jmaka.Api.Services;

internal sealed class StorageMaintenanceService : BackgroundService
{
    private readonly ILogger<StorageMaintenanceService> _logger;
    private readonly AtomicJsonFileStore<List<VideoHistoryItem>> _videoHistory;
    private readonly string _videoDir;
    private readonly string _videoOutDir;
    private readonly string _editsPreviewDir;
    private readonly TimeSpan _retention;

    public StorageMaintenanceService(
        ILogger<StorageMaintenanceService> logger,
        ILoggerFactory loggerFactory,
        IWebHostEnvironment environment)
    {
        _logger = logger;
        var root = Environment.GetEnvironmentVariable("JMAKA_STORAGE_ROOT");
        if (string.IsNullOrWhiteSpace(root)) root = environment.ContentRootPath;
        var hours = int.TryParse(Environment.GetEnvironmentVariable("JMAKA_RETENTION_HOURS"), out var parsed) && parsed > 0 ? parsed : 48;
        _retention = TimeSpan.FromHours(hours);
        _videoDir = Path.Combine(root, "video");
        _videoOutDir = Path.Combine(root, "video-out");
        _editsPreviewDir = Path.Combine(root, "edits-preview");
        _videoHistory = new AtomicJsonFileStore<List<VideoHistoryItem>>(
            Path.Combine(root, "data", "video-history.json"),
            static () => [],
            loggerFactory.CreateLogger<AtomicJsonFileStore<List<VideoHistoryItem>>>());
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _videoHistory.InitializeAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        do
        {
            try { await RunMaintenanceAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception) { _logger.LogError(exception, "Storage retention pass failed"); }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    internal async Task RunMaintenanceAsync(CancellationToken ct)
    {
        var cutoff = DateTimeOffset.UtcNow - _retention;
        List<VideoHistoryItem> removed = [];
        var retained = await _videoHistory.UpdateAsync(items =>
        {
            removed = items.Where(x => x.CreatedAt < cutoff).ToList();
            return items.Where(x => x.CreatedAt >= cutoff).ToList();
        }, ct);
        foreach (var item in removed)
        {
            var safeName = Path.GetFileName(item.StoredName);
            if (string.IsNullOrWhiteSpace(safeName)) continue;
            TryDelete(Path.Combine(string.Equals(item.Kind, "processed", StringComparison.OrdinalIgnoreCase) ? _videoOutDir : _videoDir, safeName));
        }

        var referencedVideo = new HashSet<string>(
            retained.Where(x => !string.Equals(x.Kind, "processed", StringComparison.OrdinalIgnoreCase)).Select(x => Path.GetFileName(x.StoredName)),
            StringComparer.OrdinalIgnoreCase);
        var referencedOutput = new HashSet<string>(
            retained.Where(x => string.Equals(x.Kind, "processed", StringComparison.OrdinalIgnoreCase)).Select(x => Path.GetFileName(x.StoredName)),
            StringComparer.OrdinalIgnoreCase);
        DeleteOldFiles(_videoDir, cutoff, path => Path.GetFileName(path).Contains(".upload", StringComparison.OrdinalIgnoreCase) || !referencedVideo.Contains(Path.GetFileName(path)));
        DeleteOldFiles(_videoOutDir, cutoff, path => IsTemporary(path) || (Path.GetExtension(path).Equals(".mp4", StringComparison.OrdinalIgnoreCase) && !referencedOutput.Contains(Path.GetFileName(path))));
        DeleteOldFiles(_editsPreviewDir, cutoff, _ => true);
    }

    private void DeleteOldFiles(string directory, DateTimeOffset cutoff, Func<string, bool> predicate)
    {
        if (!Directory.Exists(directory)) return;
        foreach (var path in Directory.EnumerateFiles(directory, "*", SearchOption.TopDirectoryOnly))
        {
            try
            {
                if (predicate(path) && File.GetLastWriteTimeUtc(path) < cutoff.UtcDateTime) TryDelete(path);
            }
            catch (Exception exception) { _logger.LogWarning(exception, "Failed to inspect retention candidate {Path}", path); }
        }
    }

    private static bool IsTemporary(string path)
    {
        var name = Path.GetFileName(path);
        return name.Contains(".tmp", StringComparison.OrdinalIgnoreCase)
            || name.Contains("passlog", StringComparison.OrdinalIgnoreCase)
            || name.EndsWith(".part", StringComparison.OrdinalIgnoreCase);
    }

    private void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (Exception exception) { _logger.LogWarning(exception, "Failed to delete expired file {Path}", path); }
    }
}
