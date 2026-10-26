using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Metadata.Profiles.Icc;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

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
    public const int CanonicalJpegQuality = 92;

    private readonly ILogger<ImagePipelineService> _logger;

    // sRGB ICC profiles are typically small with fewer entries than wide-gamut profiles.
    // Standard sRGB profiles usually have < 20 entries, while AdobeRGB/ProPhoto may have 50+.
    private const int MaxSrgbProfileEntries = 50;

    private static readonly byte[] SrgbIccProfileBytes = Convert.FromBase64String(
        "AAACTGxjbXMEQAAAbW50clJHQiBYWVogB+oAAgAJAAoAJwA4YWNzcEFQUEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1sY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALZGVzYwAAAQgAAAA2Y3BydAAAAUAAAABMd3RwdAAAAYwAAAAUY2hhZAAAAaAAAAAsclhZWgAAAcwAAAAUYlhZWgAAAeAAAAAUZ1hZWgAAAfQAAAAUclRSQwAAAggAAAAgZ1RSQwAAAggAAAAgYlRSQwAAAggAAAAgY2hybQAAAigAAAAkbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABzAFIARwBCACAAYgB1AGkAbAB0AC0AaQBuAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAADAAAAAcAE4AbwAgAGMAbwBwAHkAcgBpAGcAaAB0ACwAIAB1AHMAZQAgAGYAcgBlAGUAbAB5WFlaIAAAAAAAAPbWAAEAAAAA0y1zZjMyAAAAAAABDEIAAAXe///zJQAAB5MAAP2Q///7of///aIAAAPcAADAblhZWiAAAAAAAABvoAAAOPUAAAOQWFlaIAAAAAAAACSfAAAPhAAAtsNYWVogAAAAAAAAYpcAALeHAAAY2XBhcmEAAAAAAAMAAAACZmYAAPKnAAANWQAAE9AAAApbY2hybQAAAAAAAwAAAACj1wAAVHsAAEzNAACZmgAAJmYAAA9c");

    private readonly JpegEncoder _jpegEncoder = new()
    {
        Quality = CanonicalJpegQuality,
        Interleaved = true
    };

    public ImagePipelineService(ILogger<ImagePipelineService> logger)
    {
        _logger = logger;
    }

    public async Task ConvertToJpegSrgbAsync(string inputPath, string outputPath, CancellationToken ct)
    {
        await using var input = File.OpenRead(inputPath);
        var image = await Image.LoadAsync(input, ct);
        using var normalized = NormalizeToSrgb(image, inputPath);
        await SaveNormalizedJpegAtomicAsync(normalized, outputPath, ct);
    }

    /// <summary>
    /// Reads image headers without decoding pixel buffers and rejects images outside the configured limits.
    /// Call this before <see cref="Image.LoadAsync(string, CancellationToken)"/> for untrusted input.
    /// </summary>
    public async Task<ImageIdentification> IdentifyAndValidateAsync(
        string inputPath,
        ImageValidationLimits limits,
        CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(inputPath);
        ArgumentNullException.ThrowIfNull(limits);
        limits.Validate();

        var info = await Image.IdentifyAsync(inputPath, ct)
            ?? throw new InvalidDataException("File is not a supported image.");

        return ValidateImageInfo(info, limits);
    }

    /// <summary>
    /// Validates already identified image metadata without allocating pixel buffers.
    /// </summary>
    private static ImageIdentification ValidateImageInfo(SixLabors.ImageSharp.ImageInfo info, ImageValidationLimits limits)
    {
        ArgumentNullException.ThrowIfNull(info);
        ArgumentNullException.ThrowIfNull(limits);
        limits.Validate();

        if (info.Width <= 0 || info.Height <= 0)
        {
            throw new InvalidDataException("Image dimensions must be positive.");
        }

        if (info.Width > limits.MaxWidth || info.Height > limits.MaxHeight)
        {
            throw new InvalidDataException(
                $"Image dimensions {info.Width}x{info.Height} exceed the limit {limits.MaxWidth}x{limits.MaxHeight}.");
        }

        var frameCount = Math.Max(1, info.FrameMetadataCollection.Count);
        if (frameCount > limits.MaxFrames)
        {
            throw new InvalidDataException(
                $"Image frame count {frameCount} exceeds the limit {limits.MaxFrames}.");
        }

        var pixelCount = checked((long)info.Width * info.Height * frameCount);
        if (pixelCount > limits.MaxPixels)
        {
            throw new InvalidDataException(
                $"Image decoded pixel count {pixelCount} exceeds the limit {limits.MaxPixels}.");
        }

        return new ImageIdentification(info.Width, info.Height, pixelCount, frameCount);
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
            var profileInfo = TryGetIccDescription(existingIccProfile, _logger);

            // Check if it's already sRGB by checking the data color space and profile size
            // sRGB profiles are typically small (< MaxSrgbProfileEntries) and use RGB color space
            var colorSpace = existingIccProfile.Header.DataColorSpace;
            var isSrgb = colorSpace.ToString().Contains("RGB", StringComparison.OrdinalIgnoreCase) &&
                         (profileInfo?.Contains("sRGB", StringComparison.OrdinalIgnoreCase) == true ||
                          existingIccProfile.Entries.Length < MaxSrgbProfileEntries);

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

    private static string? TryGetIccDescription(IccProfile profile, ILogger logger)
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
            // Log the exception for diagnostics
            logger.LogDebug(ex, "Failed to extract ICC profile info");
            return null;
        }
    }

    public void ApplyAdjustments(Image image, ImageEditParams request)
    {
        var color = request.Color ?? new ImageEditColorParams(0, 0, 0, 0, 0);
        var light = request.Light ?? new ImageEditLightParams(0, 0, 0, 0, 0, 0, 0);
        var details = request.Details ?? new ImageEditDetailsParams(0, 0, 0, 0, 0);
        var scene = request.Scene ?? new ImageEditSceneParams(0, 0, 0, 0);

        var brightness = light.Brightness / 100f;
        var exposure = light.Exposure / 100f;
        var contrast = light.Contrast / 100f;
        var saturation = color.Saturation / 100f;
        var vibrance = color.Vibrance / 100f;
        var temperature = color.Temperature / 100f;
        var tint = color.Tint / 100f;
        var hue = color.Hue;
        var highlights = light.Highlights / 100f;
        var shadows = light.Shadows / 100f;
        var black = light.Black / 100f;
        var white = light.White / 100f;
        var clarity = details.Clarity / 100f;
        var grain = details.Grain / 100f;
        var vignette = scene.Vignette / 100f;
        var dehaze = scene.Dehaze / 100f;
        var glamour = scene.Glamour / 100f;
        var bloom = scene.Bloom / 100f;

        var blur = Math.Max(Math.Max(details.Blur, details.Smooth), scene.Glamour > 0 ? 8f : 0f) / 100f;
        var sharpen = Math.Max(details.Sharpen, 0) / 100f;

        var contrastFactor = Math.Max(0.05f, 1f + contrast + clarity * 0.3f + dehaze * 0.2f);
        var brightnessOffset = brightness * 40f + exposure * 60f + bloom * 25f;
        var hueShift = (hue / 180f) * MathF.PI;
        var cosH = MathF.Cos(hueShift);
        var sinH = MathF.Sin(hueShift);
        var glamourLift = glamour >= 0 ? glamour * 6f : glamour * 3f;

        image.Mutate(ctx =>
        {
            if (blur > 0)
            {
                ctx.GaussianBlur(blur * 6);
            }
            if (sharpen > 0)
            {
                ctx.GaussianSharpen(sharpen * 3);
            }
        });

        using var rgba = image.CloneAs<Rgba32>();
        var width = rgba.Width;
        var height = rgba.Height;
        rgba.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < height; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < width; x++)
                {
                    var px = row[x];
                    var r = (float)px.R;
                    var g = (float)px.G;
                    var b = (float)px.B;

                    // Temperature and tint shifts.
                    r += temperature * 18f;
                    b -= temperature * 18f;
                    g += tint * 12f;
                    r -= tint * 6f;
                    b -= tint * 6f;

                    // Contrast/brightness blend with exposure and scene boosts.
                    r = (r - 128f) * contrastFactor + 128f + brightnessOffset;
                    g = (g - 128f) * contrastFactor + 128f + brightnessOffset;
                    b = (b - 128f) * contrastFactor + 128f + brightnessOffset;

                    // Black/white and highlight/shadow tuning by luma region.
                    var luma = 0.2126f * r + 0.7152f * g + 0.0722f * b;
                    if (luma < 128f)
                    {
                        var shadowBoost = (shadows + black * 0.6f) * (1f - luma / 128f);
                        r += shadowBoost * 55f;
                        g += shadowBoost * 55f;
                        b += shadowBoost * 55f;
                    }
                    else
                    {
                        var highlightBoost = (highlights + white * 0.6f) * ((luma - 128f) / 127f);
                        r += highlightBoost * 55f;
                        g += highlightBoost * 55f;
                        b += highlightBoost * 55f;
                    }

                    // Hue rotation matrix.
                    var rPrime = r * (0.299f + 0.701f * cosH + 0.168f * sinH)
                        + g * (0.587f - 0.587f * cosH + 0.330f * sinH)
                        + b * (0.114f - 0.114f * cosH - 0.497f * sinH);
                    var gPrime = r * (0.299f - 0.299f * cosH - 0.328f * sinH)
                        + g * (0.587f + 0.413f * cosH + 0.035f * sinH)
                        + b * (0.114f - 0.114f * cosH + 0.292f * sinH);
                    var bPrime = r * (0.299f - 0.300f * cosH + 1.250f * sinH)
                        + g * (0.587f - 0.588f * cosH - 1.050f * sinH)
                        + b * (0.114f + 0.886f * cosH - 0.203f * sinH);

                    r = rPrime;
                    g = gPrime;
                    b = bPrime;

                    // Saturation and vibrance.
                    var avg = (r + g + b) / 3f;
                    var vibranceWeight = 1f - MathF.Min(1f, MathF.Abs(avg - 128f) / 128f);
                    var satFactor = MathF.Max(0f, 1f + saturation + vibrance * vibranceWeight);
                    r = avg + (r - avg) * satFactor;
                    g = avg + (g - avg) * satFactor;
                    b = avg + (b - avg) * satFactor;

                    // Glamour soft-lift.
                    r += glamourLift;
                    g += glamourLift;
                    b += glamourLift;

                    // Grain uses deterministic coordinate noise for stable exports.
                    if (grain != 0)
                    {
                        var noise = DeterministicNoise(x, y) * grain * 18f;
                        r += noise;
                        g += noise;
                        b += noise;
                    }

                    if (vignette != 0)
                    {
                        var dx = (x / (float)width) - 0.5f;
                        var dy = (y / (float)height) - 0.5f;
                        var dist = MathF.Sqrt(dx * dx + dy * dy);
                        var vig = 1f - MathF.Min(1f, dist * 1.6f) * MathF.Abs(vignette);
                        r *= vig;
                        g *= vig;
                        b *= vig;
                    }

                    row[x] = new Rgba32(
                        ClampByte(r),
                        ClampByte(g),
                        ClampByte(b),
                        px.A);
                }
            }
        });

        image.Mutate(ctx => ctx.DrawImage(rgba, 1f));
    }

    private static float DeterministicNoise(int x, int y)
    {
        unchecked
        {
            uint h = (uint)(x * 374761393 + y * 668265263);
            h = (h ^ (h >> 13)) * 1274126177;
            h ^= h >> 16;
            return ((h & 0xFFFF) / 65535f) - 0.5f;
        }
    }

    private static byte ClampByte(float value)
    {
        if (value <= 0f) return 0;
        if (value >= 255f) return 255;
        return (byte)MathF.Round(value);
    }

    /// <summary>
    /// Normalizes an image exactly once and atomically publishes the canonical JPEG output.
    /// The caller retains ownership of <paramref name="image"/>; a clone is normalized internally.
    /// Use <see cref="SaveNormalizedJpegAtomicAsync"/> when the image is already normalized.
    /// </summary>
    public async Task SaveCanonicalJpegAtomicAsync(
        Image image,
        string outputPath,
        string? sourcePath,
        CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(image);

        using var working = image.CloneAs<Rgba32>();
        using var normalized = NormalizeToSrgb(working, sourcePath);
        await SaveNormalizedJpegAtomicAsync(normalized, outputPath, ct);
    }

    /// <summary>
    /// Atomically publishes an image that has already passed <see cref="NormalizeToSrgb"/>.
    /// The temporary JPEG uses a GUID name in the destination directory, so concurrent writers cannot collide.
    /// </summary>
    public async Task SaveNormalizedJpegAtomicAsync(Image normalizedImage, string outputPath, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(normalizedImage);
        ArgumentException.ThrowIfNullOrWhiteSpace(outputPath);

        var fullOutputPath = Path.GetFullPath(outputPath);
        var directory = Path.GetDirectoryName(fullOutputPath)
            ?? throw new InvalidOperationException("Output path must include a directory.");
        Directory.CreateDirectory(directory);

        var tempPath = Path.Combine(
            directory,
            $".{Path.GetFileNameWithoutExtension(fullOutputPath)}.{Guid.NewGuid():N}.tmp.jpg");

        try
        {
            await normalizedImage.SaveAsync(tempPath, _jpegEncoder, ct);
            File.Move(tempPath, fullOutputPath, overwrite: true);
        }
        finally
        {
            try
            {
                File.Delete(tempPath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to remove temporary image {TempPath}", tempPath);
            }
        }
    }
}

public sealed record ImageValidationLimits(
    int MaxWidth,
    int MaxHeight,
    long MaxPixels,
    int MaxFrames)
{
    public static ImageValidationLimits Default { get; } = new(
        MaxWidth: 16_384,
        MaxHeight: 16_384,
        MaxPixels: 100_000_000,
        MaxFrames: 1);

    internal void Validate()
    {
        if (MaxWidth <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(MaxWidth));
        }

        if (MaxHeight <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(MaxHeight));
        }

        if (MaxPixels <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(MaxPixels));
        }

        if (MaxFrames <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(MaxFrames));
        }
    }
}

public sealed record ImageIdentification(
    int Width,
    int Height,
    long PixelCount,
    int FrameCount);

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
