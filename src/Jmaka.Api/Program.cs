using System.Text;
using System.Text.Json;
using System.Globalization;
using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using Jmaka.Api.Services;
using Jmaka.Api.Security;
using Jmaka.Api.Storage;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.StaticFiles;
using System.Threading.RateLimiting;

// Jmaka Minimal API entry point.
// RU: Этот файл настраивает веб-приложение и описывает все HTTP‑эндпоинты и работу с файловым хранилищем.
// EN: This file configures the web app and declares all HTTP endpoints and how runtime storage is organized.
var builder = WebApplication.CreateBuilder(args);

const long MaxUploadBytes = 75L * 1024 * 1024; // 75 MB
const long MaxVideoUploadBytes = 1536L * 1024 * 1024; // 1.5 GB

// Ширина миниатюры для превью (используется в UI, чтобы не грузить оригиналы)
const int PreviewWidthPx = 320;

// Целевые ширины для ресайза изображений
var resizeWidths = new[] { 1280, 1920, 2440 };

// Лимиты на multipart/form-data
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = MaxVideoUploadBytes;
});

// Лимиты на размер тела запроса (Kestrel/IIS)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = MaxVideoUploadBytes;
});

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddAntiforgery();
builder.Services.AddRazorPages();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 180,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddFixedWindowLimiter("media", limiter =>
    {
        limiter.PermitLimit = 12;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
        limiter.AutoReplenishment = true;
    });
});
builder.Services.AddSingleton<ImagePipelineService>();
builder.Services.Configure<FfmpegQueueOptions>(builder.Configuration.GetSection("Ffmpeg"));
builder.Services.AddSingleton<FfmpegJobQueueService>();
builder.Services.AddSingleton<IFfmpegJobQueue>(sp => sp.GetRequiredService<FfmpegJobQueueService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<FfmpegJobQueueService>());
builder.Services.AddSingleton<UploadNormalizeQueueService>();
builder.Services.AddSingleton<IUploadNormalizeQueue>(sp => sp.GetRequiredService<UploadNormalizeQueueService>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<UploadNormalizeQueueService>());
builder.Services.AddHostedService<StorageMaintenanceService>();

var app = builder.Build();
var accessControl = BasicAccessControlOptions.FromEnvironment(app.Environment.IsDevelopment());

// Optional base path (e.g. "/jmaka") for running behind Nginx under a sub-path.
// If not set or equals "/" -> app is mounted at root.
var basePath = Environment.GetEnvironmentVariable("JMAKA_BASE_PATH");
if (!string.IsNullOrWhiteSpace(basePath) && basePath != "/")
{
    if (!basePath.StartsWith('/'))
    {
        basePath = "/" + basePath;
    }

    basePath = basePath.TrimEnd('/');
    if (basePath.Length > 1)
    {
        app.UsePathBase(basePath);
    }
}

// Ensure directories exist
// Важно для деплоя: данные (upload/resized/preview/data) можно вынести из папки приложения.
// По умолчанию всё остаётся рядом с приложением (ContentRootPath).
var storageRoot = Environment.GetEnvironmentVariable("JMAKA_STORAGE_ROOT");
if (string.IsNullOrWhiteSpace(storageRoot))
{
    storageRoot = app.Environment.ContentRootPath;
}

var uploadDir = Path.Combine(storageRoot, "upload");
var uploadOriginalDir = Path.Combine(storageRoot, "upload-original");
var resizedDir = Path.Combine(storageRoot, "resized");
var previewDir = Path.Combine(storageRoot, "preview");
var splitDir = Path.Combine(storageRoot, "split");
var split3Dir = Path.Combine(storageRoot, "split3");
var oknoFixDir = Path.Combine(storageRoot, "oknofix");
var oknoScaleDir = Path.Combine(storageRoot, "oknoscale");
var editsDir = Path.Combine(storageRoot, "edits");
var editsPreviewDir = Path.Combine(storageRoot, "edits-preview");
var videoDir = Path.Combine(storageRoot, "video");
var videoOutDir = Path.Combine(storageRoot, "video-out");
var videoOverlayDir = Path.Combine(storageRoot, "video-overlays");
var dataDir = Path.Combine(storageRoot, "data");
var historyPath = Path.Combine(dataDir, "history.json");
var compositesPath = Path.Combine(dataDir, "composites.json");
var videoHistoryPath = Path.Combine(dataDir, "video-history.json");
var overlayNamesPath = Path.Combine(dataDir, "video-overlay-names.json");
Directory.CreateDirectory(uploadDir);
Directory.CreateDirectory(uploadOriginalDir);
Directory.CreateDirectory(resizedDir);
Directory.CreateDirectory(previewDir);
Directory.CreateDirectory(splitDir);
Directory.CreateDirectory(split3Dir);
Directory.CreateDirectory(oknoFixDir);
Directory.CreateDirectory(oknoScaleDir);
Directory.CreateDirectory(editsDir);
Directory.CreateDirectory(editsPreviewDir);
Directory.CreateDirectory(videoDir);
Directory.CreateDirectory(videoOutDir);
Directory.CreateDirectory(videoOverlayDir);
Directory.CreateDirectory(dataDir);
foreach (var w in resizeWidths)
{
    Directory.CreateDirectory(Path.Combine(resizedDir, w.ToString()));
}

var historyStore = new AtomicJsonFileStore<List<UploadHistoryItem>>(
    historyPath,
    static () => [],
    app.Services.GetRequiredService<ILogger<AtomicJsonFileStore<List<UploadHistoryItem>>>>());
var compositesStore = new AtomicJsonFileStore<List<CompositeHistoryItem>>(
    compositesPath,
    static () => [],
    app.Services.GetRequiredService<ILogger<AtomicJsonFileStore<List<CompositeHistoryItem>>>>());
var videoHistoryStore = new AtomicJsonFileStore<List<VideoHistoryItem>>(
    videoHistoryPath,
    static () => [],
    app.Services.GetRequiredService<ILogger<AtomicJsonFileStore<List<VideoHistoryItem>>>>());
var overlayNamesStore = new AtomicJsonFileStore<Dictionary<string, string>>(
    overlayNamesPath,
    static () => new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase),
    app.Services.GetRequiredService<ILogger<AtomicJsonFileStore<Dictionary<string, string>>>>());

await historyStore.InitializeAsync();
await compositesStore.InitializeAsync();
await videoHistoryStore.InitializeAsync();
await overlayNamesStore.InitializeAsync();

// Retention: delete entries/files older than N hours (default 48h)
var retentionHours = 48;
var retentionEnv = Environment.GetEnvironmentVariable("JMAKA_RETENTION_HOURS");
if (!string.IsNullOrWhiteSpace(retentionEnv)
    && int.TryParse(retentionEnv, out var parsedRetentionHours)
    && parsedRetentionHours > 0)
{
    retentionHours = parsedRetentionHours;
}
var retention = TimeSpan.FromHours(retentionHours);

string GetSplitFileName(string storedName)
{
    // One split result per source image (slot #1): split/<storedName-noext>.jpg
    var name = Path.GetFileNameWithoutExtension(storedName);
    return $"{name}.jpg";
}

string GetSplit3FileName(string storedName)
{
    // One split3 result per source image (slot #1): split3/<storedName-noext>.jpg
    var name = Path.GetFileNameWithoutExtension(storedName);
    return $"{name}.jpg";
}

string MakeCompositeFileName()
{
    // e.g. 20260110-112233-123-<guid>.jpg
    var ts = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmss-fff");
    return $"{ts}-{Guid.NewGuid():N}.jpg";
}

string? GetCompositeAbsolutePath(CompositeHistoryItem it)
{
    if (it is null || string.IsNullOrWhiteSpace(it.Kind) || string.IsNullOrWhiteSpace(it.RelativePath))
    {
        return null;
    }

    var fileName = Path.GetFileName(it.RelativePath);
    if (string.IsNullOrWhiteSpace(fileName))
    {
        return null;
    }

    if (string.Equals(it.Kind, "split3", StringComparison.OrdinalIgnoreCase))
    {
        return Path.Combine(split3Dir, fileName);
    }

    if (string.Equals(it.Kind, "oknofix", StringComparison.OrdinalIgnoreCase))
    {
        return Path.Combine(oknoFixDir, fileName);
    }

    if (string.Equals(it.Kind, "oknoscale", StringComparison.OrdinalIgnoreCase))
    {
        return Path.Combine(oknoScaleDir, fileName);
    }

    if (string.Equals(it.Kind, "edit", StringComparison.OrdinalIgnoreCase))
    {
        return Path.Combine(editsDir, fileName);
    }

    return Path.Combine(splitDir, fileName);
}

async Task DeleteCompositesForStoredNameAsync(string storedName, CancellationToken ct)
{
    List<CompositeHistoryItem> removed = [];
    await compositesStore.UpdateAsync(items =>
    {
        removed = items
            .Where(x => x.Sources != null && x.Sources.Any(s => string.Equals(s, storedName, StringComparison.Ordinal)))
            .ToList();
        return items.Except(removed).ToList();
    }, ct);

    foreach (var it in removed)
    {
        try
        {
            var abs = GetCompositeAbsolutePath(it);
            if (!string.IsNullOrWhiteSpace(abs))
            {
                TryDeleteFile(abs);
            }
            if (!string.IsNullOrWhiteSpace(it.PreviewRelativePath) && string.Equals(it.Kind, "edit", StringComparison.OrdinalIgnoreCase))
            {
                var previewName = Path.GetFileName(it.PreviewRelativePath);
                if (!string.IsNullOrWhiteSpace(previewName))
                {
                    TryDeleteFile(Path.Combine(editsPreviewDir, previewName));
                }
            }
        }
        catch { }
    }
}

async Task DeleteAllFilesForStoredNameAsync(string storedName, CancellationToken ct)
{
    // originals
    TryDeleteFile(Path.Combine(uploadDir, storedName));
    TryDeleteFile(Path.Combine(uploadOriginalDir, storedName));

    // preview
    TryDeleteFile(Path.Combine(previewDir, storedName));

    // legacy deterministic split outputs
    TryDeleteFile(Path.Combine(splitDir, GetSplitFileName(storedName)));
    TryDeleteFile(Path.Combine(split3Dir, GetSplit3FileName(storedName)));

    // composites created from this image
    await DeleteCompositesForStoredNameAsync(storedName, ct);

    // resized
    foreach (var w in resizeWidths)
    {
        TryDeleteFile(Path.Combine(resizedDir, w.ToString(), storedName));
    }
}

var migrate1260Lock = new SemaphoreSlim(1, 1);

async Task Migrate1260To1280Async(CancellationToken ct)
{
    // Old versions used resized/1260/<storedName>. New version uses resized/1280/<storedName>.
    // We migrate history.json and move files if present.
    await migrate1260Lock.WaitAsync(ct);
    try
    {
        await historyStore.UpdateAsync(items =>
        {
            for (var i = 0; i < items.Count; i++)
            {
                var it = items[i];
                var resized = it.Resized;
                if (resized is null || resized.Count == 0)
                {
                    continue;
                }

                if (!resized.ContainsKey(1260) || resized.ContainsKey(1280))
                {
                    continue;
                }

                // Try moving file on disk
                var srcPath = Path.Combine(resizedDir, "1260", it.StoredName);
                var dstDir = Path.Combine(resizedDir, "1280");
                Directory.CreateDirectory(dstDir);
                var dstPath = Path.Combine(dstDir, it.StoredName);

                if (File.Exists(srcPath) && !File.Exists(dstPath))
                {
                    try
                    {
                        File.Move(srcPath, dstPath);
                    }
                    catch
                    {
                        try
                        {
                            File.Copy(srcPath, dstPath, overwrite: true);
                            File.Delete(srcPath);
                        }
                        catch
                        {
                            // ignore
                        }
                    }
                }

                var newResized = new Dictionary<int, string>(resized);
                newResized.Remove(1260);
                newResized[1280] = $"resized/1280/{it.StoredName}";
                items[i] = it with { Resized = newResized };
            }
            return items;
        }, ct);
    }
    finally
    {
        migrate1260Lock.Release();
    }
}

