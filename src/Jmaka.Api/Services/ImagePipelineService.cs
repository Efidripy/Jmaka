using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Metadata.Profiles.Icc;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace Jmaka.Api.Services;

public class ImagePipelineService
{
    private static readonly byte[] SrgbIccProfileBytes = Convert.FromBase64String(
        "AAACTGxjbXMEQAAAbW50clJHQiBYWVogB+oAAgAJAAoAJwA4YWNzcEFQUEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALZGVzYwAAAQgAAAA2Y3BydAAAAUAAAABMd3RwdAAAAYwAAAAUY2hhZAAAAaAAAAAsclhZWgAAAcwAAAAUYlhZWgAAAeAAAAAUZ1hZWgAAAfQAAAAUclRSQwAAAggAAAAgZ1RSQwAAAggAAAAgYlRSQwAAAggAAAAgY2hybQAAAigAAAAkbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABzAFIARwBCACAAYgB1AGkAbAB0AC0AaQBuAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADAAAAAcAE4AbwAgAGMAbwBwAHkAcgBpAGcAaAB0ACwAIAB1AHMAZQAgAGYAcgBlAGUAbAB5WFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///aIAAAPcAADAblhZWiAAAAAAAABvoAAAOPUAAAOQWFlaIAAAAAAAACSfAAAPhAAAtsNYWVogAAAAAAAAYpcAALeHAAAY2XBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbY2hybQAAAAAAAwAAAACj1wAAVHsAAEzNAACZmgAAJmYAAA9c");

    private readonly JpegEncoder _jpegEncoder = new()
    {
        Quality = 92,
        Interleaved = true
    };

    public async Task ConvertToJpegSrgbAsync(string inputPath, string outputPath, CancellationToken ct)
    {
        await using var input = File.OpenRead(inputPath);
        var image = await Image.LoadAsync(input, ct);
        using var normalized = NormalizeToSrgb(image);
        await SaveJpegAsync(normalized, outputPath, ct);
    }

    public async Task<Image> LoadImageAsync(string inputPath, CancellationToken ct)
    {
        await using var input = File.OpenRead(inputPath);
        return await Image.LoadAsync(input, ct);
    }

    public Image NormalizeToSrgb(Image image)
    {
        if (image.PixelType.AlphaRepresentation != PixelAlphaRepresentation.None)
        {
            var flattened = new Image<Rgb24>(image.Width, image.Height, Color.White);
            flattened.Mutate(ctx => ctx.DrawImage(image, new Point(0, 0), 1f));
            image.Dispose();
            image = flattened;
        }

        image.Metadata.ExifProfile = null;
        image.Metadata.IptcProfile = null;
        image.Metadata.XmpProfile = null;
        image.Metadata.IccProfile = new IccProfile(SrgbIccProfileBytes);
        return image;
    }

    public void ApplyAdjustments(Image image, ImageEditParams request)
    {
        var color = request.Color ?? new ImageEditColorParams(0, 0, 0, 0, 0);
        var light = request.Light ?? new ImageEditLightParams(0, 0, 0, 0, 0, 0, 0);
        var details = request.Details ?? new ImageEditDetailsParams(0, 0, 0, 0, 0);
        var scene = request.Scene ?? new ImageEditSceneParams(0, 0, 0, 0);

        var brightnessBoost = (light.Brightness + light.Exposure * 0.7f + scene.Bloom * 0.4f) / 100f;
        var contrastBoost = (light.Contrast + details.Clarity * 0.5f + scene.Dehaze * 0.4f) / 100f;
        var saturationBoost = (color.Saturation + color.Vibrance * 0.6f) / 100f;
        var hue = color.Hue;
        var blur = Math.Max(details.Blur, details.Smooth) / 100f;
        var sharpen = Math.Max(details.Sharpen, 0) / 100f;
        var vignette = scene.Vignette / 100f;

        image.Mutate(ctx =>
        {
            ctx.AutoOrient();
            ctx.Brightness(1 + brightnessBoost);
            ctx.Contrast(1 + contrastBoost);
            ctx.Saturate(1 + saturationBoost);
            if (Math.Abs(hue) > 0.01f)
            {
                ctx.Hue(hue);
            }
            if (blur > 0)
            {
                ctx.GaussianBlur(blur * 6);
            }
            if (sharpen > 0)
            {
                ctx.GaussianSharpen(sharpen * 3);
            }
            if (Math.Abs(vignette) > 0.01f)
            {
                ctx.Vignette(Color.Black, Math.Abs(vignette) * 0.6f);
            }
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

public record ImageEditParams(
    string? ImageId,
    string? Preset,
    ImageEditColorParams? Color,
    ImageEditLightParams? Light,
    ImageEditDetailsParams? Details,
    ImageEditSceneParams? Scene
)
{
    public static ImageEditParams Default => new(
        ImageId: null,
        Preset: "None",
        Color: new ImageEditColorParams(0, 0, 0, 0, 0),
        Light: new ImageEditLightParams(0, 0, 0, 0, 0, 0, 0),
        Details: new ImageEditDetailsParams(0, 0, 0, 0, 0),
        Scene: new ImageEditSceneParams(0, 0, 0, 0)
    );
}

public record ImageEditColorParams(
    float Vibrance,
    float Saturation,
    float Temperature,
    float Tint,
    float Hue
);

public record ImageEditLightParams(
    float Brightness,
    float Exposure,
    float Contrast,
    float Black,
    float White,
    float Highlights,
    float Shadows
);

public record ImageEditDetailsParams(
    float Sharpen,
    float Clarity,
    float Smooth,
    float Blur,
    float Grain
);

public record ImageEditSceneParams(
    float Vignette,
    float Glamour,
    float Bloom,
    float Dehaze
);
