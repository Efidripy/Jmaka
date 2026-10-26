using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using Jmaka.Api.Storage;

namespace Jmaka.Api.Services;

internal enum UploadNormalizeJobStatus { QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELED }

internal sealed class UploadNormalizeJobState
{
    public Guid JobId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset UpdatedAtUtc { get; set; }
    public DateTimeOffset TtlAtUtc { get; set; }
    public string OriginalName { get; set; } = string.Empty;
    public string UploadTempPath { get; set; } = string.Empty;
    public string StoredName { get; set; } = string.Empty;
    public string OutputPath { get; set; } = string.Empty;
    public double DurationSeconds { get; set; }
    public UploadNormalizeJobStatus Status { get; set; }
    public int ProgressPercent { get; set; }
    public string? Error { get; set; }
    public string? RelativePath { get; set; }
    public long? Size { get; set; }
}

internal interface IUploadNormalizeQueue
{
    UploadNormalizeJobState? Enqueue(string originalName, string uploadTempPath, string storedName, string outputPath, double durationSeconds);
    UploadNormalizeJobState? Get(Guid jobId);
    bool Cancel(Guid jobId);
}

internal sealed class UploadNormalizeQueueService : BackgroundService, IUploadNormalizeQueue
{
    private const int QueueCapacity = 8;
    private const int MaxErrorChars = 32 * 1024;
    private readonly ILogger<UploadNormalizeQueueService> _logger;
    private readonly Channel<Guid> _queue = Channel.CreateBounded<Guid>(new BoundedChannelOptions(QueueCapacity)
    {
        FullMode = BoundedChannelFullMode.DropWrite,
        SingleReader = true,
        SingleWriter = false
    });
    private readonly ConcurrentDictionary<Guid, UploadNormalizeJobState> _jobs = new();
    private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _running = new();
    private readonly AtomicJsonFileStore<List<UploadNormalizeJobState>> _jobStore;
    private readonly AtomicJsonFileStore<List<VideoHistoryItem>> _historyStore;
    private readonly object _admissionGate = new();

    public UploadNormalizeQueueService(
        ILogger<UploadNormalizeQueueService> logger,
        ILoggerFactory loggerFactory,
        IWebHostEnvironment environment)
    {
        _logger = logger;
        var storageRoot = Environment.GetEnvironmentVariable("JMAKA_STORAGE_ROOT");
        if (string.IsNullOrWhiteSpace(storageRoot)) storageRoot = environment.ContentRootPath;
        var dataDir = Path.Combine(storageRoot, "data");
        Directory.CreateDirectory(dataDir);
        _jobStore = new AtomicJsonFileStore<List<UploadNormalizeJobState>>(
            Path.Combine(dataDir, "upload-normalize-jobs.json"),
            static () => [],
            loggerFactory.CreateLogger<AtomicJsonFileStore<List<UploadNormalizeJobState>>>());
        _historyStore = new AtomicJsonFileStore<List<VideoHistoryItem>>(
            Path.Combine(dataDir, "video-history.json"),
            static () => [],
            loggerFactory.CreateLogger<AtomicJsonFileStore<List<VideoHistoryItem>>>());
    }

    public UploadNormalizeJobState? Enqueue(
        string originalName,
        string uploadTempPath,
        string storedName,
        string outputPath,
        double durationSeconds)
    {
        lock (_admissionGate)
        {
            var activeCount = _jobs.Values.Count(x => x.Status is UploadNormalizeJobStatus.QUEUED or UploadNormalizeJobStatus.RUNNING);
            if (activeCount >= QueueCapacity) return null;
            var now = DateTimeOffset.UtcNow;
            var job = new UploadNormalizeJobState
            {
                JobId = Guid.NewGuid(),
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
                TtlAtUtc = now.AddHours(6),
                OriginalName = originalName,
                UploadTempPath = uploadTempPath,
                StoredName = storedName,
                OutputPath = outputPath,
                DurationSeconds = durationSeconds,
                Status = UploadNormalizeJobStatus.QUEUED
            };
            if (!_queue.Writer.TryWrite(job.JobId)) return null;
            _jobs[job.JobId] = job;
            PersistJobs();
            return job;
        }
    }

    public UploadNormalizeJobState? Get(Guid jobId) => _jobs.TryGetValue(jobId, out var job) ? job : null;