async Task PruneExpiredAsync(CancellationToken ct)
{
    // First, do a small legacy migration: old builds used width 1260, now it's 1280.
    // This keeps history + files consistent for existing installs.
    await Migrate1260To1280Async(ct);

    var cutoff = DateTimeOffset.UtcNow - retention;

    // 1) Prune upload history
    List<UploadHistoryItem> removedUploads = new();
    await historyStore.UpdateAsync(items =>
    {
        removedUploads = items.Where(x => x.CreatedAt < cutoff).ToList();
        return items.Where(x => x.CreatedAt >= cutoff).ToList();
    }, ct);

    foreach (var it in removedUploads)
    {
        try { await DeleteAllFilesForStoredNameAsync(it.StoredName, ct); } catch { /* ignore */ }
    }

    // 2) Prune composites (Split/Split3 outputs)
    List<CompositeHistoryItem> removedComposites = new();
    await compositesStore.UpdateAsync(items =>
    {
        removedComposites = items.Where(x => x.CreatedAt < cutoff).ToList();
        return items.Where(x => x.CreatedAt >= cutoff).ToList();
    }, ct);

    foreach (var it in removedComposites)
    {
        try
        {
            var abs = GetCompositeAbsolutePath(it);
            if (!string.IsNullOrWhiteSpace(abs))
            {
                TryDeleteFile(abs);
            }
        }
        catch
        {
            // ignore
        }
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Web UI (static files)
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseRouting();
app.UseJmakaAccessControl(accessControl);
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();

// Serve runtime files (resized/original uploads)
// We overwrite these files in-place (crop, regenerate preview, recreate resized), so disable caching.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(resizedDir),
    RequestPath = "/resized",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadDir),
    RequestPath = "/upload",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadOriginalDir),
    RequestPath = "/upload-original",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(videoDir),
    RequestPath = "/video",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(previewDir),
    RequestPath = "/preview",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(splitDir),
    RequestPath = "/split",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(split3Dir),
    RequestPath = "/split3",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(oknoFixDir),
    RequestPath = "/oknofix",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(oknoScaleDir),
    RequestPath = "/oknoscale",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(editsDir),
    RequestPath = "/edits",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(editsPreviewDir),
    RequestPath = "/edits-preview",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(videoOutDir),
    RequestPath = "/video-out",
    ContentTypeProvider = new FileExtensionContentTypeProvider(
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".mp4"] = "video/mp4"
        }),
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(videoOverlayDir),
    RequestPath = "/video-overlays",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers["Cache-Control"] = "no-store";
        ctx.Context.Response.Headers["Pragma"] = "no-cache";
        ctx.Context.Response.Headers["Expires"] = "0";
    }
});

app.UseAntiforgery();
app.MapRazorPages();

// PNG-шаблон для OknoFix (готовая карточка с рамкой/тенью)
var oknoFixOverlayPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "jmaka-template-oknofix-001.png");

// Version API endpoint
app.MapGet("/api/version", () =>
{
    var version = typeof(Program).Assembly.GetName().Version?.ToString(3) ?? "0.5.3";
    return Results.Ok(new { version });
});

app.MapGet("/health/live", () => Results.Ok(new { status = "live" }));

app.MapGet("/health/ready", async Task<IResult> (CancellationToken ct) =>
{
    var failures = new List<string>();
    foreach (var path in new[] { uploadDir, resizedDir, videoDir, videoOutDir, dataDir })
    {
        try
        {
            var probe = Path.Combine(path, $".ready-{Guid.NewGuid():N}.tmp");
            await File.WriteAllTextAsync(probe, "ready", ct);
            File.Delete(probe);
        }
        catch { failures.Add($"storage:{Path.GetFileName(path)}"); }
    }
    try
    {
        _ = await historyStore.ReadAsync(ct);
        _ = await compositesStore.ReadAsync(ct);
        _ = await videoHistoryStore.ReadAsync(ct);
        _ = await overlayNamesStore.ReadAsync(ct);
    }
    catch { failures.Add("json-store"); }
    if (!File.Exists(oknoFixOverlayPath)) failures.Add("oknofix-template");
    if (!HasCommand("ffmpeg") || !HasCommand("ffprobe")) failures.Add("ffmpeg");
    if (failures.Count > 0) return Results.Json(new { status = "not-ready", failures }, statusCode: StatusCodes.Status503ServiceUnavailable);
    return Results.Ok(new { status = "ready" });
});

app.MapGet("/favicon.ico", () => Results.NoContent());

// --- History & composites endpoints ---
// RU: Эти эндпоинты отдают историю загрузок и историю составных изображений.
// EN: These endpoints return upload history and composite (Split/Split3/Okno*) history.
app.MapGet("/history", async Task<IResult> (CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    var items = await historyStore.ReadAsync(ct);
    return Results.Ok(items.OrderByDescending(x => x.CreatedAt).Take(200));
});

app.MapGet("/composites", async Task<IResult> (CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    var items = await compositesStore.ReadAsync(ct);
    return Results.Ok(items.OrderByDescending(x => x.CreatedAt).Take(200));
});

app.MapPost("/delete-composite", async Task<IResult> (CompositeDeleteRequest req, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    if (string.IsNullOrWhiteSpace(req.RelativePath))
    {
        return Results.BadRequest(new { error = "relativePath is required" });
    }

    // Нормализуем путь (слеэши) и работаем по имени файла.
    var rel = req.RelativePath.Replace('\\', '/');
    var fileName = Path.GetFileName(rel);
    if (string.IsNullOrWhiteSpace(fileName))
    {
        return Results.BadRequest(new { error = "invalid relativePath" });
    }

    var items = await compositesStore.ReadAsync(ct);
    if (items.Count == 0)
    {
        return Results.NotFound(new { error = "not found" });
    }

    // Ищем по точному относительному пути или по имени файла на всякий случай.
    var toRemove = items.FirstOrDefault(x =>
        x != null &&
        (
            string.Equals(x.RelativePath.Replace('\\', '/'), rel, StringComparison.OrdinalIgnoreCase)
            || string.Equals(Path.GetFileName(x.RelativePath), fileName, StringComparison.OrdinalIgnoreCase)
        ));

    if (toRemove is null)
    {
        return Results.NotFound(new { error = "not found" });
    }

    await compositesStore.UpdateAsync(current => current
        .Where(x => !string.Equals(x.RelativePath.Replace('\\', '/'), toRemove.RelativePath.Replace('\\', '/'), StringComparison.OrdinalIgnoreCase))
        .ToList(), ct);

    try
    {
        var abs = GetCompositeAbsolutePath(toRemove);
        if (!string.IsNullOrWhiteSpace(abs))
        {
            TryDeleteFile(abs);
        }
    }
    catch
    {
        // игнорируем ошибки удаления файла на диске
    }

    return Results.Ok(new { ok = true, relativePath = toRemove.RelativePath });
})
.DisableAntiforgery()
.Accepts<CompositeDeleteRequest>("application/json")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

app.MapPost("/delete", async Task<IResult> (DeleteRequest req, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    if (string.IsNullOrWhiteSpace(req.StoredName))
    {
        return Results.BadRequest(new { error = "storedName is required" });
    }

    // Защита от path traversal
    var storedName = Path.GetFileName(req.StoredName);
    if (!string.Equals(storedName, req.StoredName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    var removed = await RemoveHistoryEntryAsync(historyStore, storedName, ct);
    if (!removed)
    {
        return Results.NotFound(new { error = "not found" });
    }

    // Delete all related files
    await DeleteAllFilesForStoredNameAsync(storedName, ct);

    return Results.Ok(new { ok = true, storedName });
})
.DisableAntiforgery()
.Accepts<DeleteRequest>("application/json")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

// --- Upload endpoint ---
// RU: Принимает multipart/form-data, сохраняет оригиналы и миниатюры, пишет запись в history.json.
// EN: Accepts multipart/form-data, stores originals/thumbnails and appends to history.json.
app.MapPost("/upload", async Task<IResult> (HttpRequest request, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    IFormCollection form;
    try
    {
        form = await request.ReadFormAsync(ct);
    }
    catch
    {
        return Results.BadRequest(new { error = "invalid multipart form" });
    }

    var files = form.Files;
    if (files is null || files.Count == 0)
    {
        return Results.BadRequest(new { error = "file is required" });
    }

    if (files.Count > 15)
    {
        return Results.BadRequest(new { error = "too many files (max 15)" });
    }

    async Task<object> SaveOneAsync(IFormFile file)
    {
        if (file.Length <= 0)
        {
            throw new InvalidOperationException("file is empty");
        }

        if (file.Length > MaxUploadBytes)
        {
            throw new InvalidOperationException($"file is too large (max {MaxUploadBytes} bytes)");
        }

        var storedName = $"{Guid.NewGuid():N}.jpg";
        var originalAbsolutePath = Path.Combine(uploadDir, storedName);
        var uploadExt = SanitizeExtension(Path.GetExtension(file.FileName));
        if (string.IsNullOrWhiteSpace(uploadExt))
        {
            uploadExt = ".upload";
        }
        var tempPath = Path.Combine(uploadDir, $"{Guid.NewGuid():N}{uploadExt}");

        await using (var stream = File.Create(tempPath))
        {
            await file.CopyToAsync(stream, ct);
        }

        ImageIdentification imageInfo;
        try
        {
            imageInfo = await imagePipeline.IdentifyAndValidateAsync(tempPath, ImageValidationLimits.Default, ct);
        }
        catch (InvalidDataException)
        {
            TryDeleteFile(tempPath);
            throw new InvalidOperationException("file is not a supported image or exceeds image limits");
        }

        await imagePipeline.ConvertToJpegSrgbAsync(tempPath, originalAbsolutePath, ct);
        TryDeleteFile(tempPath);

        // Сохраняем неизменённую копию для crop (чтобы каждый раз резать заново исходник)
        var originalCopyAbsolutePath = Path.Combine(uploadOriginalDir, storedName);
        if (!File.Exists(originalCopyAbsolutePath))
        {
            File.Copy(originalAbsolutePath, originalCopyAbsolutePath);
        }

        var previewAbsolutePath = Path.Combine(previewDir, storedName);
        var previewRelativePath = $"preview/{storedName}";
        await CreatePreviewImageAsync(originalAbsolutePath, previewAbsolutePath, PreviewWidthPx, imagePipeline, ct);

        var entry = new UploadHistoryItem(
            StoredName: storedName,
            OriginalName: file.FileName,
            CreatedAt: DateTimeOffset.UtcNow,
            Size: new FileInfo(originalAbsolutePath).Length,
            OriginalRelativePath: $"upload/{storedName}",
            PreviewRelativePath: previewRelativePath,
            ImageWidth: imageInfo.Width > 0 ? imageInfo.Width : null,
            ImageHeight: imageInfo.Height > 0 ? imageInfo.Height : null,
            Resized: new Dictionary<int, string>(),
            IsCropped: false
        );

        await AppendHistoryAsync(historyStore, entry, ct);

        return new
        {
            originalName = entry.OriginalName,
            storedName = entry.StoredName,
            createdAt = entry.CreatedAt,
            size = entry.Size,
            originalRelativePath = entry.OriginalRelativePath,
            previewRelativePath = entry.PreviewRelativePath,
            imageWidth = entry.ImageWidth,
            imageHeight = entry.ImageHeight,
            resized = entry.Resized
        };
    }

    try
    {
        var results = new List<object>(files.Count);
        foreach (var f in files)
        {
            results.Add(await SaveOneAsync(f));
        }

        return Results.Ok(results);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.DisableAntiforgery()
.Accepts<IFormFileCollection>("multipart/form-data")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest);

// --- Video upload endpoint ---
app.MapPost("/upload-video", async Task<IResult> (HttpRequest request, ILogger<Program> logger, IUploadNormalizeQueue normalizeQueue, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    IFormCollection form;
    try
    {
        form = await request.ReadFormAsync(ct);
    }
    catch (BadHttpRequestException ex) when (ex.StatusCode == StatusCodes.Status413PayloadTooLarge)
    {
        return Results.BadRequest(new { error = $"file is too large (max {Math.Round(MaxVideoUploadBytes / 1024d / 1024d)} MB)" });
    }
    catch
    {
        return Results.BadRequest(new { error = "invalid multipart form" });
    }

    var file = form.Files.FirstOrDefault();
    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "file is required" });
    }

    if (file.Length > MaxVideoUploadBytes)
    {
        return Results.BadRequest(new { error = "file is too large" });
    }

    if (!HasCommand("ffmpeg") || !HasCommand("ffprobe"))
    {
        return Results.BadRequest(new { error = "ffmpeg/ffprobe not found on server" });
    }

    var uploadExt = SanitizeExtension(Path.GetExtension(file.FileName));
    if (string.IsNullOrWhiteSpace(uploadExt))
    {
        uploadExt = ".bin";
    }

    // Upload first, then normalize in background with pollable progress.
    var uploadTempName = $"{Guid.NewGuid():N}.upload{uploadExt}";
    var uploadTempPath = Path.Combine(videoDir, uploadTempName);
    var storedName = $"{Guid.NewGuid():N}.mp4";
    var absolutePath = Path.Combine(videoDir, storedName);
    try
    {
        await using (var stream = File.Create(uploadTempPath))
        {
            await file.CopyToAsync(stream, ct);
        }
        var duration = await TryGetVideoDurationSecondsAsync(uploadTempPath, ct, logger);
        var normalizeJob = normalizeQueue.Enqueue(file.FileName, uploadTempPath, storedName, absolutePath, duration);
        if (normalizeJob is null)
        {
            TryDeleteFile(uploadTempPath);
            return Results.StatusCode(StatusCodes.Status429TooManyRequests);
        }

        return Results.Accepted($"/video/upload-jobs/{normalizeJob.JobId}", new
        {
            jobId = normalizeJob.JobId,
            status = normalizeJob.Status,
            createdAt = normalizeJob.CreatedAtUtc
        });
    }
    finally
    {
        // The hosted queue owns job retention and cleanup.
    }
})
.DisableAntiforgery()
.Accepts<IFormFile>("multipart/form-data")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status202Accepted)
.Produces(StatusCodes.Status400BadRequest);

