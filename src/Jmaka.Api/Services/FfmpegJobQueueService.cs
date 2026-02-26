using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Jmaka.Api.Services;

public enum EncodingMode
{
    MAX_QUALITY,
    BALANCED,
    ULTRA_SAFE,
    VIDCOV
}

public sealed class FfmpegQueueOptions
{
    public EncodingMode DefaultEncodingMode { get; set; } = EncodingMode.BALANCED;
    public int BalancedDurationLimitSeconds { get; set; } = 120;
    public bool EnableRamBasedFallback { get; set; } = true;
    public int MinAvailableRamMbFor720p2Pass { get; set; } = 1200;
    public int MinAvailableRamMbFor720pAny { get; set; } = 800;
    public int RamSafetyMarginMb { get; set; } = 200;
    public int MaxConcurrentFfmpegJobs { get; set; } = 1;
    public int FfmpegQueueMaxLength { get; set; } = 200;
    public int FfmpegQueueJobTtlMinutes { get; set; } = 180;
    public int FfmpegQueuePollIntervalMs { get; set; } = 200;
    public string FfmpegQueueOnOverflow { get; set; } = "REJECT_429";
    public int JobHistoryCap { get; set; } = 1000;
}

public enum FfmpegJobStatus { QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELED, EXPIRED }

internal sealed class FfmpegJob
{
    public Guid JobId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset TtlAtUtc { get; set; }
    public EncodingMode RequestedMode { get; set; }
    public EncodingMode ResolvedMode { get; set; }
    public string? RamDecision { get; set; }
    public double? DurationSeconds { get; set; }
    public string InputPath { get; set; } = string.Empty;
    public string OutputPath { get; set; } = string.Empty;
    public string? RelativeOutputPath { get; set; }
    public FfmpegJobStatus Status { get; set; }
    public string? Progress { get; set; }
    public string? Error { get; set; }
    public string? CorrelationId { get; set; }
    public VideoProcessRequest Request { get; set; } = default!;
}

internal record EnqueueResult(bool Accepted, bool QueueFull, FfmpegJob? Job);

internal interface IFfmpegJobQueue
{
    EnqueueResult Enqueue(VideoProcessRequest request, string inputPath, string outputPath, string correlationId);
    FfmpegJob? Get(Guid jobId);
    bool Cancel(Guid jobId);
}

internal sealed class FfmpegJobQueueService : BackgroundService, IFfmpegJobQueue
{
    private readonly ILogger<FfmpegJobQueueService> _logger;
    private readonly FfmpegQueueOptions _opts;
    private readonly string _jobsPath;
    private readonly ConcurrentDictionary<Guid, FfmpegJob> _jobs = new();
    private readonly ConcurrentQueue<Guid> _queue = new();
    private readonly ConcurrentDictionary<Guid, Process> _runningProcesses = new();
    private readonly SemaphoreSlim _signal = new(0);
    private readonly SemaphoreSlim _concurrency;
    private readonly object _persistLock = new();

    public FfmpegJobQueueService(ILogger<FfmpegJobQueueService> logger, IOptions<FfmpegQueueOptions> opts, IWebHostEnvironment env)
    {
        _logger = logger;
        _opts = opts.Value;
        _concurrency = new SemaphoreSlim(Math.Max(1, _opts.MaxConcurrentFfmpegJobs));
        var storageRoot = Environment.GetEnvironmentVariable("JMAKA_STORAGE_ROOT");
        if (string.IsNullOrWhiteSpace(storageRoot)) storageRoot = env.ContentRootPath;
        var videoOut = Path.Combine(storageRoot, "video-out");
        Directory.CreateDirectory(videoOut);
        _jobsPath = Path.Combine(videoOut, "jobs.json");
        LoadJobs();
    }

