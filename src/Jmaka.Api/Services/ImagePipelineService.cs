using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Metadata.Profiles.Icc;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using System.Reflection;

namespace Jmaka.Api.Services;

/// <summary>
/// Image processing pipeline service with ICC-aware color management.
/// 
/// IMPORTANT LIMITATION:
/// SixLabors.ImageSharp does NOT support ICC color profile conversion.
/// It can read/write ICC profiles but cannot transform pixel colors between color spaces.
/// 
/// What this means:
/// - We can embed sRGB ICC profiles in output JPEGs
/// - We can detect non-sRGB input profiles and log warnings
/// - We CANNOT accurately convert colors from AdobeRGB/ProPhoto/DisplayP3 to sRGB
/// 
/// For true ICC color conversion, ImageMagick would be required.
/// However, the current implementation ensures:
/// 1. All outputs have embedded sRGB ICC profiles
/// 2. Proper order of operations (orientation -> adjustments -> normalization)
/// 3. Proper alpha handling (flatten to white)
/// 4. Proper metadata stripping (keep ICC only)
/// 5. Logging to detect problematic inputs
/// </summary>
public class ImagePipelineService
{
    private readonly ILogger<ImagePipelineService> _logger;
    private static readonly byte[] SrgbIccProfileBytes = Convert.FromBase64String(
        "AAACTGxjbXMEQAAAbW50clJHQiBYWVogB+oAAgAJAAoAJwA4YWNzcEFQUEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALZGVzYwAAAQgAAAA2Y3BydAAAAUAAAABMd3RwdAAAAYwAAAAUY2hhZAAAAaAAAAAsclhZWgAAAcwAAAAUYlhZWgAAAeAAAAAUZ1hZWgAAAfQAAAAUclRSQwAAAggAAAAgZ1RSQwAAAggAAAAgYlRSQwAAAggAAAAgY2hybQAAAigAAAAkbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABzAFIARwBCACAAYgB1AGkAbAB0AC0AaQBuAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADAAAAAcAE4AbwAgAGMAbwBwAHkAcgBpAGcAaAB0ACwAIAB1AHMAZQAgAGYAcgBlAGUAbAB5WFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///aIAAAPcAADAblhZWiAAAAAAAABvoAAAOPUAAAOQWFlaIAAAAAAAACSfAAAPhAAAtsNYWVogAAAAAAAAYpcAALeHAAAY2XBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbY2hybQAAAAAAAwAAAACj1wAAVHsAAEzNAACZmgAAJmYAAA9c");

    private readonly JpegEncoder _jpegEncoder = new()
    {
        Quality = 92,
        Interleaved = true
    };

