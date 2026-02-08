using SixLabors.ImageSharp;
using SixLabors.ImageSharp.ColorProfiles;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Jmaka.Api.Services;

public class ImagePipelineService
{
    private readonly JpegEncoder _jpegEncoder = new()
    {
        Quality = 92,
        Subsample = JpegSubsample.Ratio420,
        ColorType = JpegColorType.YCbCr,
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
        image.Metadata.IccProfile = IccProfile.Srgb;
    }

    public void ApplyAdjustments(Image image, ImageEditRequest request)
    {
        var brightness = 1 + request.Brightness;
        var contrast = 1 + request.Contrast;
        var saturation = 1 + request.Saturation + (request.Vibrance * 0.5f);
        var hue = request.Hue;
        var exposure = 1 + request.Exposure;

        image.Mutate(ctx =>
        {
            ctx.AutoOrient();
            ctx.Brightness(brightness);
            ctx.Contrast(contrast);
            ctx.Saturate(saturation);
            ctx.Hue(hue);
            ctx.Gamma(exposure);
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
