# Color Management in Jmaka

## Overview

Jmaka ensures all output images are in JPEG format with embedded sRGB ICC color profiles. This document explains how color management works, its limitations, and best practices.

## Output Invariant

**ALL images saved by Jmaka have the following properties:**
- Format: JPEG (quality: 92)
- Color space: sRGB
- ICC profile: Embedded sRGB ICC profile
- No alpha channel (flattened to white background)
- No EXIF/XMP/IPTC metadata (except ICC profile)

## Implementation

### NormalizeToSrgb Function

The canonical color management function is `ImagePipelineService.NormalizeToSrgb()`. It performs the following operations **in order**:

1. **Auto-Orient**: Apply EXIF orientation correction to pixels
2. **Flatten Alpha**: Convert images with transparency to RGB with white background
3. **Detect Non-sRGB**: Check for existing ICC profiles and log warnings
4. **Strip Metadata**: Remove EXIF, XMP, IPTC (but keep ICC)
5. **Embed sRGB ICC**: Add canonical sRGB ICC profile to output

### Order of Operations

For all image processing pipelines:
1. Load image
2. Apply pixel operations (resize, crop, color adjustments, filters)
3. **Call NormalizeToSrgb() exactly once** before saving
4. Save as JPEG with embedded ICC profile

### Integration Points

NormalizeToSrgb is called in all image save paths:
- `/upload` - Initial upload conversion
- `/resize` - Resized versions
- `/crop` - Cropped versions
- `/split` & `/split3` - Composite images
- `/oknofix` & `/oknoscale` - Template-based compositions
- `/images/{id}/render` - Image edit preview
- `/images/{id}/save-edit` - Image edit save

## Limitations

### ImageSharp ICC Conversion Limitation

**IMPORTANT**: SixLabors.ImageSharp does NOT support ICC color profile conversion.

**What this means:**
- ImageSharp can READ and WRITE ICC profiles as metadata
- ImageSharp CANNOT transform pixel colors between color spaces
- If you upload an AdobeRGB image, the colors will NOT be accurately converted to sRGB

**Example scenario:**
1. User uploads image with AdobeRGB ICC profile and wide-gamut colors
2. Jmaka strips the AdobeRGB profile and embeds sRGB profile
3. **Problem**: The pixel RGB values remain unchanged (still AdobeRGB values)
4. When displayed with sRGB profile, colors may appear oversaturated or shifted

### Why Not ImageMagick?

ImageMagick (via Magick.NET) supports proper ICC color conversion, but:
- ImageSharp was already in use in this project
- ImageSharp is pure .NET (easier deployment)
- Most users upload sRGB images from phones/cameras
- For professional workflows requiring accurate color conversion, preprocessing with ImageMagick is recommended

## Best Practices

### For Users

1. **Recommended**: Upload images already in sRGB color space
   - Most phone cameras and web images are already sRGB
   - Convert professional photos to sRGB before upload

2. **Avoid**: Uploading wide-gamut images (AdobeRGB, ProPhoto RGB, Display P3)
   - Colors may shift or look incorrect
   - Professional color accuracy cannot be guaranteed

### For Developers

1. **Never bypass NormalizeToSrgb**: All image save paths must call it
2. **Check logs**: Monitor warnings about non-sRGB profiles
3. **Order matters**: Always normalize AFTER pixel operations
4. **Test with various inputs**: Use test images with different ICC profiles

## Diagnostics

### Logging

The service logs detailed information for every normalization:

```
NormalizeToSrgb: source=upload/abc123.jpg, format=Jpeg, size=1920x1080, 
  hasAlpha=false, hasIcc=true, iccSize=560, colorSpace=RGB
```

For non-sRGB inputs, a warning is logged:

```
[WARN] NormalizeToSrgb: Input has non-sRGB ICC profile (description: AdobeRGB). 
  ImageSharp cannot perform ICC color conversion. Pixel colors will not be transformed. 
  For accurate color conversion, consider preprocessing with ImageMagick.
```

### Monitoring

Monitor logs for:
- Frequency of non-sRGB uploads
- Color space distribution of uploads
- Any unexpected color profile warnings

## Testing

### Test Images

Create test fixtures with various ICC profiles:
- `test-srgb.jpg` - Standard sRGB (should process without warnings)
- `test-adobergb.jpg` - AdobeRGB profile (should log warning)
- `test-displayp3.png` - Display P3 profile (should log warning)
- `test-prophoto.tif` - ProPhoto RGB profile (should log warning)
- `test-no-icc.jpg` - No ICC profile (should embed sRGB)
- `test-alpha.png` - PNG with transparency (should flatten to white)

### Verification

For each test image:
1. Upload through API
2. Verify output is JPEG
3. Verify sRGB ICC profile is embedded
4. Verify appropriate logs are generated
5. Verify visual quality (manual review for color shifts)

## Future Improvements

Potential enhancements:
1. **Add ImageMagick preprocessing option**: For users requiring accurate color conversion
2. **Color space detection UI**: Warn users when uploading non-sRGB images
3. **Soft-proof rendering**: Show sRGB preview before conversion
4. **Rendering intent selection**: Allow users to choose Perceptual vs. Relative Colorimetric

## References

- [ICC Profile Specification](https://www.color.org/specification/ICC.2-2021.pdf)
- [sRGB Color Space](https://en.wikipedia.org/wiki/SRGB)
- [ImageSharp Documentation](https://docs.sixlabors.com/articles/imagesharp/)
- [ImageMagick Color Management](https://imagemagick.org/script/color-management.php)
