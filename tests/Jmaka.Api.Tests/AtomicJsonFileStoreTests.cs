using System.Text.Json;
using Jmaka.Api.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jmaka.Api.Tests;

public sealed class AtomicJsonFileStoreTests : IDisposable
{
    private readonly string _testDirectory = Path.Combine(
        Path.GetTempPath(),
        $"jmaka-atomic-json-store-{Guid.NewGuid():N}");

    [Fact]
    public async Task ReadAsync_RequiresExplicitInitialization()
    {
        var store = CreateStore<List<int>>("items.json", static () => []);

        var exception = await Assert.ThrowsAsync<FileNotFoundException>(() => store.ReadAsync());

        Assert.Equal(store.FilePath, exception.FileName);

        await store.InitializeAsync();

        Assert.Empty(await store.ReadAsync());
    }

    [Fact]
    public async Task ConcurrentUpdates_AcrossStoreInstances_DoNotLoseListItems()
    {
        const int updateCount = 120;
        var first = CreateStore<List<int>>("items.json", static () => []);
        var second = CreateStore<List<int>>("items.json", static () => []);
        await first.InitializeAsync();

        var updates = Enumerable.Range(0, updateCount)
            .Select((value, index) => (index & 1) == 0
                ? first.UpdateAsync(items => Add(items, value))
                : second.UpdateAsync(items => Add(items, value)));

        await Task.WhenAll(updates);

        var persisted = await first.ReadAsync();
        Assert.Equal(updateCount, persisted.Count);
        Assert.Equal(Enumerable.Range(0, updateCount), persisted.OrderBy(static value => value));
        Assert.Empty(Directory.EnumerateFiles(_testDirectory, "*.tmp"));
    }

    [Fact]
    public async Task Dictionary_RoundTrips_AndPreviousValidDocumentIsBackedUp()
    {
        var store = CreateStore<Dictionary<string, int>>(
            "lookup.json",
            static () => new Dictionary<string, int>(StringComparer.Ordinal));
        await store.InitializeAsync();

        await store.WriteAsync(new Dictionary<string, int> { ["first"] = 1 });
        await store.UpdateAsync(values =>
        {
            values["second"] = 2;
            return values;
        });

        var persisted = await store.ReadAsync();
        Assert.Equal(2, persisted.Count);
        Assert.Equal(1, persisted["first"]);
        Assert.Equal(2, persisted["second"]);

        var backupJson = await File.ReadAllTextAsync(store.BackupPath);
        var backup = JsonSerializer.Deserialize<Dictionary<string, int>>(backupJson);
        Assert.NotNull(backup);
        Assert.Single(backup);
        Assert.Equal(1, backup["first"]);
    }

    [Fact]
    public async Task CorruptDocument_IsQuarantined_Throws_AndPreservesBackup()
    {
        var defaultFactoryCalls = 0;
        var store = CreateStore<Dictionary<string, int>>(
            "state.json",
            () =>
            {
                defaultFactoryCalls++;
                return [];
            });
        await store.InitializeAsync();
        await store.WriteAsync(new Dictionary<string, int> { ["last-valid"] = 7 });
        await store.WriteAsync(new Dictionary<string, int> { ["newest"] = 8 });
        var expectedBackup = await File.ReadAllTextAsync(store.BackupPath);

        await File.WriteAllTextAsync(store.FilePath, "{ definitely-not-json ");

        var exception = await Assert.ThrowsAsync<JsonFileStoreCorruptionException>(() => store.ReadAsync());

        Assert.Equal(store.FilePath, exception.StorePath);
        Assert.NotNull(exception.QuarantinePath);
        Assert.True(File.Exists(exception.QuarantinePath));
        Assert.False(File.Exists(store.FilePath));
        Assert.Equal(store.BackupPath, exception.BackupPath);
        Assert.Equal(expectedBackup, await File.ReadAllTextAsync(store.BackupPath));
        Assert.Contains("definitely-not-json", await File.ReadAllTextAsync(exception.QuarantinePath!));
        Assert.Equal(1, defaultFactoryCalls);

        await Assert.ThrowsAsync<FileNotFoundException>(() => store.ReadAsync());
    }

    [Fact]
    public async Task InitializeAsync_DoesNotReplaceExistingCorruptDocumentWithDefault()
    {
        Directory.CreateDirectory(_testDirectory);
        var filePath = Path.Combine(_testDirectory, "existing-corrupt.json");
        await File.WriteAllTextAsync(filePath, "[ broken");
        var defaultFactoryCalls = 0;
        var store = CreateStore<List<int>>(
            "existing-corrupt.json",
            () =>
            {
                defaultFactoryCalls++;
                return [];
            });

        var exception = await Assert.ThrowsAsync<JsonFileStoreCorruptionException>(
            () => store.InitializeAsync());

        Assert.Equal(0, defaultFactoryCalls);
        Assert.False(File.Exists(filePath));
        Assert.NotNull(exception.QuarantinePath);
        Assert.True(File.Exists(exception.QuarantinePath));
    }

    [Fact]
    public async Task CanceledAsyncUpdate_DoesNotReplaceDocumentOrLeaveTempFile()
    {
        var store = CreateStore<List<int>>("cancel.json", static () => []);
        await store.InitializeAsync();
        await store.WriteAsync([10]);
        using var cancellation = new CancellationTokenSource();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => store.UpdateAsync(
                async (items, token) =>
                {
                    items.Add(20);
                    cancellation.Cancel();
                    await Task.Yield();
                    token.ThrowIfCancellationRequested();
                    return items;
                },
                cancellation.Token));

        Assert.Equal([10], await store.ReadAsync());
        Assert.Empty(Directory.EnumerateFiles(_testDirectory, "*.tmp"));
    }

    public void Dispose()
    {
        if (Directory.Exists(_testDirectory))
        {
            Directory.Delete(_testDirectory, recursive: true);
        }
    }

    private AtomicJsonFileStore<T> CreateStore<T>(string fileName, Func<T> defaultFactory) where T : notnull
    {
        Directory.CreateDirectory(_testDirectory);
        return new AtomicJsonFileStore<T>(
            Path.Combine(_testDirectory, fileName),
            defaultFactory,
            NullLogger<AtomicJsonFileStore<T>>.Instance);
    }

    private static List<int> Add(List<int> items, int value)
    {
        items.Add(value);
        return items;
    }
}
