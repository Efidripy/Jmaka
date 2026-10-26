using Jmaka.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;

namespace Jmaka.Api.Tests;

public sealed class CanonicalImageContractTests
{
    private readonly ImagePipelineService _sut = new(NullLogger<ImagePipelineService>.Instance);

    [Fact]
    public async Task SaveCanonicalJpegAtomicAsync_ProducesCanonicalMetadataAndQuality()
    {
        using var temp = new TempDirectory();
        var outputPath = Path.Combine(temp.Path, "canonical.jpg");
        using var source = new Image<Rgba32>(12, 8, new Rgba32(20, 40, 60, 255));
        source.Metadata.ExifProfile = new ExifProfile();
        source.Metadata.ExifProfile.SetValue(ExifTag.ImageDescription, "must be stripped");

        await _sut.SaveCanonicalJpegAtomicAsync(source, outputPath, "test", CancellationToken.None);

        using var result = await Image.LoadAsync<Rgb24>(outputPath);
        Assert.Equal(JpegFormat.Instance, result.Metadata.DecodedImageFormat);
        Assert.Equal(ImagePipelineService.CanonicalJpegQuality, result.Metadata.GetJpegMetadata().Quality);
        Assert.NotNull(result.Metadata.IccProfile);
        Assert.NotEmpty(result.Metadata.IccProfile!.Entries);
        Assert.Null(result.Metadata.ExifProfile);
        Assert.Null(result.Metadata.IptcProfile);
        Assert.Null(result.Metadata.XmpProfile);
    }

    [Fact]
    public async Task SaveCanonicalJpegAtomicAsync_FlattensAlphaToWhite()
    {
        using var temp = new TempDirectory();
        var outputPath = Path.Combine(temp.Path, "alpha.jpg");
        using var source = new Image<Rgba32>(32, 32, new Rgba32(255, 0, 0, 0));

        await _sut.SaveCanonicalJpegAtomicAsync(source, outputPath, "alpha", CancellationToken.None);

        using var result = await Image.LoadAsync<Rgb24>(outputPath);
        var pixel = result[16, 16];
        Assert.InRange(pixel.R, (byte)245, byte.MaxValue);
        Assert.InRange(pixel.G, (byte)245, byte.MaxValue);
        Assert.InRange(pixel.B, (byte)245, byte.MaxValue);
    }

    [Fact]
    public async Task SaveCanonicalJpegAtomicAsync_AppliesExifOrientationBeforeStrippingExif()
    {
        using var temp = new TempDirectory();
        var outputPath = Path.Combine(temp.Path, "oriented.jpg");
        using var source = new Image<Rgba32>(3, 2, Color.Red);
        source.Metadata.ExifProfile = new ExifProfile();
        source.Metadata.ExifProfile.SetValue(ExifTag.Orientation, (ushort)6);

        await _sut.SaveCanonicalJpegAtomicAsync(source, outputPath, "oriented", CancellationToken.None);

        using var result = await Image.LoadAsync(outputPath);
        Assert.Equal(2, result.Width);
        Assert.Equal(3, result.Height);
        Assert.Null(result.Metadata.ExifProfile);
    }

    [Fact]
    public async Task IdentifyAndValidateAsync_RejectsDimensionAndPixelLimitsBeforeDecode()
    {
        using var temp = new TempDirectory();
        var inputPath = Path.Combine(temp.Path, "large.png");
        using (var source = new Image<Rgba32>(20, 10, Color.Blue))
        {
            await source.SaveAsync(inputPath, new PngEncoder());
        }

        var dimensionLimits = new ImageValidationLimits(19, 10, 1_000, 1);
        var pixelLimits = new ImageValidationLimits(20, 10, 199, 1);

        var dimensionError = await Assert.ThrowsAsync<InvalidDataException>(
            () => _sut.IdentifyAndValidateAsync(inputPath, dimensionLimits, CancellationToken.None));
        var pixelError = await Assert.ThrowsAsync<InvalidDataException>(
            () => _sut.IdentifyAndValidateAsync(inputPath, pixelLimits, CancellationToken.None));

        Assert.Contains("dimensions", dimensionError.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("pixel count", pixelError.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task IdentifyAndValidateAsync_RejectsAnimatedImageOverFrameLimit()
    {
        using var temp = new TempDirectory();
        var inputPath = Path.Combine(temp.Path, "animated.gif");
        using (var source = new Image<Rgba32>(4, 4, Color.Red))
        using (var secondFrame = new Image<Rgba32>(4, 4, Color.Blue))
        {
            source.Frames.AddFrame(secondFrame.Frames.RootFrame);
            await source.SaveAsync(inputPath, new GifEncoder());
        }

        var limits = new ImageValidationLimits(100, 100, 10_000, 1);

        var error = await Assert.ThrowsAsync<InvalidDataException>(
            () => _sut.IdentifyAndValidateAsync(inputPath, limits, CancellationToken.None));

        Assert.Contains("frame count", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SaveNormalizedJpegAtomicAsync_RemovesGuidTempWhenPublishFails()
    {
        using var temp = new TempDirectory();
        var outputPath = Path.Combine(temp.Path, "destination.jpg");
        Directory.CreateDirectory(outputPath);
        using var source = new Image<Rgb24>(8, 8, Color.Green);
        using var normalized = _sut.NormalizeToSrgb(source.CloneAs<Rgb24>(), "atomic-cleanup");

        var error = await Record.ExceptionAsync(
            () => _sut.SaveNormalizedJpegAtomicAsync(normalized, outputPath, CancellationToken.None));

        Assert.NotNull(error);
        Assert.True(error is IOException or UnauthorizedAccessException, $"Unexpected exception: {error}");
        Assert.Empty(Directory.EnumerateFiles(temp.Path, "*.tmp.jpg"));
    }

    private sealed class TempDirectory : IDisposable
    {
        public TempDirectory()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"jmaka-image-tests-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose()
        {
            Directory.Delete(Path, recursive: true);
        }
    }
}
