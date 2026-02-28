using Jmaka.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;

namespace Jmaka.Api.Tests;

public class ImagePipelineServiceTests
{
    public static IEnumerable<object[]> SliderCases()
    {
        yield return ["color.vibrance", (Func<ImageEditParams>)(() => WithColor(vibrance: 55))];
        yield return ["color.saturation", (Func<ImageEditParams>)(() => WithColor(saturation: 55))];
        yield return ["color.temperature", (Func<ImageEditParams>)(() => WithColor(temperature: 45))];
        yield return ["color.tint", (Func<ImageEditParams>)(() => WithColor(tint: 45))];
        yield return ["color.hue", (Func<ImageEditParams>)(() => WithColor(hue: 45))];

        yield return ["light.brightness", (Func<ImageEditParams>)(() => WithLight(brightness: 40))];
        yield return ["light.exposure", (Func<ImageEditParams>)(() => WithLight(exposure: 40))];
        yield return ["light.contrast", (Func<ImageEditParams>)(() => WithLight(contrast: 35))];
        yield return ["light.black", (Func<ImageEditParams>)(() => WithLight(black: 35))];
        yield return ["light.white", (Func<ImageEditParams>)(() => WithLight(white: 35))];
        yield return ["light.highlights", (Func<ImageEditParams>)(() => WithLight(highlights: -40))];
        yield return ["light.shadows", (Func<ImageEditParams>)(() => WithLight(shadows: 40))];

        yield return ["details.sharpen", (Func<ImageEditParams>)(() => WithDetails(sharpen: 70))];
        yield return ["details.clarity", (Func<ImageEditParams>)(() => WithDetails(clarity: 45))];
        yield return ["details.smooth", (Func<ImageEditParams>)(() => WithDetails(smooth: 45))];
        yield return ["details.blur", (Func<ImageEditParams>)(() => WithDetails(blur: 45))];
        yield return ["details.grain", (Func<ImageEditParams>)(() => WithDetails(grain: 55))];

        yield return ["scene.vignette", (Func<ImageEditParams>)(() => WithScene(vignette: 40))];
        yield return ["scene.glamour", (Func<ImageEditParams>)(() => WithScene(glamour: 40))];
        yield return ["scene.bloom", (Func<ImageEditParams>)(() => WithScene(bloom: 40))];
        yield return ["scene.dehaze", (Func<ImageEditParams>)(() => WithScene(dehaze: 40))];
    }

    [Theory]
    [MemberData(nameof(SliderCases))]
    public void EachSlider_ChangesRenderedPixels(string sliderName, Func<ImageEditParams> buildParams)
    {
        var sut = new ImagePipelineService(NullLogger<ImagePipelineService>.Instance);

        using var baselineImage = CreateSampleImage();
        using var adjustedImage = CreateSampleImage();

        sut.ApplyAdjustments(baselineImage, ImageEditParams.Default);
        sut.ApplyAdjustments(adjustedImage, buildParams());

        var baseline = ExtractPixels(baselineImage);
        var adjusted = ExtractPixels(adjustedImage);

        var diff = CalculateAbsoluteDifference(baseline, adjusted);
        Assert.True(diff > 0, $"Expected slider '{sliderName}' to affect output, but no pixel changes were detected.");
    }

    private static Image<Rgba32> CreateSampleImage()
    {
        var image = new Image<Rgba32>(96, 64);
        image.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < image.Height; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < image.Width; x++)
                {
                    var r = (byte)((x * 255) / Math.Max(1, image.Width - 1));
                    var g = (byte)((y * 255) / Math.Max(1, image.Height - 1));
                    var b = (byte)(((x + y) * 255) / Math.Max(1, image.Width + image.Height - 2));
                    row[x] = new Rgba32(r, g, b, 255);
                }
            }
        });

        return image;
    }

    private static byte[] ExtractPixels(Image image)
    {
        using var rgba = image.CloneAs<Rgba32>();
        var bytes = new byte[rgba.Width * rgba.Height * 4];
        var offset = 0;
        rgba.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < rgba.Height; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < rgba.Width; x++)
                {
                    var px = row[x];
                    bytes[offset++] = px.R;
                    bytes[offset++] = px.G;
                    bytes[offset++] = px.B;
                    bytes[offset++] = px.A;
                }
            }
        });

        return bytes;
    }

    private static long CalculateAbsoluteDifference(byte[] a, byte[] b)
    {
        var len = Math.Min(a.Length, b.Length);
        long diff = 0;
        for (var i = 0; i < len; i++)
        {
            diff += Math.Abs(a[i] - b[i]);
        }

        return diff;
    }

    private static ImageEditParams WithColor(float vibrance = 0, float saturation = 0, float temperature = 0, float tint = 0, float hue = 0)
    {
        return ImageEditParams.Default with
        {
            Color = new ImageEditColorParams(vibrance, saturation, temperature, tint, hue)
        };
    }

    private static ImageEditParams WithLight(float brightness = 0, float exposure = 0, float contrast = 0, float black = 0, float white = 0, float highlights = 0, float shadows = 0)
    {
        return ImageEditParams.Default with
        {
            Light = new ImageEditLightParams(brightness, exposure, contrast, black, white, highlights, shadows)
        };
    }

    private static ImageEditParams WithDetails(float sharpen = 0, float clarity = 0, float smooth = 0, float blur = 0, float grain = 0)
    {
        return ImageEditParams.Default with
        {
            Details = new ImageEditDetailsParams(sharpen, clarity, smooth, blur, grain)
        };
    }

    private static ImageEditParams WithScene(float vignette = 0, float glamour = 0, float bloom = 0, float dehaze = 0)
    {
        return ImageEditParams.Default with
        {
            Scene = new ImageEditSceneParams(vignette, glamour, bloom, dehaze)
        };
    }
}