    private static readonly MethodInfo[] VignetteMethods = typeof(IImageProcessingContext)
        .Assembly
        .GetTypes()
        .Where(t => t.IsSealed && t.IsAbstract && t.Name == "VignetteExtensions")
        .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Static))
        .Where(m => m.Name == "Vignette")
        .ToArray();

    public ImagePipelineService(ILogger<ImagePipelineService> logger)
    {
        _logger = logger;
    }

    public async Task ConvertToJpegSrgbAsync(string inputPath, string outputPath, CancellationToken ct)
    {
        await using var input = File.OpenRead(inputPath);
        var image = await Image.LoadAsync(input, ct);
        using var normalized = NormalizeToSrgb(image, inputPath);
        await SaveJpegAsync(normalized, outputPath, ct);
    }

    public async Task<Image> LoadImageAsync(string inputPath, CancellationToken ct)
    {
        await using var input = File.OpenRead(inputPath);
        return await Image.LoadAsync(input, ct);
    }

    /// <summary>
    /// Normalizes image to sRGB color space with proper ICC profile.
    /// This is the canonical function for color management before JPEG output.
    /// 
    /// Order of operations:
    /// 1. Apply orientation correction (AutoOrient)
    /// 2. Flatten alpha channel to white (JPEG doesn't support transparency)
    /// 3. Check for existing ICC profile and log warnings
    /// 4. Strip all metadata (EXIF, IPTC, XMP)
    /// 5. Embed sRGB ICC profile
    /// </summary>
    public Image NormalizeToSrgb(Image image, string? sourcePath = null)
    {
        var hasAlpha = image.PixelType.AlphaRepresentation != PixelAlphaRepresentation.None;
        var existingIccProfile = image.Metadata.IccProfile;
        var existingColorSpace = image.Metadata.GetFormatMetadata(JpegFormat.Instance)?.ColorType;

        // Log input state for diagnostics
        _logger.LogInformation(
            "NormalizeToSrgb: source={Source}, format={Format}, size={Width}x{Height}, hasAlpha={HasAlpha}, hasIcc={HasIcc}, iccSize={IccSize}, colorSpace={ColorSpace}",
            sourcePath ?? "memory",
            image.Metadata.DecodedImageFormat?.Name ?? "unknown",
            image.Width,
            image.Height,
            hasAlpha,
            existingIccProfile != null,
            existingIccProfile?.Entries.Length ?? 0,
            existingColorSpace?.ToString() ?? "unknown"
        );

        // WARNING: ImageSharp does not support ICC color profile conversion.
        // We can only embed the sRGB profile, but cannot transform pixel colors.
        // For proper color management, a library with ICC support (like ImageMagick) would be needed.
        if (existingIccProfile != null && existingIccProfile.Entries.Length > 0)
        {
            var profileInfo = TryGetIccDescription(existingIccProfile);
            
            // Check if it's already sRGB by checking the data color space and profile size
            // sRGB profiles are typically small (< 50 entries) and use RGB color space
            var colorSpace = existingIccProfile.Header.DataColorSpace;
            var isSrgb = colorSpace.ToString().Contains("RGB", StringComparison.OrdinalIgnoreCase) &&
                         (profileInfo?.Contains("sRGB", StringComparison.OrdinalIgnoreCase) == true ||
                          existingIccProfile.Entries.Length < 50); // sRGB profiles are typically small
            
            if (!isSrgb)
            {
                _logger.LogWarning(
                    "NormalizeToSrgb: Input has non-sRGB ICC profile (colorSpace: {ColorSpace}, entries: {EntryCount}, info: {Info}). " +
                    "ImageSharp cannot perform ICC color conversion. Pixel colors will not be transformed. " +
                    "For accurate color conversion, consider preprocessing with ImageMagick.",
                    colorSpace.ToString(),
                    existingIccProfile.Entries.Length,
                    profileInfo ?? "unknown"
                );
            }
            else
            {
                _logger.LogDebug("NormalizeToSrgb: Input already has sRGB profile");
            }
        }

        // Step 1: Apply orientation correction (must be done before any other transformations)
        image.Mutate(ctx => ctx.AutoOrient());

        // Step 2: Flatten alpha channel to white (JPEG doesn't support transparency)
        if (hasAlpha)
        {
            _logger.LogDebug("NormalizeToSrgb: Flattening alpha channel to white");
            var flattened = new Image<Rgb24>(image.Width, image.Height, Color.White);
            flattened.Mutate(ctx => ctx.DrawImage(image, new Point(0, 0), 1f));
            image.Dispose();
            image = flattened;
        }

        // Step 3 & 4: Strip all metadata except ICC (we'll add sRGB ICC next)
        image.Metadata.ExifProfile = null;
        image.Metadata.IptcProfile = null;
        image.Metadata.XmpProfile = null;

        // Step 5: Embed sRGB ICC profile
        image.Metadata.IccProfile = new IccProfile(SrgbIccProfileBytes);

        _logger.LogDebug("NormalizeToSrgb: Completed - embedded sRGB ICC profile");
        
        return image;
    }

    private static string? TryGetIccDescription(IccProfile profile)
    {
        try
        {
            // Try to get basic info from the profile header
            var colorSpace = profile.Header.DataColorSpace.ToString();
            var cmmType = profile.Header.CmmType ?? "unknown";
            return $"{colorSpace}/{cmmType}";
        }
        catch (Exception ex)
        {
            // Log the exception for diagnostics but don't fail the operation
            // Using Console as logger might not be available in this context
            Console.WriteLine($"Warning: Failed to extract ICC profile info: {ex.Message}");
            return null;
        }
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
            // Note: AutoOrient is now handled in NormalizeToSrgb
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
                ApplyVignetteCompat(ctx, Math.Abs(vignette) * 0.6f);
            }
        });
    }

    private static void ApplyVignetteCompat(IImageProcessingContext ctx, float strength)
    {
        // ImageSharp API has differed between versions/build agents.
        // We resolve and invoke a compatible overload dynamically to avoid CI compile failures.
        foreach (var method in VignetteMethods)
        {
            var ps = method.GetParameters();
            if (ps.Length == 2 && ps[1].ParameterType == typeof(float))
            {
                method.Invoke(null, [ctx, strength]);
                return;
            }

            if (ps.Length == 3 && ps[1].ParameterType == typeof(float) && ps[2].ParameterType == typeof(Color))
            {
                method.Invoke(null, [ctx, strength, Color.Black]);
                return;
            }

            if (ps.Length == 3 && ps[1].ParameterType == typeof(Color) && ps[2].ParameterType == typeof(float))
            {
                method.Invoke(null, [ctx, Color.Black, strength]);
                return;
            }
        }
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