// --- Video overlay templates ---
app.MapGet("/video-overlay-templates", async Task<IResult> (CancellationToken ct) =>
{
    var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".webp", ".jpg", ".jpeg" };
    var names = await overlayNamesStore.ReadAsync(ct);
    var items = Directory.EnumerateFiles(videoOverlayDir, "*.*", SearchOption.TopDirectoryOnly)
        .Where(path => allowed.Contains(Path.GetExtension(path)))
        .Select(path =>
        {
            var info = new FileInfo(path);
            var fileName = info.Name;
            var displayName = names.TryGetValue(fileName, out var customName) && !string.IsNullOrWhiteSpace(customName)
                ? customName
                : Path.GetFileNameWithoutExtension(fileName);
            return new
            {
                fileName,
                displayName,
                relativePath = $"video-overlays/{fileName}",
                createdAt = new DateTimeOffset(info.CreationTimeUtc, TimeSpan.Zero),
                size = info.Length
            };
        })
        .OrderByDescending(x => x.createdAt)
        .ToArray();
    return Results.Ok(items);
})
.Produces(StatusCodes.Status200OK);

app.MapPost("/upload-video-overlay-template", async Task<IResult> (HttpRequest request, CancellationToken ct) =>
{
    IFormCollection form;
    try
    {
        form = await request.ReadFormAsync(ct);
    }
    catch
    {
        return Results.BadRequest(new { error = "invalid multipart form" });
    }

    var file = form.Files.FirstOrDefault();
    if (file is null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "file is required" });
    }

    if (file.Length > MaxUploadBytes)
    {
        return Results.BadRequest(new { error = "file is too large" });
    }

    var ext = SanitizeExtension(Path.GetExtension(file.FileName));
    var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".webp", ".jpg", ".jpeg" };
    if (string.IsNullOrWhiteSpace(ext) || !allowed.Contains(ext))
    {
        return Results.BadRequest(new { error = "supported formats: .png, .webp, .jpg, .jpeg" });
    }

    var storedName = $"{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}{ext}";
    var absolutePath = Path.Combine(videoOverlayDir, storedName);
    await using (var stream = File.Create(absolutePath))
    {
        await file.CopyToAsync(stream, ct);
    }

    var names = await overlayNamesStore.ReadAsync(ct);
    var baseDisplayName = Path.GetFileNameWithoutExtension(file.FileName);
    names[storedName] = string.IsNullOrWhiteSpace(baseDisplayName) ? Path.GetFileNameWithoutExtension(storedName) : baseDisplayName.Trim();
    await overlayNamesStore.UpdateAsync(current =>
    {
        current[storedName] = names[storedName];
        return current;
    }, ct);

    return Results.Ok(new
    {
        fileName = storedName,
        displayName = names[storedName],
        relativePath = $"video-overlays/{storedName}",
        originalName = file.FileName,
        size = file.Length,
        createdAt = DateTimeOffset.UtcNow
    });
})
.DisableAntiforgery()
.Accepts<IFormFile>("multipart/form-data")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest);

app.MapPost("/video-overlay-templates/{fileName}/rename", async Task<IResult> (string fileName, OverlayRenameRequest req, CancellationToken ct) =>
{
    if (req is null || string.IsNullOrWhiteSpace(req.DisplayName))
    {
        return Results.BadRequest(new { error = "displayName is required" });
    }

    var safeFileName = Path.GetFileName(fileName);
    if (!string.Equals(safeFileName, fileName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid fileName" });
    }

    var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".webp", ".jpg", ".jpeg" };
    var ext = Path.GetExtension(safeFileName);
    if (string.IsNullOrWhiteSpace(ext) || !allowed.Contains(ext))
    {
        return Results.BadRequest(new { error = "invalid overlay file type" });
    }

    var absolutePath = Path.Combine(videoOverlayDir, safeFileName);
    if (!File.Exists(absolutePath))
    {
        return Results.NotFound(new { error = "overlay not found" });
    }

    var displayName = req.DisplayName.Trim();
    if (displayName.Length > 80)
    {
        displayName = displayName[..80];
    }

    await overlayNamesStore.UpdateAsync(names =>
    {
        names[safeFileName] = displayName;
        return names;
    }, ct);

    return Results.Ok(new
    {
        fileName = safeFileName,
        displayName,
        relativePath = $"video-overlays/{safeFileName}"
    });
})
.DisableAntiforgery()
.Accepts<OverlayRenameRequest>("application/json")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

app.MapDelete("/video-overlay-templates/{fileName}", async Task<IResult> (string fileName, CancellationToken ct) =>
{
    var safeFileName = Path.GetFileName(fileName);
    if (!string.Equals(safeFileName, fileName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid fileName" });
    }

    var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".png", ".webp", ".jpg", ".jpeg" };
    var ext = Path.GetExtension(safeFileName);
    if (string.IsNullOrWhiteSpace(ext) || !allowed.Contains(ext))
    {
        return Results.BadRequest(new { error = "invalid overlay file type" });
    }

    var absolutePath = Path.Combine(videoOverlayDir, safeFileName);
    if (!File.Exists(absolutePath))
    {
        return Results.NotFound(new { error = "overlay not found" });
    }

    try
    {
        File.Delete(absolutePath);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = $"failed to delete overlay: {ex.Message}" });
    }

    await overlayNamesStore.UpdateAsync(names =>
    {
        names.Remove(safeFileName);
        return names;
    }, ct);

    return Results.Ok(new { deleted = true, fileName = safeFileName });
})
.DisableAntiforgery()
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

// --- Image edit endpoints ---
app.MapGet("/images", async Task<IResult> (CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    var history = await historyStore.ReadAsync(ct);
    var composites = await compositesStore.ReadAsync(ct);

    var items = new List<object>();
    foreach (var it in history)
    {
        items.Add(new
        {
            id = it.StoredName,
            name = it.OriginalName,
            type = "original",
            storedName = it.StoredName,
            url = it.OriginalRelativePath,
            previewUrl = it.PreviewRelativePath ?? it.OriginalRelativePath,
            thumbnailUrl = it.PreviewRelativePath ?? it.OriginalRelativePath,
            createdAt = it.CreatedAt
        });
    }

    foreach (var it in composites.Where(x => string.Equals(x.Kind, "edit", StringComparison.OrdinalIgnoreCase)))
    {
        var fileName = Path.GetFileName(it.RelativePath);
        items.Add(new
        {
            id = fileName,
            name = fileName,
            type = "saved",
            url = it.RelativePath,
            previewUrl = it.PreviewRelativePath ?? it.RelativePath,
            thumbnailUrl = it.PreviewRelativePath ?? it.RelativePath,
            createdAt = it.CreatedAt,
            editParams = it.EditParams
        });
    }

    return Results.Ok(items);
})
.DisableAntiforgery()
.Produces(StatusCodes.Status200OK);

app.MapPost("/images/{id}/render", async Task<IResult> (string id, ImageEditParams req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    var sourceInfo = await ResolveImageEditSourceAsync(id, ct);
    if (sourceInfo is null)
    {
        return Results.NotFound(new { error = "image not found" });
    }

    var fileName = $"{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.jpg";
    var outAbsolutePath = Path.Combine(editsPreviewDir, fileName);
    var relPath = $"edits-preview/{fileName}";

    var resolved = sourceInfo.Value;
    var image = await imagePipeline.LoadImageAsync(resolved.AbsolutePath, ct);
    imagePipeline.ApplyAdjustments(image, EnsureEditParams(req));
    await imagePipeline.SaveCanonicalJpegAtomicAsync(image, outAbsolutePath, resolved.AbsolutePath, ct);

    return Results.Ok(new { ok = true, relativePath = relPath });
})
.DisableAntiforgery()
.Accepts<ImageEditParams>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);

app.MapPost("/images/{id}/save-edit", async Task<IResult> (string id, ImageEditParams req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    var sourceInfo = await ResolveImageEditSourceAsync(id, ct);
    if (sourceInfo is null)
    {
        return Results.NotFound(new { error = "image not found" });
    }

    var createdAt = DateTimeOffset.UtcNow;
    var fileName = $"{createdAt:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.jpg";
    var outAbsolutePath = Path.Combine(editsDir, fileName);
    var relPath = $"edits/{fileName}";
    var previewPath = Path.Combine(editsPreviewDir, fileName);
    var previewRelativePath = $"edits-preview/{fileName}";

    var resolved = sourceInfo.Value;
    var image = await imagePipeline.LoadImageAsync(resolved.AbsolutePath, ct);
    var normalized = EnsureEditParams(req);
    imagePipeline.ApplyAdjustments(image, normalized);
    await imagePipeline.SaveCanonicalJpegAtomicAsync(image, outAbsolutePath, resolved.AbsolutePath, ct);
    await CreatePreviewImageAsync(outAbsolutePath, previewPath, PreviewWidthPx, imagePipeline, ct);

    await AppendCompositeAsync(
        compositesStore,
        new CompositeHistoryItem("edit", createdAt, relPath, resolved.Sources, previewRelativePath, normalized),
        ct);

    return Results.Ok(new { ok = true, kind = "edit", createdAt, relativePath = relPath, previewRelativePath });
})
.DisableAntiforgery()
.Accepts<ImageEditParams>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);