    public EnqueueResult Enqueue(VideoProcessRequest request, string inputPath, string outputPath, string correlationId)
    {
        ExpireQueuedJobs();
        var queuedCount = _jobs.Values.Count(j => j.Status == FfmpegJobStatus.QUEUED);
        if (queuedCount >= _opts.FfmpegQueueMaxLength)
        {
            if (string.Equals(_opts.FfmpegQueueOnOverflow, "DROP_OLDEST", StringComparison.OrdinalIgnoreCase))
            {
                DropOldestQueued();
            }
            else
            {
                return new EnqueueResult(false, true, null);
            }
        }

        var job = new FfmpegJob
        {
            JobId = Guid.NewGuid(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            TtlAtUtc = DateTimeOffset.UtcNow.AddMinutes(Math.Max(1, _opts.FfmpegQueueJobTtlMinutes)),
            RequestedMode = ParseMode(request.EncodingMode) ?? _opts.DefaultEncodingMode,
            ResolvedMode = _opts.DefaultEncodingMode,
            InputPath = inputPath,
            OutputPath = outputPath,
            Status = FfmpegJobStatus.QUEUED,
            CorrelationId = correlationId,
            Request = request
        };

        _jobs[job.JobId] = job;
        _queue.Enqueue(job.JobId);
        _signal.Release();
        PersistJobs();
        _logger.LogInformation("Queue enqueue: jobId={id}, len={len}, mode={requestedMode}", job.JobId, _queue.Count, job.RequestedMode);
        return new EnqueueResult(true, false, job);
    }

    public FfmpegJob? Get(Guid jobId) => _jobs.TryGetValue(jobId, out var job) ? job : null;

    public bool Cancel(Guid jobId)
    {
        if (!_jobs.TryGetValue(jobId, out var job)) return false;
        if (job.Status == FfmpegJobStatus.QUEUED)
        {
            job.Status = FfmpegJobStatus.CANCELED;
            job.Error = "queue_overflow_or_user_cancel";
            PersistJobs();
            return true;
        }

        if (job.Status == FfmpegJobStatus.RUNNING && _runningProcesses.TryGetValue(jobId, out var process))
        {
            try { process.Kill(true); } catch { }
            job.Status = FfmpegJobStatus.CANCELED;
            job.Error = "killed_by_user";
            PersistJobs();
            return true;
        }

        return false;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            ExpireQueuedJobs();
            if (!_queue.TryDequeue(out var jobId))
            {
                await Task.Delay(Math.Max(50, _opts.FfmpegQueuePollIntervalMs), stoppingToken);
                continue;
            }

            if (!_jobs.TryGetValue(jobId, out var job) || job.Status != FfmpegJobStatus.QUEUED) continue;
            if (job.TtlAtUtc <= DateTimeOffset.UtcNow)
            {
                job.Status = FfmpegJobStatus.EXPIRED;
                PersistJobs();
                continue;
            }

            await _concurrency.WaitAsync(stoppingToken);
            _logger.LogInformation("Semaphore: acquired, running={runningCount}, max={max}", _opts.MaxConcurrentFfmpegJobs - _concurrency.CurrentCount, _opts.MaxConcurrentFfmpegJobs);
            _ = Task.Run(async () =>
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    job.Status = FfmpegJobStatus.RUNNING;
                    job.Progress = "starting";
                    PersistJobs();
                    _logger.LogInformation("Queue start: jobId={id}", job.JobId);
                    await ExecuteJobAsync(job, stoppingToken);
                    if (job.Status == FfmpegJobStatus.RUNNING) job.Status = FfmpegJobStatus.SUCCEEDED;
                }
                catch (Exception ex)
                {
                    if (job.Status == FfmpegJobStatus.RUNNING)
                    {
                        job.Status = FfmpegJobStatus.FAILED;
                        job.Error = ex.Message;
                    }
                }
                finally
                {
                    PersistJobs();
                    _concurrency.Release();
                    _logger.LogInformation("Semaphore: released, running={runningCount}, max={max}", _opts.MaxConcurrentFfmpegJobs - _concurrency.CurrentCount, _opts.MaxConcurrentFfmpegJobs);
                    _logger.LogInformation("Queue done: jobId={id}, status={status}, ms={elapsed}", job.JobId, job.Status, sw.ElapsedMilliseconds);
                }
            }, stoppingToken);
        }
    }

    private async Task ExecuteJobAsync(FfmpegJob job, CancellationToken ct)
    {
        if (!File.Exists(job.InputPath)) throw new InvalidOperationException("video not found");
        if (!HasCommand("ffmpeg") || !HasCommand("ffprobe")) throw new InvalidOperationException("ffmpeg/ffprobe not found");

        var duration = await TryGetVideoDurationSecondsAsync(job.InputPath, ct);
        if (duration <= 0) throw new InvalidOperationException("unable to detect duration");
        job.DurationSeconds = duration;

        var isVidcovMode = job.RequestedMode == EncodingMode.VIDCOV;
        var (mode, reason) = ResolveMode(job.RequestedMode, duration, ReadAvailableRamMb());
        job.ResolvedMode = mode;
        job.RamDecision = reason;

        // x264 + yuv420p requires even frame dimensions.
        // Ultra-safe profile historically used 720x405 (16:9), which causes encoder failure.
        var target = mode == EncodingMode.ULTRA_SAFE ? (720, 404) : (1280, 720);

        var selectedSegments = (job.Request.Segments ?? Array.Empty<VideoProcessSegment>())
            .Where(x => x is not null)
            .Select(x =>
            {
                var start = Math.Clamp(x.StartSec, 0, duration);
                var end = Math.Clamp(x.EndSec, 0, duration);
                return (Start: start, End: end);
            })
            .Where(x => x.End - x.Start >= 0.05)
            .OrderBy(x => x.Start)
            .ToList();

        var effectiveDuration = selectedSegments.Count > 0
            ? selectedSegments.Sum(x => Math.Max(0, x.End - x.Start))
            : duration;

        var cropXNorm = Math.Clamp(job.Request.CropX ?? 0d, 0d, 1d);
        var cropYNorm = Math.Clamp(job.Request.CropY ?? 0d, 0d, 1d);
        var cropWNorm = Math.Clamp(job.Request.CropW ?? 1d, 0.05d, 1d);
        var cropHNorm = Math.Clamp(job.Request.CropH ?? 1d, 0.05d, 1d);
        if (cropXNorm + cropWNorm > 1d) cropXNorm = Math.Max(0d, 1d - cropWNorm);
        if (cropYNorm + cropHNorm > 1d) cropYNorm = Math.Max(0d, 1d - cropHNorm);

        var targetMb = Math.Clamp(job.Request.TargetSizeMb, 0.1, 2048);
        var desiredTargetMb = isVidcovMode ? 1.2 : targetMb;
        var sourceHasAudio = await TryHasAudioStreamAsync(job.InputPath, ct);
        var includeAudio = !(job.Request.MuteAudio ?? false) && !isVidcovMode && sourceHasAudio;
        var audioKbps = includeAudio ? (mode == EncodingMode.MAX_QUALITY ? 128 : 96) : 0;
        var desiredTotalKbps = (desiredTargetMb * 8192.0) / Math.Max(1, effectiveDuration);
        var desiredVideoKbps = (int)Math.Round(Math.Max(80, desiredTotalKbps - audioKbps) * 0.98);

        int minKbps;
        int maxKbps;
        if (isVidcovMode)
        {
            // Vidcov should stay compact (~0.8-1.5 MB) even with many short segments.
            var minTargetKbps = (int)Math.Floor((0.8 * 8192.0 / Math.Max(1, effectiveDuration)) * 0.96);
            var maxTargetKbps = (int)Math.Ceiling((1.5 * 8192.0 / Math.Max(1, effectiveDuration)) * 0.99);
            minKbps = Math.Clamp(minTargetKbps, 60, 1800);
            maxKbps = Math.Clamp(maxTargetKbps, Math.Max(minKbps, 90), 1800);
        }
        else
        {
            minKbps = mode == EncodingMode.ULTRA_SAFE ? 120 : 180;
            maxKbps = mode == EncodingMode.ULTRA_SAFE ? 1800 : 12000;
        }

        var videoKbps = Math.Clamp(desiredVideoKbps, minKbps, maxKbps);
        var bitrate = $"{videoKbps}k";

        string sourceLabel;
        string? audioSourceLabel = null;
        var filterParts = new List<string>();
        if (selectedSegments.Count > 0)
        {
            var concatVideoInputs = new StringBuilder();
            var concatAudioInputs = new StringBuilder();
            for (var i = 0; i < selectedSegments.Count; i++)
            {
                var seg = selectedSegments[i];
                filterParts.Add($"[0:v]trim=start={seg.Start.ToString(CultureInfo.InvariantCulture)}:end={seg.End.ToString(CultureInfo.InvariantCulture)},setpts=PTS-STARTPTS,settb=AVTB[v{i}]");
                concatVideoInputs.Append($"[v{i}]");
                if (includeAudio)
                {
                    filterParts.Add($"[0:a]atrim=start={seg.Start.ToString(CultureInfo.InvariantCulture)}:end={seg.End.ToString(CultureInfo.InvariantCulture)},asetpts=PTS-STARTPTS[a{i}]");
                    concatAudioInputs.Append($"[a{i}]");
                }
            }

            if (includeAudio)
            {
                filterParts.Add($"{concatVideoInputs}{concatAudioInputs}concat=n={selectedSegments.Count}:v=1:a=1:unsafe=1[vsrc][asrc]");
                audioSourceLabel = "[asrc]";
            }
            else
            {
                filterParts.Add($"{concatVideoInputs}concat=n={selectedSegments.Count}:v=1:a=0:unsafe=1[vsrc]");
            }
            sourceLabel = "[vsrc]";
        }
        else
        {
            sourceLabel = "[0:v]";
        }

        // Match preview behavior: always fill 16:9 viewport and keep only the visible region.
        filterParts.Add($"{sourceLabel}scale={target.Item1}:{target.Item2}:force_original_aspect_ratio=increase:force_divisible_by=2,crop={target.Item1}:{target.Item2}:(iw-ow)/2:(ih-oh)/2[vviewport]");

        var cropWidthPx = Math.Clamp((int)Math.Round(target.Item1 * cropWNorm), 2, target.Item1);
        if ((cropWidthPx & 1) != 0) cropWidthPx -= 1;
        if (cropWidthPx < 2) cropWidthPx = 2;

        var cropHeightPx = Math.Clamp((int)Math.Round(target.Item2 * cropHNorm), 2, target.Item2);
        if ((cropHeightPx & 1) != 0) cropHeightPx -= 1;
        if (cropHeightPx < 2) cropHeightPx = 2;

        var cropLeftPx = (int)Math.Round((target.Item1 - cropWidthPx) * cropXNorm);
        var cropTopPx = (int)Math.Round((target.Item2 - cropHeightPx) * cropYNorm);
        cropLeftPx = Math.Clamp(cropLeftPx, 0, Math.Max(0, target.Item1 - cropWidthPx));
        cropTopPx = Math.Clamp(cropTopPx, 0, Math.Max(0, target.Item2 - cropHeightPx));

        filterParts.Add($"[vviewport]crop={cropWidthPx}:{cropHeightPx}:{cropLeftPx}:{cropTopPx},scale={target.Item1}:{target.Item2}:flags=lanczos,fps=24,format=yuv420p[v]");
        var filter = string.Join(';', filterParts);

        var passlog = Path.Combine(Path.GetDirectoryName(job.OutputPath) ?? ".", $"pass-{job.JobId:N}");

        if (mode == EncodingMode.MAX_QUALITY)
        {
            var nullOutput = OperatingSystem.IsWindows() ? "NUL" : "/dev/null";
            var pass1 = new List<string>{"-y","-threads","1","-i",job.InputPath,"-filter_complex",filter,"-map","[v]","-an","-c:v","libx264","-b:v",bitrate,"-pass","1","-passlogfile",passlog,"-f","mp4",nullOutput};
            var pass2 = new List<string>{"-y","-threads","1","-i",job.InputPath,"-filter_complex",filter,"-map","[v]","-c:v","libx264","-b:v",bitrate,"-pass","2","-passlogfile",passlog};
            if (includeAudio)
            {
                if (!string.IsNullOrWhiteSpace(audioSourceLabel))
                {
                    pass2.AddRange(new []{"-map",audioSourceLabel,"-c:a","aac","-b:a",$"{audioKbps}k"});
                }
                else
                {
                    pass2.AddRange(new []{"-map","0:a?","-c:a","aac","-b:a",$"{audioKbps}k"});
                }
            }
            else
            {
                pass2.Add("-an");
            }
            pass2.Add(job.OutputPath);
            await RunProcessAsync(job, "ffmpeg", pass1, ct);
            await RunProcessAsync(job, "ffmpeg", pass2, ct);
            CleanupPassLogs(passlog);
        }
        else
        {
            var args = new List<string>{"-y","-threads","1","-i",job.InputPath,"-filter_complex",filter,"-map","[v]","-c:v","libx264","-pix_fmt","yuv420p","-b:v",bitrate};
            if (isVidcovMode)
            {
                // Keep VIDCOV output size predictable even with many stitched segments.
                var maxRate = $"{videoKbps}k";
                var bufSize = $"{Math.Max(120, videoKbps * 2)}k";
                args.AddRange(new[] { "-maxrate", maxRate, "-bufsize", bufSize, "-preset", "veryfast", "-movflags", "+faststart" });
            }
            else
            {
                // Stable default for episod 10/20/30 on constrained hosts.
                args.AddRange(new[] { "-preset", "veryfast", "-movflags", "+faststart" });
            }
            if (includeAudio)
            {
                if (!string.IsNullOrWhiteSpace(audioSourceLabel))
                {
                    args.AddRange(new []{"-map",audioSourceLabel,"-c:a","aac","-b:a",$"{audioKbps}k"});
                }
                else
                {
                    args.AddRange(new []{"-map","0:a?","-c:a","aac","-b:a",$"{audioKbps}k"});
                }
            }
            else
            {
                args.Add("-an");
            }
            args.Add(job.OutputPath);
            await RunProcessAsync(job, "ffmpeg", args, ct);
        }

        job.RelativeOutputPath = $"video-out/{Path.GetFileName(job.OutputPath)}";
        job.Progress = "done";
    }

    private async Task RunProcessAsync(FfmpegJob job, string fileName, List<string> args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo { FileName = fileName, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        foreach (var a in args) psi.ArgumentList.Add(a);
        using var process = new Process { StartInfo = psi };
        if (!process.Start()) throw new InvalidOperationException("failed to start process");
        _runningProcesses[job.JobId] = process;
        var outputTask = process.StandardOutput.ReadToEndAsync(ct);
        var errorTask = process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);
        _runningProcesses.TryRemove(job.JobId, out _);
        var err = await errorTask;
        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(err) ? $"process failed: {process.ExitCode}" : err);
        }
        _ = await outputTask;
    }

    private (EncodingMode Mode, string Reason) ResolveMode(EncodingMode requested, double duration, int ramMb)
    {
        if (requested == EncodingMode.VIDCOV)
        {
            return (EncodingMode.ULTRA_SAFE, "vidcov_requested");
        }

        // Keep BALANCED truly single-pass for production stability (low-RAM servers),
        // instead of auto-upgrading short clips to MAX_QUALITY (2-pass).
        var mode = requested == EncodingMode.BALANCED ? EncodingMode.BALANCED : requested;
        var reason = requested == EncodingMode.BALANCED ? "balanced_requested" : "requested";

        if (_opts.EnableRamBasedFallback)
        {
            var effective = Math.Max(0, ramMb - _opts.RamSafetyMarginMb);
            _logger.LogInformation("RAM check: MemAvailable={available_mb}MB, effective={available_mb_effective}MB, margin={margin}MB", ramMb, effective, _opts.RamSafetyMarginMb);
            if (mode == EncodingMode.MAX_QUALITY && effective < _opts.MinAvailableRamMbFor720p2Pass)
            {
                _logger.LogInformation("RAM fallback decision: {from_profile} -> {to_profile} (reason={reason})", mode, EncodingMode.BALANCED, "low_ram_for_2pass_720p");
                return (EncodingMode.BALANCED, "low_ram_for_2pass_720p");
            }

            if (mode == EncodingMode.BALANCED && effective < _opts.MinAvailableRamMbFor720pAny)
            {
                _logger.LogInformation("RAM fallback decision: keep {profile} (reason={reason})", mode, "low_ram_for_720p_any");
                return (EncodingMode.BALANCED, "low_ram_for_720p_any");
            }
        }

        return (mode, reason);
    }

    private int ReadAvailableRamMb()
    {
        try
        {
            if (OperatingSystem.IsLinux() && File.Exists("/proc/meminfo"))
            {
                var line = File.ReadLines("/proc/meminfo").FirstOrDefault(x => x.StartsWith("MemAvailable:", StringComparison.Ordinal));
                if (line is not null)
                {
                    var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2 && long.TryParse(parts[1], out var kb)) return (int)(kb / 1024);
                }
            }
        }
        catch { }

        try
        {
            var psi = new ProcessStartInfo { FileName = "free", Arguments = "-m", RedirectStandardOutput = true, UseShellExecute = false };
            using var p = Process.Start(psi);
            if (p is null) return 0;
            var text = p.StandardOutput.ReadToEnd();
            p.WaitForExit(1000);
            var mem = text.Split('\n').FirstOrDefault(x => x.TrimStart().StartsWith("Mem:"));
            if (mem is null) return 0;
            var cols = mem.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (cols.Length >= 7 && int.TryParse(cols[6], out var available)) return available;
        }
        catch { }

        return 0;
    }

    private static EncodingMode? ParseMode(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (string.Equals(raw, "VIDCOV", StringComparison.OrdinalIgnoreCase)) return EncodingMode.VIDCOV;
        return Enum.TryParse<EncodingMode>(raw, true, out var mode) ? mode : null;
    }

    private static bool HasCommand(string name)
    {
        try
        {
            var psi = new ProcessStartInfo { FileName = "which", Arguments = name, RedirectStandardOutput = true, RedirectStandardError = true };
            using var p = Process.Start(psi);
            if (p is null) return false;
            p.WaitForExit(2000);
            return p.ExitCode == 0;
        }
        catch { return false; }
    }

    private static async Task<double> TryGetVideoDurationSecondsAsync(string absolutePath, CancellationToken ct)
    {
        var args = new List<string> { "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", absolutePath };
        var psi = new ProcessStartInfo { FileName = "ffprobe", RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        foreach (var a in args) psi.ArgumentList.Add(a);
        using var p = new Process { StartInfo = psi };
        if (!p.Start()) return 0;
        var output = await p.StandardOutput.ReadToEndAsync(ct);
        await p.WaitForExitAsync(ct);
        return double.TryParse(output.Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out var duration) ? duration : 0;
    }

    private static async Task<bool> TryHasAudioStreamAsync(string absolutePath, CancellationToken ct)
    {
        var args = new List<string> { "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=index", "-of", "default=nokey=1:noprint_wrappers=1", absolutePath };
        var psi = new ProcessStartInfo { FileName = "ffprobe", RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        foreach (var a in args) psi.ArgumentList.Add(a);
        using var p = new Process { StartInfo = psi };
        if (!p.Start()) return false;
        var output = await p.StandardOutput.ReadToEndAsync(ct);
        await p.WaitForExitAsync(ct);
        return p.ExitCode == 0 && !string.IsNullOrWhiteSpace(output);
    }

    private static void CleanupPassLogs(string passLogBase)
    {
        TryDeleteFile($"{passLogBase}-0.log");
        TryDeleteFile($"{passLogBase}-0.log.mbtree");
    }

    private static void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    private void ExpireQueuedJobs()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var job in _jobs.Values.Where(j => j.Status == FfmpegJobStatus.QUEUED && j.TtlAtUtc < now))
        {
            job.Status = FfmpegJobStatus.EXPIRED;
            job.Error = "ttl_expired";
        }
        PersistJobs();
    }

    private void DropOldestQueued()
    {
        var old = _jobs.Values.Where(j => j.Status == FfmpegJobStatus.QUEUED).OrderBy(j => j.CreatedAtUtc).FirstOrDefault();
        if (old is null) return;
        old.Status = FfmpegJobStatus.CANCELED;
        old.Error = "queue_overflow";
        PersistJobs();
    }

    private void LoadJobs()
    {
        try
        {
            if (!File.Exists(_jobsPath)) return;
            var jobs = JsonSerializer.Deserialize<List<FfmpegJob>>(File.ReadAllText(_jobsPath)) ?? new();
            foreach (var job in jobs)
            {
                if (job.Status == FfmpegJobStatus.RUNNING) job.Status = FfmpegJobStatus.FAILED;
                _jobs[job.JobId] = job;
            }
        }
        catch { }
    }

    private void PersistJobs()
    {
        lock (_persistLock)
        {
            var snapshot = _jobs.Values.OrderByDescending(x => x.CreatedAtUtc).Take(_opts.JobHistoryCap).ToList();
            var tmp = _jobsPath + ".tmp";
            var json = JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(tmp, json);
            File.Move(tmp, _jobsPath, true);
        }
    }
}
