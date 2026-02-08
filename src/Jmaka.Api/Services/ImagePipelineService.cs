using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Metadata.Profiles.Icc;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Jmaka.Api.Services;

public class ImagePipelineService
{
    private readonly JpegEncoder _jpegEncoder = new()
    {
        Quality = 92,
        Interleaved = true
    };

    public async Task ConvertToJpegSrgbAsync(string inputPath, string outputPath, CancellationToken ct)
    {
        await using var input = File.OpenRead(inputPath);
        using var image = await Image.LoadAsync(input, ct);
        ApplySrgbProfile(image);
        await SaveJpegAsync(image, outputPath, ct);
    }

    public async Task<Image> LoadImageAsync(string inputPath, CancellationToken ct)
    {
        await using var input = File.OpenRead(inputPath);
        return await Image.LoadAsync(input, ct);
    }

    public void ApplySrgbProfile(Image image)
    {
        // ImageSharp 3.x no longer exposes a built-in sRGB profile helper.
        // Keep this as a no-op to avoid breaking call sites.
    }

    public void ApplyAdjustments(Image image, ImageEditRequest request)
    {
        var brightness = 1 + request.Brightness;
        var contrast = 1 + request.Contrast;
        var saturation = 1 + request.Saturation + (request.Vibrance * 0.5f);
        var hue = request.Hue;
        image.Mutate(ctx =>
        {
            ctx.AutoOrient();
            ctx.Brightness(brightness);
            ctx.Contrast(contrast);
            ctx.Saturate(saturation);
            ctx.Hue(hue);
        });
    }

    public async Task SaveJpegAsync(Image image, string outputPath, CancellationToken ct)
    {
        var dir = Path.GetDirectoryName(outputPath);
        if (!string.IsNullOrWhiteSpace(dir))
        {
            Directory.CreateDirectory(dir);
        }

        await image.SaveAsync(outputPath, _jpegEncoder, ct);
    }
}

public record ImageEditRequest(
    string StoredName,
    float Brightness,
    float Contrast,
    float Saturation,
    float Hue,
    float Exposure,
    float Vibrance
);