app.MapDelete("/images/{id}", async Task<IResult> (string id, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    var storedName = Path.GetFileName(id);
    if (string.Equals(storedName, id, StringComparison.Ordinal))
    {
        var removed = await RemoveHistoryEntryAsync(historyStore, storedName, ct);
        if (removed)
        {
            await DeleteAllFilesForStoredNameAsync(storedName, ct);
            return Results.Ok(new { ok = true });
        }
    }

    var removedComposite = await RemoveCompositeByFileNameAsync(compositesStore, storedName, ct);
    if (removedComposite)
    {
        TryDeleteFile(Path.Combine(editsDir, storedName));
        TryDeleteFile(Path.Combine(editsPreviewDir, storedName));
        return Results.Ok(new { ok = true });
    }

    return Results.NotFound(new { error = "image not found" });
})
.DisableAntiforgery()
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);

// --- Resize endpoint ---
// RU: Строит или возвращает кешированный ресайз по фиксированной ширине (1280/1920/2440).
// EN: Builds or returns a cached resized copy for fixed widths (1280/1920/2440).
app.MapPost("/resize", async Task<IResult> (ResizeRequest req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    if (req.Width <= 0)
    {
        return Results.BadRequest(new { error = "width must be > 0" });
    }

    if (!resizeWidths.Contains(req.Width))
    {
        return Results.BadRequest(new { error = "unsupported width" });
    }

    if (string.IsNullOrWhiteSpace(req.StoredName))
    {
        return Results.BadRequest(new { error = "storedName is required" });
    }

    // Защита от path traversal
    var storedName = Path.GetFileName(req.StoredName);
    if (!string.Equals(storedName, req.StoredName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    var originalAbsolutePath = Path.Combine(uploadDir, storedName);
    if (!File.Exists(originalAbsolutePath))
    {
        return Results.NotFound(new { error = "original file not found" });
    }

    // Проверим, что это изображение
    var info = await TryGetImageInfoAsync(originalAbsolutePath, ct);
    if (info.Width <= 0 || info.Height <= 0)
    {
        return Results.BadRequest(new { error = "file is not a supported image" });
    }

    // Разрешаем апскейл (пользователи хотят уметь увеличивать даже маленькие изображения)

    var outDir = Path.Combine(resizedDir, req.Width.ToString());
    Directory.CreateDirectory(outDir);

    var outPath = Path.Combine(outDir, storedName);
    var relPath = $"resized/{req.Width}/{storedName}";

    // Если уже есть — просто вернём ссылку и обновим историю (идемпотентно)
    if (File.Exists(outPath))
    {
        await UpsertResizedInHistoryAsync(historyStore, storedName, req.Width, relPath, ct);
        return Results.Ok(new { width = req.Width, relativePath = relPath });
    }

    // Ресайз
    await CreateResizedImageAsync(originalAbsolutePath, outPath, req.Width, imagePipeline, ct);
    await UpsertResizedInHistoryAsync(historyStore, storedName, req.Width, relPath, ct);

    return Results.Ok(new { width = req.Width, relativePath = relPath });
})
.DisableAntiforgery()
.Accepts<ResizeRequest>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

// --- Split endpoint ---
// RU: Склеивает две картинки в один кадр 1280x720 с белой полосой по центру от исходников upload-original/*.
// EN: Composes two images into a 1280x720 frame with a white divider, always from upload-original/*.
app.MapPost("/split", async Task<IResult> (SplitRequest req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    if (string.IsNullOrWhiteSpace(req.StoredNameA) || string.IsNullOrWhiteSpace(req.StoredNameB))
    {
        return Results.BadRequest(new { error = "storedNameA and storedNameB are required" });
    }

    // sanitize
    var storedNameA = Path.GetFileName(req.StoredNameA);
    var storedNameB = Path.GetFileName(req.StoredNameB);
    if (!string.Equals(storedNameA, req.StoredNameA, StringComparison.Ordinal)
        || !string.Equals(storedNameB, req.StoredNameB, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    // Split всегда использует ИСХОДНИКИ (upload-original/*), чтобы кроп не влиял на исходные материалы.
    // Для старых записей, где копии может не быть, используем fallback на upload/*.
    var srcAOrig = Path.Combine(uploadOriginalDir, storedNameA);
    var srcBOrig = Path.Combine(uploadOriginalDir, storedNameB);
    var srcAFallback = Path.Combine(uploadDir, storedNameA);
    var srcBFallback = Path.Combine(uploadDir, storedNameB);

    var srcA = File.Exists(srcAOrig) ? srcAOrig : srcAFallback;
    var srcB = File.Exists(srcBOrig) ? srcBOrig : srcBFallback;
    if (!File.Exists(srcA) || !File.Exists(srcB))
    {
        return Results.BadRequest(new { error = "original file not found" });
    }

    var infoA = await TryGetImageInfoAsync(srcA, ct);
    var infoB = await TryGetImageInfoAsync(srcB, ct);
    if (infoA.Width <= 0 || infoA.Height <= 0 || infoB.Width <= 0 || infoB.Height <= 0)
    {
        return Results.BadRequest(new { error = "file is not a supported image" });
    }

    const int outW = 1280;
    const int outH = 720;
    const int dividerW = 7;
    var leftW = (outW - dividerW) / 2; // 636
    var rightW = outW - dividerW - leftW; // 637

    var outFileName = MakeCompositeFileName();
    var outAbsolutePath = Path.Combine(splitDir, outFileName);
    var relPath = $"split/{outFileName}";

    try
    {
        using var left = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(leftW, outH, new SixLabors.ImageSharp.PixelFormats.Rgba32(0, 0, 0, 255));
        using var right = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(rightW, outH, new SixLabors.ImageSharp.PixelFormats.Rgba32(0, 0, 0, 255));

        static (int x, int y, int w, int h) MapRect(SplitViewRect r, int outHalfW, int outH)
        {
            var vw = r.ViewW <= 0 ? 1 : r.ViewW;
            var vh = r.ViewH <= 0 ? 1 : r.ViewH;

            // Используем единый коэффициент масштаба, чтобы избежать растяжения по одной оси
            // из-за мелких расхождений размеров вьюпорта.
            var sx = outHalfW / vw;
            var sy = outH / vh;
            var s = (sx + sy) / 2.0;

            var x = (int)Math.Round(r.X * s);
            var y = (int)Math.Round(r.Y * s);
            var w = (int)Math.Round(r.W * s);
            var h = (int)Math.Round(r.H * s);
            return (x, y, Math.Max(1, w), Math.Max(1, h));
        }

        static async Task DrawAsync(Image<SixLabors.ImageSharp.PixelFormats.Rgba32> canvas, string srcPath, SplitViewRect r, int outHalfW, int outH, CancellationToken ct)
        {
            var (x, y, w, h) = MapRect(r, outHalfW, outH);
            await using var input = File.OpenRead(srcPath);
            using var img = await Image.LoadAsync<SixLabors.ImageSharp.PixelFormats.Rgba32>(input, ct);
            img.Mutate(p => p.Resize(w, h));
            canvas.Mutate(p => p.DrawImage(img, new Point(x, y), 1f));
        }

        await DrawAsync(left, srcA, req.A, leftW, outH, ct);
        await DrawAsync(right, srcB, req.B, rightW, outH, ct);

        using var output = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(outW, outH, new SixLabors.ImageSharp.PixelFormats.Rgba32(0, 0, 0, 255));
        output.Mutate(p =>
        {
            p.DrawImage(left, new Point(0, 0), 1f);
            p.DrawImage(right, new Point(leftW + dividerW, 0), 1f);
        });

        // White divider (7px)
        var white = new SixLabors.ImageSharp.PixelFormats.Rgba32(255, 255, 255, 255);
        output.ProcessPixelRows(accessor =>
        {
            for (var yy = 0; yy < outH; yy++)
            {
                var row = accessor.GetRowSpan(yy);
                for (var xx = leftW; xx < leftW + dividerW; xx++)
                {
                    row[xx] = white;
                }
            }
        });

        await imagePipeline.SaveCanonicalJpegAtomicAsync(output, outAbsolutePath, "split", ct);

        var createdAt = DateTimeOffset.UtcNow;
        await AppendCompositeAsync(
            compositesStore,
            new CompositeHistoryItem("split", createdAt, relPath, new[] { storedNameA, storedNameB }),
            ct);

        return Results.Ok(new { ok = true, kind = "split", createdAt, relativePath = relPath });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.DisableAntiforgery()
.Accepts<SplitRequest>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest);

// --- Split3 endpoint ---
// RU: Склеивает три картинки в один кадр 1280x720 с двумя белыми полосами.
// EN: Composes three images into a 1280x720 frame with two white dividers.
app.MapPost("/split3", async Task<IResult> (Split3Request req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    if (string.IsNullOrWhiteSpace(req.StoredNameA)
        || string.IsNullOrWhiteSpace(req.StoredNameB)
        || string.IsNullOrWhiteSpace(req.StoredNameC))
    {
        return Results.BadRequest(new { error = "storedNameA, storedNameB and storedNameC are required" });
    }

    // sanitize
    var storedNameA = Path.GetFileName(req.StoredNameA);
    var storedNameB = Path.GetFileName(req.StoredNameB);
    var storedNameC = Path.GetFileName(req.StoredNameC);
    if (!string.Equals(storedNameA, req.StoredNameA, StringComparison.Ordinal)
        || !string.Equals(storedNameB, req.StoredNameB, StringComparison.Ordinal)
        || !string.Equals(storedNameC, req.StoredNameC, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    // Split3 тоже всегда использует ИСХОДНИКИ (upload-original/*).
    // Для старых записей fallback на upload/*.
    var srcAOrig = Path.Combine(uploadOriginalDir, storedNameA);
    var srcBOrig = Path.Combine(uploadOriginalDir, storedNameB);
    var srcCOrig = Path.Combine(uploadOriginalDir, storedNameC);
    var srcAFallback = Path.Combine(uploadDir, storedNameA);
    var srcBFallback = Path.Combine(uploadDir, storedNameB);
    var srcCFallback = Path.Combine(uploadDir, storedNameC);

    var srcA = File.Exists(srcAOrig) ? srcAOrig : srcAFallback;
    var srcB = File.Exists(srcBOrig) ? srcBOrig : srcBFallback;
    var srcC = File.Exists(srcCOrig) ? srcCOrig : srcCFallback;
    if (!File.Exists(srcA) || !File.Exists(srcB) || !File.Exists(srcC))
    {
        return Results.BadRequest(new { error = "original file not found" });
    }

    var infoA = await TryGetImageInfoAsync(srcA, ct);
    var infoB = await TryGetImageInfoAsync(srcB, ct);
    var infoC = await TryGetImageInfoAsync(srcC, ct);
    if (infoA.Width <= 0 || infoA.Height <= 0
        || infoB.Width <= 0 || infoB.Height <= 0
        || infoC.Width <= 0 || infoC.Height <= 0)
    {
        return Results.BadRequest(new { error = "file is not a supported image" });
    }

    const int outW = 1280;
    const int outH = 720;
    const int dividerW = 7;
    var panelW = (outW - (dividerW * 2)) / 3; // (1280 - 14) / 3 = 422

    var outFileName = MakeCompositeFileName();
    var outAbsolutePath = Path.Combine(split3Dir, outFileName);
    var relPath = $"split3/{outFileName}";

    try
    {
        using var p1 = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(panelW, outH, new SixLabors.ImageSharp.PixelFormats.Rgba32(0, 0, 0, 255));
        using var p2 = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(panelW, outH, new SixLabors.ImageSharp.PixelFormats.Rgba32(0, 0, 0, 255));
        using var p3 = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(panelW, outH, new SixLabors.ImageSharp.PixelFormats.Rgba32(0, 0, 0, 255));

        static (int x, int y, int w, int h) MapRect(SplitViewRect r, int outPanelW, int outH)
        {
            var vw = r.ViewW <= 0 ? 1 : r.ViewW;
            var vh = r.ViewH <= 0 ? 1 : r.ViewH;

            // То же самое для Split3: единый масштаб без растяжения по одной оси.
            var sx = outPanelW / vw;
            var sy = outH / vh;
            var s = (sx + sy) / 2.0;

            var x = (int)Math.Round(r.X * s);
            var y = (int)Math.Round(r.Y * s);
            var w = (int)Math.Round(r.W * s);
            var h = (int)Math.Round(r.H * s);
            return (x, y, Math.Max(1, w), Math.Max(1, h));
        }

        static async Task DrawAsync(Image<SixLabors.ImageSharp.PixelFormats.Rgba32> canvas, string srcPath, SplitViewRect r, int outPanelW, int outH, CancellationToken ct)
        {
            var (x, y, w, h) = MapRect(r, outPanelW, outH);
            await using var input = File.OpenRead(srcPath);
            using var img = await Image.LoadAsync<SixLabors.ImageSharp.PixelFormats.Rgba32>(input, ct);
            img.Mutate(p => p.Resize(w, h));
            canvas.Mutate(p => p.DrawImage(img, new Point(x, y), 1f));
        }

        await DrawAsync(p1, srcA, req.A, panelW, outH, ct);
        await DrawAsync(p2, srcB, req.B, panelW, outH, ct);
        await DrawAsync(p3, srcC, req.C, panelW, outH, ct);

        using var output = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(outW, outH, new SixLabors.ImageSharp.PixelFormats.Rgba32(0, 0, 0, 255));
        output.Mutate(p =>
        {
            p.DrawImage(p1, new Point(0, 0), 1f);
            p.DrawImage(p2, new Point(panelW + dividerW, 0), 1f);
            p.DrawImage(p3, new Point((panelW + dividerW) * 2, 0), 1f);
        });

        // White dividers (2 x 7px)
        var white = new SixLabors.ImageSharp.PixelFormats.Rgba32(255, 255, 255, 255);
        var x1 = panelW;
        var x2 = panelW + dividerW + panelW;
        output.ProcessPixelRows(accessor =>
        {
            for (var yy = 0; yy < outH; yy++)
            {
                var row = accessor.GetRowSpan(yy);
                for (var xx = x1; xx < x1 + dividerW; xx++)
                {
                    row[xx] = white;
                }
                for (var xx = x2; xx < x2 + dividerW; xx++)
                {
                    row[xx] = white;
                }
            }
        });

        await imagePipeline.SaveCanonicalJpegAtomicAsync(output, outAbsolutePath, "split3", ct);

        var createdAt = DateTimeOffset.UtcNow;
        await AppendCompositeAsync(
            compositesStore,
            new CompositeHistoryItem("split3", createdAt, relPath, new[] { storedNameA, storedNameB, storedNameC }),
            ct);

        return Results.Ok(new { ok = true, kind = "split3", createdAt, relativePath = relPath });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.DisableAntiforgery()
.Accepts<Split3Request>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest);

// --- Crop endpoint ---
// RU: Кадрирует изображение по координатам из UI, пересоздаёт preview и сбрасывает все ресайзы/сплиты.
// EN: Crops an image using UI coordinates, regenerates preview and invalidates resized/split outputs.
app.MapPost("/crop", async Task<IResult> (CropRequest req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    if (string.IsNullOrWhiteSpace(req.StoredName))
    {
        return Results.BadRequest(new { error = "storedName is required" });
    }

    // Защита от path traversal
    var storedName = Path.GetFileName(req.StoredName);
    if (!string.Equals(storedName, req.StoredName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    if (req.Width <= 0 || req.Height <= 0)
    {
        return Results.BadRequest(new { error = "invalid crop size" });
    }

    var outAbsolutePath = Path.Combine(uploadDir, storedName);
    if (!File.Exists(outAbsolutePath))
    {
        return Results.NotFound(new { error = "original file not found" });
    }

    // Всегда пытаемся резать от неизменённого исходника (upload-original/...).
    // Для старых записей (до введения upload-original) создаём эту копию перед тем, как перезаписать upload/.
    var sourceAbsolutePath = Path.Combine(uploadOriginalDir, storedName);
    if (!File.Exists(sourceAbsolutePath))
    {
        try
        {
            // This preserves the pre-crop state for legacy items.
            File.Copy(outAbsolutePath, sourceAbsolutePath);
        }
        catch
        {
            // ignore (we'll fallback)
        }
    }

    if (!File.Exists(sourceAbsolutePath))
    {
        // Fallback (если копию не удалось создать или storage read-only)
        sourceAbsolutePath = outAbsolutePath;
    }

    // Загружаем изображение
    Image image;
    await using (var input = new FileStream(sourceAbsolutePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
    {
        image = await Image.LoadAsync(input, ct);
    }

    using (image)
    {
        var imgW = image.Width;
        var imgH = image.Height;
        if (imgW <= 0 || imgH <= 0)
        {
            return Results.BadRequest(new { error = "invalid image" });
        }

        // Клэмпим прямоугольник в границы
        var x = Math.Clamp(req.X, 0, imgW - 1);
        var y = Math.Clamp(req.Y, 0, imgH - 1);
        var w = Math.Clamp(req.Width, 1, imgW - x);
        var h = Math.Clamp(req.Height, 1, imgH - y);

        // Переклэмпим после расчёта
        if (x + w > imgW) w = imgW - x;
        if (y + h > imgH) h = imgH - y;

        image.Mutate(ctx => ctx.Crop(new Rectangle(x, y, w, h)));

        // Сохраняем результат в upload/<storedName> (атомарно)
        await imagePipeline.SaveCanonicalJpegAtomicAsync(image, outAbsolutePath, "crop", ct);

        // Пересоздаём preview
        var previewAbsolutePath = Path.Combine(previewDir, storedName);
        await CreatePreviewImageAsync(outAbsolutePath, previewAbsolutePath, PreviewWidthPx, imagePipeline, ct);

        // Удаляем все ресайзы, т.к. они больше не соответствуют новому оригиналу
        foreach (var rw in resizeWidths)
        {
            TryDeleteFile(Path.Combine(resizedDir, rw.ToString(), storedName));
        }

        // Удаляем старые split/split3 + composites, созданные из этого изображения.
        TryDeleteFile(Path.Combine(splitDir, GetSplitFileName(storedName)));
        TryDeleteFile(Path.Combine(split3Dir, GetSplit3FileName(storedName)));
        await DeleteCompositesForStoredNameAsync(storedName, ct);

        // Обновляем историю: размеры и сброс resized
        await UpdateHistoryAfterCropAsync(historyStore, storedName, w, h, ct);

        return Results.Ok(new
        {
            ok = true,
            storedName,
            imageWidth = w,
            imageHeight = h,
            previewRelativePath = $"preview/{storedName}",
            originalRelativePath = $"upload/{storedName}",
            originalSourceRelativePath = $"upload-original/{storedName}"
        });
    }
})
.DisableAntiforgery()
.Accepts<CropRequest>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

// --- OknoFix (/oknofix) endpoint ---
// RU: Вырезает окно из исходника и помещает под PNG-шаблон вертикальной карточки.
// EN: Crops a window from the original image and places it under the fixed PNG card template.
app.MapPost("/oknofix", async Task<IResult> (WindowCropRequest req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    if (string.IsNullOrWhiteSpace(req.StoredName))
    {
        return Results.BadRequest(new { error = "storedName is required" });
    }

    var storedName = Path.GetFileName(req.StoredName);
    if (!string.Equals(storedName, req.StoredName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    // OknoFix всегда должен работать с исходным файлом (upload-original/*),
    // чтобы кроп оригинала не влиял на шаблонные карточки.
    var originalPathOrig = Path.Combine(uploadOriginalDir, storedName);
    var originalPathFallback = Path.Combine(uploadDir, storedName);
    var originalPath = File.Exists(originalPathOrig) ? originalPathOrig : originalPathFallback;
    if (!File.Exists(originalPath))
    {
        return Results.NotFound(new { error = "original file not found" });
    }

    try
    {
        // 1) Кадр: режем исходник по прямоугольнику из UI (в координатах оригинала).
        using var src = await Image.LoadAsync<SixLabors.ImageSharp.PixelFormats.Rgba32>(originalPath, ct);

        var imgW = src.Width;
        var imgH = src.Height;
        if (imgW <= 0 || imgH <= 0)
        {
            return Results.BadRequest(new { error = "invalid image" });
        }

        var x = (int)Math.Round(req.X);
        var y = (int)Math.Round(req.Y);
        var w = (int)Math.Round(req.W);
        var h = (int)Math.Round(req.H);

        if (w <= 0 || h <= 0)
        {
            return Results.BadRequest(new { error = "invalid crop rect" });
        }

        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x >= imgW) x = imgW - 1;
        if (y >= imgH) y = imgH - 1;

        if (x + w > imgW) w = imgW - x;
        if (y + h > imgH) h = imgH - y;

        if (w <= 0 || h <= 0)
        {
            return Results.BadRequest(new { error = "empty crop after clamp" });
        }

        using var cropped = src.Clone(ctx => ctx.Crop(new Rectangle(x, y, w, h)));

        // 2) Готовим полотно под PNG-шаблон.
        SixLabors.ImageSharp.Image<SixLabors.ImageSharp.PixelFormats.Rgba32>? baseOverlay = null;
        int outW;
        int outH;

        if (File.Exists(oknoFixOverlayPath))
        {
            baseOverlay = await Image.LoadAsync<SixLabors.ImageSharp.PixelFormats.Rgba32>(oknoFixOverlayPath, ct);
            outW = baseOverlay.Width;
            outH = baseOverlay.Height;
        }
        else
        {
            // Fallback: если PNG исчез — рендерим простую карточку 1920x1080.
            outW = 1920;
            outH = 1080;
        }

        // Область, в которую должен вписаться кадр внутри шаблона — внутреннее окно PNG.
        // Координаты окна заданы в пикселях для исходного PNG 1920x1080:
        // windowX = 593, windowY = 79, windowW = 735, windowH = 922.
        const double templateW = 1920.0;
        const double templateH = 1080.0;
        const double windowPxX = 593.0;
        const double windowPxY = 79.0;
        const double windowPxW = 735.0;
        const double windowPxH = 922.0;

        // Масштабируем геометрию окна под фактический размер PNG (outW/outH).
        var scaleX = outW / templateW;
        var scaleY = outH / templateH;
        var k = (scaleX + scaleY) / 2.0;

        var winX = windowPxX * k;
        var winY = windowPxY * k;
        var winW = windowPxW * k;
        var winH = windowPxH * k;

        // Масштабируем кроп так, чтобы он заполнил окно без искажений.
        var scaleToHeight = winH / h;
        var scaleToWidth = winW / w;
        var scaleCrop = (scaleToHeight + scaleToWidth) / 2.0;

        var targetW = (int)Math.Round(w * scaleCrop);
        var targetH = (int)Math.Round(h * scaleCrop);

        // Если после округления отличия от окна маленькие — приравниваем к размеру окна.
        if (Math.Abs(targetW - winW) <= 2 && Math.Abs(targetH - winH) <= 2)
        {
            targetW = (int)Math.Round(winW);
            targetH = (int)Math.Round(winH);
        }

        if (targetW < 1) targetW = 1;
        if (targetH < 1) targetH = 1;

        cropped.Mutate(p => p.Resize(targetW, targetH));

        var bgColor = new SixLabors.ImageSharp.PixelFormats.Rgba32(243, 244, 246, 255);
        using var output = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(outW, outH, bgColor);

        // Выравниваем отмасштабированный кадр по окну внутри PNG.
        var dstX = (int)Math.Round(winX + (winW - targetW) / 2.0);
        var dstY = (int)Math.Round(winY + (winH - targetH) / 2.0);

        // Сначала рисуем кропнутую картинку, затем поверх неё — PNG-шаблон
        output.Mutate(p => p.DrawImage(cropped, new Point(dstX, dstY), 1f));

        if (baseOverlay != null)
        {
            output.Mutate(p => p.DrawImage(baseOverlay, new Point(0, 0), 1f));
            baseOverlay.Dispose();
        }

        var fileName = MakeCompositeFileName();
        var outAbsolutePath = Path.Combine(oknoFixDir, fileName);
        var relPath = $"oknofix/{fileName}";

        await imagePipeline.SaveCanonicalJpegAtomicAsync(output, outAbsolutePath, "oknofix", ct);

        var createdAt = DateTimeOffset.UtcNow;
        await AppendCompositeAsync(
            compositesStore,
            new CompositeHistoryItem("oknofix", createdAt, relPath, new[] { storedName }),
            ct);

        return Results.Ok(new { ok = true, kind = "oknofix", createdAt, relativePath = relPath });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.DisableAntiforgery()
.Accepts<WindowCropRequest>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

// --- OknoScale endpoint ---
// RU: Делает вариативную вертикальную карточку с изменяемой шириной окна и скруглёнными углами.
// EN: Builds an experimental vertical card with adjustable window width and rounded corners.
app.MapPost("/oknoscale", async Task<IResult> (WindowCropRequest req, ImagePipelineService imagePipeline, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);

    if (string.IsNullOrWhiteSpace(req.StoredName))
    {
        return Results.BadRequest(new { error = "storedName is required" });
    }

    var storedName = Path.GetFileName(req.StoredName);
    if (!string.Equals(storedName, req.StoredName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    // OknoScale также должен всегда опираться на исходник (upload-original/*).
    var originalPathOrig = Path.Combine(uploadOriginalDir, storedName);
    var originalPathFallback = Path.Combine(uploadDir, storedName);
    var originalPath = File.Exists(originalPathOrig) ? originalPathOrig : originalPathFallback;
    if (!File.Exists(originalPath))
    {
        return Results.NotFound(new { error = "original file not found" });
    }

    try
    {
        using var src = await Image.LoadAsync<SixLabors.ImageSharp.PixelFormats.Rgba32>(originalPath, ct);

        var imgW = src.Width;
        var imgH = src.Height;
        if (imgW <= 0 || imgH <= 0)
        {
            return Results.BadRequest(new { error = "invalid image" });
        }

        var x = (int)Math.Round(req.X);
        var y = (int)Math.Round(req.Y);
        var w = (int)Math.Round(req.W);
        var h = (int)Math.Round(req.H);

        if (w <= 0 || h <= 0)
        {
            return Results.BadRequest(new { error = "invalid crop rect" });
        }

        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x >= imgW) x = imgW - 1;
        if (y >= imgH) y = imgH - 1;

        if (x + w > imgW) w = imgW - x;
        if (y + h > imgH) h = imgH - y;

        if (w <= 0 || h <= 0)
        {
            return Results.BadRequest(new { error = "empty crop after clamp" });
        }

        using var cropped = src.Clone(ctx => ctx.Crop(new Rectangle(x, y, w, h)));

        const int outW = 1920;
        const int outH = 1080;

        // Масштабируем кроп в центральное окно с однотонным фоном.
        var bgColor = new SixLabors.ImageSharp.PixelFormats.Rgba32(243, 244, 246, 255);
        using var output = new Image<SixLabors.ImageSharp.PixelFormats.Rgba32>(outW, outH, bgColor);

        // Максимальный размер центрального окна ~90% от кадра, без искажений.
        var maxContentW = outW * 0.9;
        var maxContentH = outH * 0.9;
        var scaleToW = maxContentW / w;
        var scaleToH = maxContentH / h;
        var scale = Math.Min(scaleToW, scaleToH);
        if (scale <= 0) scale = 1;

        var targetW = (int)Math.Round(w * scale);
        var targetH = (int)Math.Round(h * scale);
        if (targetW < 1) targetW = 1;
        if (targetH < 1) targetH = 1;

        cropped.Mutate(p => p.Resize(targetW, targetH));

        var dstX = (outW - targetW) / 2;
        var dstY = (outH - targetH) / 2;

        // Рисуем кроп по центру
        output.Mutate(p => p.DrawImage(cropped, new Point(dstX, dstY), 1f));

        // Скругляем только углы центрального окна (там, где лежит картинка), а не всю карточку.
        const int baseCornerRadius = 8; // ещё в ~2 раза меньше
        var r = Math.Min(baseCornerRadius, Math.Min(targetW, targetH) / 2);
        var r2 = r * r;

        var left = dstX;
        var right = dstX + targetW - 1;
        var top = dstY;
        var bottom = dstY + targetH - 1;
        var cxLeft = left + r;
        var cxRight = right - r;
        var cyTop = top + r;
        var cyBottom = bottom - r;

        output.ProcessPixelRows(accessor =>
        {
            for (var yy = top; yy <= bottom; yy++)
            {
                var row = accessor.GetRowSpan(yy);
                for (var xx = left; xx <= right; xx++)
                {
                    bool outside = false;

                    if (xx < cxLeft && yy < cyTop)
                    {
                        var dx = cxLeft - xx;
                        var dy = cyTop - yy;
                        outside = dx * dx + dy * dy > r2;
                    }
                    else if (xx > cxRight && yy < cyTop)
                    {
                        var dx = xx - cxRight;
                        var dy = cyTop - yy;
                        outside = dx * dx + dy * dy > r2;
                    }
                    else if (xx < cxLeft && yy > cyBottom)
                    {
                        var dx = cxLeft - xx;
                        var dy = yy - cyBottom;
                        outside = dx * dx + dy * dy > r2;
                    }
                    else if (xx > cxRight && yy > cyBottom)
                    {
                        var dx = xx - cxRight;
                        var dy = yy - cyBottom;
                        outside = dx * dx + dy * dy > r2;
                    }

                    if (outside)
                    {
                        // Затираем угол обратно цветом фона, чтобы углы картинки стали визуально скруглёнными.
                        row[xx] = bgColor;
                    }
                }
            }
        });

        // PNG, чтобы сохранить аккуратные края центрального окна.
        var createdAt = DateTimeOffset.UtcNow;
        var fileName = $"{createdAt:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.png";
        var outAbsolutePath = Path.Combine(oknoScaleDir, fileName);
        var relPath = $"oknoscale/{fileName}";

        await imagePipeline.SaveCanonicalJpegAtomicAsync(output, outAbsolutePath, "oknoscale", ct);

        await AppendCompositeAsync(
            compositesStore,
            new CompositeHistoryItem("oknoscale", createdAt, relPath, new[] { storedName }),
            ct);

        return Results.Ok(new { ok = true, kind = "oknoscale", createdAt, relativePath = relPath });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
})
.DisableAntiforgery()
.Accepts<WindowCropRequest>("application/json")
.RequireRateLimiting("media")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

// --- Video processing endpoint ---
app.MapPost("/video-process", (VideoProcessRequest req, HttpContext http, IFfmpegJobQueue queue) =>
{
    var clipByStoredName = new Dictionary<string, VideoProcessClip>(StringComparer.Ordinal);
    if (req.SourceClips is not null)
    {
        foreach (var rawClip in req.SourceClips)
        {
            if (rawClip is null)
            {
                return Results.BadRequest(new { error = "invalid sourceClips" });
            }

            var clipStoredName = Path.GetFileName(rawClip.StoredName ?? string.Empty);
            if (string.IsNullOrWhiteSpace(clipStoredName) || !string.Equals(clipStoredName, rawClip.StoredName, StringComparison.Ordinal))
            {
                return Results.BadRequest(new { error = "invalid sourceClips" });
            }

            if (clipByStoredName.ContainsKey(clipStoredName))
            {
                continue;
            }

            clipByStoredName[clipStoredName] = rawClip with { StoredName = clipStoredName };
        }
    }

    var sourceStoredNames = new List<string>();
    var sourceSeen = new HashSet<string>(StringComparer.Ordinal);
    if (req.SourceStoredNames is not null)
    {
        foreach (var raw in req.SourceStoredNames)
        {
            var candidate = Path.GetFileName(raw ?? string.Empty);
            if (string.IsNullOrWhiteSpace(candidate) || !string.Equals(candidate, raw, StringComparison.Ordinal))
            {
                return Results.BadRequest(new { error = "invalid sourceStoredNames" });
            }

            if (sourceSeen.Add(candidate))
            {
                sourceStoredNames.Add(candidate);
            }
        }
    }

    if (sourceStoredNames.Count == 0 && clipByStoredName.Count > 0)
    {
        sourceStoredNames.AddRange(clipByStoredName.Keys);
    }

    if (sourceStoredNames.Count == 0)
    {
        var storedName = Path.GetFileName(req.StoredName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(storedName) || !string.Equals(storedName, req.StoredName, StringComparison.Ordinal))
        {
            return Results.BadRequest(new { error = "invalid storedName" });
        }

        sourceStoredNames.Add(storedName);
    }

    var normalizedSourceClips = sourceStoredNames
        .Select(name =>
        {
            if (clipByStoredName.TryGetValue(name, out var clip))
            {
                return clip;
            }
            return new VideoProcessClip(name, null, null, null);
        })
        .ToArray();

    var inputPaths = new List<string>(sourceStoredNames.Count);
    foreach (var sourceStoredName in sourceStoredNames)
    {
        var inputPath = Path.Combine(videoDir, sourceStoredName);
        if (!File.Exists(inputPath))
        {
            return Results.NotFound(new { error = "video not found", storedName = sourceStoredName });
        }

        inputPaths.Add(inputPath);
    }

    var createdAt = DateTimeOffset.UtcNow;
    var outName = $"{createdAt:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.mp4";
    var outPath = Path.Combine(videoOutDir, outName);

    string? overlayRelativePath = null;
    if (!string.IsNullOrWhiteSpace(req.OverlayTemplateRelativePath))
    {
        var expectedPrefix = "video-overlays/";
        var normalized = req.OverlayTemplateRelativePath.Replace('\\', '/');
        if (!normalized.StartsWith(expectedPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { error = "invalid overlay path" });
        }

        var fileName = Path.GetFileName(normalized);
        if (string.IsNullOrWhiteSpace(fileName) || !string.Equals(normalized, $"{expectedPrefix}{fileName}", StringComparison.OrdinalIgnoreCase))
        {
            return Results.BadRequest(new { error = "invalid overlay path" });
        }

        var overlayAbsolutePath = Path.Combine(videoOverlayDir, fileName);
        if (!File.Exists(overlayAbsolutePath))
        {
            return Results.BadRequest(new { error = "overlay not found" });
        }

        overlayRelativePath = $"{expectedPrefix}{fileName}";
    }

    var correlationId = http.TraceIdentifier;
    var reqForJob = req with
    {
        StoredName = sourceStoredNames[0],
        SourceStoredNames = sourceStoredNames.ToArray(),
        SourceClips = normalizedSourceClips,
        OverlayTemplateRelativePath = overlayRelativePath
    };
    var enqueue = queue.Enqueue(reqForJob, inputPaths, outPath, correlationId);
    if (!enqueue.Accepted && enqueue.QueueFull)
    {
        return Results.Json(new { error = "Queue is full" }, statusCode: StatusCodes.Status429TooManyRequests);
    }

    return Results.Accepted($"/video/jobs/{enqueue.Job!.JobId}", new
    {
        jobId = enqueue.Job!.JobId,
        status = enqueue.Job.Status,
        createdAt = enqueue.Job.CreatedAtUtc,
        ttlAt = enqueue.Job.TtlAtUtc
    });
})
.DisableAntiforgery()
.RequireRateLimiting("media")
.Accepts<VideoProcessRequest>("application/json")
.Produces(StatusCodes.Status202Accepted)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound)
.Produces(StatusCodes.Status429TooManyRequests);

app.MapGet("/video/jobs/{jobId:guid}", (Guid jobId, IFfmpegJobQueue queue) =>
{
    var job = queue.Get(jobId);
    if (job is null)
    {
        return Results.NotFound(new { error = "job not found" });
    }

    return Results.Ok(new
    {
        job.JobId,
        job.CreatedAtUtc,
        job.TtlAtUtc,
        job.RequestedMode,
        job.ResolvedMode,
        job.RamDecision,
        job.DurationSeconds,
        job.Status,
        job.Progress,
        job.Error,
        job.RelativeOutputPath
    });
})
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);

app.MapGet("/video/upload-jobs/{jobId:guid}", (Guid jobId, IUploadNormalizeQueue normalizeQueue) =>
{
    var job = normalizeQueue.Get(jobId);
    if (job is null)
    {
        return Results.NotFound(new { error = "job not found" });
    }

    if (job.TtlAtUtc <= DateTimeOffset.UtcNow)
    {
        return Results.NotFound(new { error = "job expired" });
    }

    return Results.Ok(new
    {
        job.JobId,
        job.CreatedAtUtc,
        job.UpdatedAtUtc,
        job.Status,
        progress = $"{Math.Clamp(job.ProgressPercent, 0, 100)}%",
        job.Error,
        job.StoredName,
        job.RelativePath,
        job.Size,
        job.DurationSeconds
    });
})
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);

app.MapPost("/video/upload-jobs/{jobId:guid}/cancel", (Guid jobId, IUploadNormalizeQueue normalizeQueue) =>
    normalizeQueue.Cancel(jobId)
        ? Results.Ok(new { ok = true, jobId })
        : Results.NotFound(new { error = "job not found or cannot be canceled" }))
.DisableAntiforgery()
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);

app.MapPost("/video/jobs/{jobId:guid}/cancel", (Guid jobId, IFfmpegJobQueue queue) =>
{
    var canceled = queue.Cancel(jobId);
    if (!canceled)
    {
        return Results.NotFound(new { error = "job not found or cannot be canceled" });
    }

    return Results.Ok(new { ok = true, jobId });
})
.DisableAntiforgery()
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status404NotFound);

// --- Video history endpoints ---
app.MapGet("/video-history", async Task<IResult> (CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    var items = await videoHistoryStore.ReadAsync(ct);

    var knownProcessed = new HashSet<string>(
        items.Where(x => string.Equals(x.Kind, "processed", StringComparison.OrdinalIgnoreCase))
             .Select(x => x.StoredName),
        StringComparer.OrdinalIgnoreCase);

    var discoveredProcessed = new List<VideoHistoryItem>();
    foreach (var filePath in Directory.EnumerateFiles(videoOutDir, "*.mp4", SearchOption.TopDirectoryOnly))
    {
        var fileName = Path.GetFileName(filePath);
        if (knownProcessed.Contains(fileName))
        {
            continue;
        }

        var info = new FileInfo(filePath);
        var createdAt = new DateTimeOffset(info.CreationTimeUtc, TimeSpan.Zero);
        var duration = await TryGetVideoDurationSecondsAsync(filePath, ct);

        discoveredProcessed.Add(new VideoHistoryItem(
            Kind: "processed",
            StoredName: fileName,
            OriginalName: fileName,
            CreatedAt: createdAt,
            Size: info.Length,
            RelativePath: $"video-out/{fileName}",
            DurationSeconds: duration
        ));
    }

    if (discoveredProcessed.Count > 0)
    {
        await videoHistoryStore.UpdateAsync(current =>
        {
            var known = new HashSet<string>(current.Select(x => x.StoredName), StringComparer.OrdinalIgnoreCase);
            current.AddRange(discoveredProcessed.Where(x => known.Add(x.StoredName)));
            return current;
        }, ct);
        items = await videoHistoryStore.ReadAsync(ct);
    }

    return Results.Ok(items.OrderByDescending(x => x.CreatedAt));
})
.Produces(StatusCodes.Status200OK);

app.MapPost("/delete-video", async Task<IResult> (VideoDeleteRequest req, CancellationToken ct) =>
{
    await PruneExpiredAsync(ct);
    if (string.IsNullOrWhiteSpace(req.StoredName))
    {
        return Results.BadRequest(new { error = "storedName is required" });
    }

    var storedName = Path.GetFileName(req.StoredName);
    if (!string.Equals(storedName, req.StoredName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "invalid storedName" });
    }

    var removed = await RemoveVideoHistoryEntryAsync(videoHistoryStore, storedName, ct);
    if (removed is null)
    {
        return Results.NotFound(new { error = "not found" });
    }

    DeleteVideoFilesForEntry(removed, videoDir, videoOutDir);
    return Results.Ok(new { ok = true, storedName });
})
.DisableAntiforgery()
.Accepts<VideoDeleteRequest>("application/json")
.Produces(StatusCodes.Status200OK)
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status404NotFound);

app.Run();

static bool HasCommand(string name)
{
    try
    {
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "which",
            Arguments = name,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        using var p = System.Diagnostics.Process.Start(psi);
        if (p is null) return false;
        p.WaitForExit(2000);
        return p.ExitCode == 0;
    }
    catch
    {
        return false;
    }
}

static async Task<double> TryGetVideoDurationSecondsAsync(string absolutePath, CancellationToken ct, Microsoft.Extensions.Logging.ILogger? logger = null)
{
    if (!HasCommand("ffprobe"))
    {
        return 0;
    }

    var args = new List<string>
    {
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        absolutePath
    };

    var result = await RunProcessAsync("ffprobe", args, ct, logger, "ffprobe duration");
    if (!result.Success || string.IsNullOrWhiteSpace(result.Output))
    {
        return 0;
    }

    if (double.TryParse(result.Output.Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var duration))
    {
        return duration;
    }

    return 0;
}

static int GetEnvInt(string name, int fallback)
{
    var raw = Environment.GetEnvironmentVariable(name);
    if (!string.IsNullOrWhiteSpace(raw) && int.TryParse(raw, out var parsed))
    {
        return parsed;
    }
    return fallback;
}

static async Task<ProcessResult> RunProcessAsync(
    string fileName,
    List<string> args,
    CancellationToken ct,
    Microsoft.Extensions.Logging.ILogger? logger = null,
    string? context = null,
    Action<int>? exitCodeCallback = null,
    Action<string>? stderrLineCallback = null)
{
    var psi = new System.Diagnostics.ProcessStartInfo
    {
        FileName = fileName,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
        UseShellExecute = false,
        CreateNoWindow = true
    };

    foreach (var arg in args)
    {
        psi.ArgumentList.Add(arg);
    }

    // Build command string for logging (safely)
    var argsStr = string.Join(" ", args.Select(a => a.Contains(' ') ? $"\"{a}\"" : a));
    var contextPrefix = !string.IsNullOrEmpty(context) ? $"{context}: " : "";

    logger?.LogInformation("{Context}FFMPEG START: {FileName} {Arguments}", contextPrefix, fileName, argsStr);

    using var process = new System.Diagnostics.Process { StartInfo = psi };
    var started = process.Start();
    if (!started)
    {
        logger?.LogError("{Context}FFMPEG FAILED: process failed to start", contextPrefix);
        return new ProcessResult(false, string.Empty, "failed to start process");
    }

    var outputBuilder = new System.Text.StringBuilder();
    var errorBuilder = new System.Text.StringBuilder();
    var lastActivityUtc = DateTimeOffset.UtcNow;

    process.OutputDataReceived += (_, e) =>
    {
        if (e.Data is null) return;
        outputBuilder.AppendLine(e.Data);
        lastActivityUtc = DateTimeOffset.UtcNow;
    };
    process.ErrorDataReceived += (_, e) =>
    {
        if (e.Data is null) return;
        errorBuilder.AppendLine(e.Data);
        stderrLineCallback?.Invoke(e.Data);
        lastActivityUtc = DateTimeOffset.UtcNow;
    };
    process.BeginOutputReadLine();
    process.BeginErrorReadLine();

    var timeoutSec = Math.Clamp(GetEnvInt("JMAKA_FFMPEG_TIMEOUT_SEC", 1800), 60, 7200);
    var idleTimeoutSec = Math.Clamp(GetEnvInt("JMAKA_FFMPEG_IDLE_TIMEOUT_SEC", 120), 15, timeoutSec);
    var startedAtUtc = DateTimeOffset.UtcNow;
    var timedOut = false;
    var stalled = false;

    while (!process.HasExited)
    {
        ct.ThrowIfCancellationRequested();

        var now = DateTimeOffset.UtcNow;
        if ((now - startedAtUtc).TotalSeconds > timeoutSec)
        {
            timedOut = true;
            break;
        }
        if ((now - lastActivityUtc).TotalSeconds > idleTimeoutSec)
        {
            stalled = true;
            break;
        }

        await Task.Delay(500, ct);
    }

    if (timedOut || stalled)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // ignore kill errors
        }
    }

    try
    {
        if (!process.HasExited)
        {
            await process.WaitForExitAsync(ct);
        }
    }
    catch (OperationCanceledException)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // ignore
        }
        throw;
    }

    var output = outputBuilder.ToString();
    var error = errorBuilder.ToString();

    if (timedOut)
    {
        var msg = $"process timeout after {timeoutSec}s";
        logger?.LogError("{Context}FFMPEG TIMEOUT: {Message}", contextPrefix, msg);
        return new ProcessResult(false, output, string.IsNullOrWhiteSpace(error) ? msg : error);
    }
    if (stalled)
    {
        var msg = $"process stalled: no output for {idleTimeoutSec}s";
        logger?.LogError("{Context}FFMPEG STALLED: {Message}", contextPrefix, msg);
        return new ProcessResult(false, output, string.IsNullOrWhiteSpace(error) ? msg : error);
    }

    // Track exit code via callback (used for FFmpeg OOM detection)
    exitCodeCallback?.Invoke(process.ExitCode);

    // Detect OOM killer first (exit code 137 = 128 + SIGKILL(9))
    if (process.ExitCode == 137)
    {
        logger?.LogError("{Context}FFMPEG KILLED BY OOM: Process terminated by system OOM killer (exit code 137). Server likely ran out of memory.", contextPrefix);
        return new ProcessResult(false, output, "Process killed by OOM killer (exit code 137). Server ran out of memory.");
    }

    var success = process.ExitCode == 0;

    if (success)
    {
        logger?.LogDebug("{Context}FFMPEG SUCCESS (exit code 0)", contextPrefix);
        if (!string.IsNullOrEmpty(output))
        {
            logger?.LogDebug("{Context}FFMPEG STDOUT: {Stdout}", contextPrefix, output);
        }
    }
    else
    {
        logger?.LogError("{Context}FFMPEG FAILED with exit code {ExitCode}", contextPrefix, process.ExitCode);
        if (!string.IsNullOrEmpty(error))
        {
            logger?.LogError("{Context}FFMPEG STDERR: {Stderr}", contextPrefix, error);
        }
        if (!string.IsNullOrEmpty(output))
        {
            logger?.LogError("{Context}FFMPEG STDOUT: {Stdout}", contextPrefix, output);
        }
    }

    return new ProcessResult(success, output, error);
}

static async Task<ImageInfo> TryGetImageInfoAsync(string absolutePath, CancellationToken ct)
{
    try
    {
        await using var input = File.OpenRead(absolutePath);
        using var image = await Image.LoadAsync(input, ct);
        return new ImageInfo(image.Width, image.Height);
    }
    catch
    {
        return new ImageInfo(0, 0);
    }
}

static async Task CreateResizedImageAsync(
    string originalAbsolutePath,
    string outAbsolutePath,
    int targetWidthPx,
    ImagePipelineService imagePipeline,
    CancellationToken ct)
{
    await using var input = File.OpenRead(originalAbsolutePath);
    using var image = await Image.LoadAsync(input, ct);

    var imageWidth = image.Width;
    var imageHeight = image.Height;

    if (imageWidth <= 0 || imageHeight <= 0)
    {
        throw new InvalidOperationException("Invalid image");
    }

    var newHeight = (int)Math.Round(imageHeight * (targetWidthPx / (double)imageWidth));
    newHeight = Math.Max(1, newHeight);

    image.Mutate(x => x.Resize(targetWidthPx, newHeight));

    await imagePipeline.SaveCanonicalJpegAtomicAsync(image, outAbsolutePath, originalAbsolutePath, ct);
}

static async Task CreatePreviewImageAsync(
    string originalAbsolutePath,
    string outAbsolutePath,
    int targetWidthPx,
    ImagePipelineService imagePipeline,
    CancellationToken ct)
{
    await using var input = File.OpenRead(originalAbsolutePath);
    using var image = await Image.LoadAsync(input, ct);

    if (image.Width <= 0 || image.Height <= 0)
    {
        return;
    }

    // Не апскейлим: если картинка уже меньше — просто копируем.
    if (targetWidthPx <= 0 || image.Width <= targetWidthPx)
    {
        File.Copy(originalAbsolutePath, outAbsolutePath, overwrite: true);
        return;
    }

    var newHeight = (int)Math.Round(image.Height * (targetWidthPx / (double)image.Width));
    newHeight = Math.Max(1, newHeight);

    image.Mutate(x => x.Resize(targetWidthPx, newHeight));

    await imagePipeline.SaveCanonicalJpegAtomicAsync(image, outAbsolutePath, originalAbsolutePath, ct);
}

static string SanitizeExtension(string? ext)
{
    if (string.IsNullOrWhiteSpace(ext))
    {
        return string.Empty;
    }

    // Оставляем только '.', буквы/цифры; иначе убираем расширение.
    var sb = new StringBuilder(ext.Length);
    foreach (var ch in ext)
    {
        if (ch == '.' || char.IsLetterOrDigit(ch))
        {
            sb.Append(ch);
        }
    }

    var cleaned = sb.ToString();
    if (cleaned.Length > 16) // защита от очень длинных “расширений”
    {
        return string.Empty;
    }

    return cleaned;
}

static async Task AppendHistoryAsync(AtomicJsonFileStore<List<UploadHistoryItem>> store, UploadHistoryItem entry, CancellationToken ct)
{
    await store.UpdateAsync(items =>
    {
        items.Add(entry);
        return items;
    }, ct);
}

static async Task AppendCompositeAsync(AtomicJsonFileStore<List<CompositeHistoryItem>> store, CompositeHistoryItem entry, CancellationToken ct)
{
    await store.UpdateAsync(items =>
    {
        items.Add(entry);
        return items;
    }, ct);
}

static ImageEditParams EnsureEditParams(ImageEditParams req)
{
    var color = req.Color ?? new ImageEditColorParams(0, 0, 0, 0, 0);
    var light = req.Light ?? new ImageEditLightParams(0, 0, 0, 0, 0, 0, 0);
    var details = req.Details ?? new ImageEditDetailsParams(0, 0, 0, 0, 0);
    var scene = req.Scene ?? new ImageEditSceneParams(0, 0, 0, 0);
    return req with
    {
        Preset = string.IsNullOrWhiteSpace(req.Preset) ? "None" : req.Preset,
        Color = color,
        Light = light,
        Details = details,
        Scene = scene
    };
}

static async Task<bool> RemoveCompositeByFileNameAsync(
    AtomicJsonFileStore<List<CompositeHistoryItem>> store,
    string fileName,
    CancellationToken ct)
{
    var removed = false;
    await store.UpdateAsync(items =>
    {
        var updated = items.Where(x => !string.Equals(Path.GetFileName(x.RelativePath), fileName, StringComparison.Ordinal)).ToList();
        removed = updated.Count != items.Count;
        return updated;
    }, ct);
    return removed;
}

async Task<(string AbsolutePath, string[] Sources)?> ResolveImageEditSourceAsync(string id, CancellationToken ct)
{
    var storedName = Path.GetFileName(id);
    if (string.IsNullOrWhiteSpace(storedName))
    {
        return null;
    }

    var originalPath = Path.Combine(uploadOriginalDir, storedName);
    if (File.Exists(originalPath))
    {
        return (originalPath, new[] { storedName });
    }

    var uploadPath = Path.Combine(uploadDir, storedName);
    if (File.Exists(uploadPath))
    {
        return (uploadPath, new[] { storedName });
    }

    var composites = await compositesStore.ReadAsync(ct);
    var match = composites.FirstOrDefault(x => string.Equals(Path.GetFileName(x.RelativePath), storedName, StringComparison.OrdinalIgnoreCase));
    if (match is null)
    {
        return null;
    }

    var abs = GetCompositeAbsolutePath(match);
    if (string.IsNullOrWhiteSpace(abs) || !File.Exists(abs))
    {
        return null;
    }

    return (abs, match.Sources ?? Array.Empty<string>());
}

static async Task<VideoHistoryItem?> RemoveVideoHistoryEntryAsync(AtomicJsonFileStore<List<VideoHistoryItem>> store, string storedName, CancellationToken ct)
{
    VideoHistoryItem? removed = null;
    await store.UpdateAsync(items =>
    {
        var idx = items.FindIndex(x => string.Equals(x.StoredName, storedName, StringComparison.OrdinalIgnoreCase));
        if (idx >= 0)
        {
            removed = items[idx];
            items.RemoveAt(idx);
        }
        return items;
    }, ct);
    return removed;
}

static void DeleteVideoFilesForEntry(VideoHistoryItem entry, string videoDir, string videoOutDir)
{
    var safeName = Path.GetFileName(entry.StoredName ?? string.Empty);
    if (string.IsNullOrWhiteSpace(safeName))
    {
        return;
    }

    // Primary deletion path: derive from kind + storedName to avoid base-path mismatches.
    if (string.Equals(entry.Kind, "processed", StringComparison.OrdinalIgnoreCase))
    {
        TryDeleteFile(Path.Combine(videoOutDir, safeName));
        return;
    }

    TryDeleteFile(Path.Combine(videoDir, safeName));
}

static void TryDeleteFile(string path)
{
    try
    {
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }
    catch
    {
        // ignore
    }
}

static async Task<bool> RemoveHistoryEntryAsync(
    AtomicJsonFileStore<List<UploadHistoryItem>> store,
    string storedName,
    CancellationToken ct)
{
    var removed = false;
    await store.UpdateAsync(items =>
    {
        var updated = items.Where(x => !string.Equals(x.StoredName, storedName, StringComparison.Ordinal)).ToList();
        removed = updated.Count != items.Count;
        return updated;
    }, ct);
    return removed;
}

static async Task UpsertResizedInHistoryAsync(
    AtomicJsonFileStore<List<UploadHistoryItem>> store,
    string storedName,
    int width,
    string relativePath,
    CancellationToken ct)
{
    await store.UpdateAsync(items =>
    {
        for (var i = items.Count - 1; i >= 0; i--)
        {
            if (!string.Equals(items[i].StoredName, storedName, StringComparison.Ordinal))
            {
                continue;
            }

            var resized = new Dictionary<int, string>(items[i].Resized ?? new Dictionary<int, string>());
            resized[width] = relativePath;
            items[i] = items[i] with { Resized = resized };
            break;
        }
        return items;
    }, ct);
}

static async Task UpdateHistoryAfterCropAsync(
    AtomicJsonFileStore<List<UploadHistoryItem>> store,
    string storedName,
    int newWidth,
    int newHeight,
    CancellationToken ct)
{
    await store.UpdateAsync(items =>
    {
        for (var i = items.Count - 1; i >= 0; i--)
        {
            if (!string.Equals(items[i].StoredName, storedName, StringComparison.Ordinal))
            {
                continue;
            }

            items[i] = items[i] with
            {
                ImageWidth = newWidth,
                ImageHeight = newHeight,
                PreviewRelativePath = $"preview/{storedName}",
                Resized = new Dictionary<int, string>(),
                IsCropped = true
            };
            break;
        }
        return items;
    }, ct);
}

record ImageInfo(int Width, int Height);
record ResizeRequest(string StoredName, int Width);
record DeleteRequest(string StoredName);
record CropRequest(string StoredName, int X, int Y, int Width, int Height);
record SplitViewRect(double X, double Y, double W, double H, double ViewW, double ViewH);
record SplitRequest(
    string StoredNameA,
    string StoredNameB,
    SplitViewRect A,
    SplitViewRect B
);
record Split3Request(
    string StoredNameA,
    string StoredNameB,
    string StoredNameC,
    SplitViewRect A,
    SplitViewRect B,
    SplitViewRect C
);
record WindowCropRequest(
    string StoredName,
    double X,
    double Y,
    double W,
    double H
);
record CompositeHistoryItem(
    string Kind,
    DateTimeOffset CreatedAt,
    string RelativePath,
    string[] Sources,
    string? PreviewRelativePath = null,
    ImageEditParams? EditParams = null
);
record VideoHistoryItem(
    string Kind,
    string StoredName,
    string OriginalName,
    DateTimeOffset CreatedAt,
    long Size,
    string RelativePath,
    double DurationSeconds
);
record UploadHistoryItem(
    string StoredName,
    string OriginalName,
    DateTimeOffset CreatedAt,
    long Size,
    string OriginalRelativePath,
    string? PreviewRelativePath,
    int? ImageWidth,
    int? ImageHeight,
    Dictionary<int, string> Resized,
    bool IsCropped
);

record CompositeDeleteRequest(string RelativePath);
record VideoDeleteRequest(string StoredName);
record OverlayRenameRequest(string DisplayName);

public record VideoProcessRequest(
    string StoredName,
    string[]? SourceStoredNames,
    VideoProcessClip[]? SourceClips,
    double? TrimStartSec,
    double? TrimEndSec,
    double? CutStartSec,
    double? CutEndSec,
    int OutputWidth,
    double TargetSizeMb,
    double VerticalOffsetPx,
    VideoProcessSegment[]? Segments,
    double? CropX,
    double? CropY,
    double? CropW,
    double? CropH,
    int? RotateDeg,
    bool? FlipH,
    bool? FlipV,
    double? Speed,
    bool? MuteAudio,
    string? EncodingMode,
    string? OverlayTemplateRelativePath
);

public record VideoProcessSegment(
    double StartSec,
    double EndSec
);

public record VideoProcessClip(
    string StoredName,
    double? TrimStartSec,
    double? TrimEndSec,
    VideoProcessSegment[]? Segments
);

record ProcessResult(bool Success, string Output, string Error);