    public bool Cancel(Guid jobId)
    {
        if (!_jobs.TryGetValue(jobId, out var job) || job.Status is not (UploadNormalizeJobStatus.QUEUED or UploadNormalizeJobStatus.RUNNING))
            return false;
        if (_running.TryRemove(jobId, out var cts)) cts.Cancel();
        job.Status = UploadNormalizeJobStatus.CANCELED;
        job.Error = "canceled_by_user";
        job.UpdatedAtUtc = DateTimeOffset.UtcNow;
        PersistJobs();
        return true;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _jobStore.InitializeAsync(stoppingToken);
        await _historyStore.InitializeAsync(stoppingToken);
        var persisted = await _jobStore.ReadAsync(stoppingToken);
        foreach (var job in persisted)
        {
            if (job.Status == UploadNormalizeJobStatus.RUNNING)
            {
                job.Status = UploadNormalizeJobStatus.FAILED;
                job.Error = "service_restarted";
            }
            _jobs[job.JobId] = job;
            if (job.Status == UploadNormalizeJobStatus.QUEUED && job.TtlAtUtc > DateTimeOffset.UtcNow)
                _queue.Writer.TryWrite(job.JobId);
        }
        await PersistJobsAsync(stoppingToken);

        await foreach (var jobId in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            if (!_jobs.TryGetValue(jobId, out var job) || job.Status != UploadNormalizeJobStatus.QUEUED) continue;
            if (job.TtlAtUtc <= DateTimeOffset.UtcNow)
            {
                job.Status = UploadNormalizeJobStatus.FAILED;
                job.Error = "job_expired";
                TryDelete(job.UploadTempPath);
                await PersistJobsAsync(stoppingToken);
                continue;
            }
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            _running[jobId] = linked;
            await ExecuteJobAsync(job, linked.Token);
            _running.TryRemove(jobId, out _);
            await PersistJobsAsync(stoppingToken);
        }
    }

    private async Task ExecuteJobAsync(UploadNormalizeJobState job, CancellationToken ct)
    {
        job.Status = UploadNormalizeJobStatus.RUNNING;
        job.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await PersistJobsAsync(ct);
        try
        {
            var args = new[]
            {
                "-y", "-progress", "pipe:2", "-nostats", "-i", job.UploadTempPath,
                "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "superfast",
                "-crf", "24", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", job.OutputPath
            };
            var result = await RunAsync("ffmpeg", args, job, ct);
            if (!result.Success || !File.Exists(job.OutputPath)) throw new InvalidOperationException(result.Error ?? "ffmpeg normalize failed");
            var outputSize = new FileInfo(job.OutputPath).Length;
            var relativePath = $"video/{job.StoredName}";
            await _historyStore.UpdateAsync(items =>
            {
                items.Add(new VideoHistoryItem("upload", job.StoredName, job.OriginalName, DateTimeOffset.UtcNow, outputSize, relativePath, job.DurationSeconds));
                return items;
            }, ct);
            job.ProgressPercent = 100;
            job.Status = UploadNormalizeJobStatus.SUCCEEDED;
            job.RelativePath = relativePath;
            job.Size = outputSize;
            job.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
        catch (OperationCanceledException)
        {
            TryDelete(job.OutputPath);
            job.Status = UploadNormalizeJobStatus.CANCELED;
            job.Error = "canceled";
        }
        catch (Exception exception)
        {
            TryDelete(job.OutputPath);
            job.Status = UploadNormalizeJobStatus.FAILED;
            job.Error = exception.Message;
            _logger.LogError(exception, "Video upload normalization failed for {JobId}", job.JobId);
        }
        finally
        {
            job.UpdatedAtUtc = DateTimeOffset.UtcNow;
            TryDelete(job.UploadTempPath);
        }
    }

    private static async Task<(bool Success, string? Error)> RunAsync(string fileName, IEnumerable<string> args, UploadNormalizeJobState job, CancellationToken ct)
    {
        using var process = new Process { StartInfo = new ProcessStartInfo(fileName) { RedirectStandardError = true, RedirectStandardOutput = true, UseShellExecute = false, CreateNoWindow = true } };
        foreach (var arg in args) process.StartInfo.ArgumentList.Add(arg);
        process.Start();
        using var registration = ct.Register(() => { try { if (!process.HasExited) process.Kill(true); } catch { } });
        var error = new StringBuilder();
        while (await process.StandardError.ReadLineAsync(ct) is { } line)
        {
            if (error.Length < MaxErrorChars) error.AppendLine(line[..Math.Min(line.Length, MaxErrorChars - error.Length)]);
            if (line.StartsWith("out_time_ms=", StringComparison.Ordinal) && job.DurationSeconds > 0 && long.TryParse(line[12..], CultureInfo.InvariantCulture, out var micros))
                job.ProgressPercent = Math.Clamp((int)Math.Round(micros / 1_000_000d / job.DurationSeconds * 100d), 0, 99);
        }
        await process.WaitForExitAsync(ct);
        return (process.ExitCode == 0, error.Length == 0 ? null : error.ToString());
    }

    private void PersistJobs() => PersistJobsAsync(CancellationToken.None).GetAwaiter().GetResult();

    private Task PersistJobsAsync(CancellationToken ct)
    {
        var retained = _jobs.Values
            .Where(x => x.TtlAtUtc > DateTimeOffset.UtcNow || x.Status is UploadNormalizeJobStatus.QUEUED or UploadNormalizeJobStatus.RUNNING)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(200)
            .ToList();
        return _jobStore.WriteAsync(retained, ct);
    }

    private static void TryDelete(string path) { try { if (File.Exists(path)) File.Delete(path); } catch { } }
}
