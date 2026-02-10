# Manual Testing Guide for Color Management

## Prerequisites

- dotnet SDK 10.0
- Test images with various ICC profiles (see below)

## Running the Application

```bash
cd src/Jmaka.Api
dotnet run --launch-profile http
```

Application will start at `http://localhost:5189/`

## Test Cases

### Test 1: Basic Upload - sRGB JPEG

**Input**: Any standard JPEG from phone/camera (typically sRGB)

**Expected Result**:
- Upload succeeds
- Output is JPEG
- Logs show: `hasIcc=true` or `hasIcc=false`
- If hasIcc=true and sRGB: log shows "Input already has sRGB profile"
- No warning about non-sRGB profile

**Verification**:
```bash
# Check logs for
journalctl -u jmaka-<name> | grep "NormalizeToSrgb"
```

### Test 2: PNG with Transparency

**Input**: PNG file with alpha channel

**Expected Result**:
- Upload succeeds
- Alpha channel flattened to white
- Output is JPEG (no transparency)
- Logs show: `hasAlpha=true`

### Test 3: Non-sRGB Profile (if available)

**Input**: Image with AdobeRGB, ProPhoto RGB, or Display P3 profile

**Expected Result**:
- Upload succeeds
- Output is JPEG with sRGB ICC
- **WARNING** in logs: "Input has non-sRGB ICC profile ... ImageSharp cannot perform ICC color conversion"
- Colors may appear shifted (this is expected limitation)

### Test 4: Image Edit Pipeline

**Test**: Upload image → Apply edits (brightness, contrast) → Save

**Expected Result**:
- Edits apply correctly
- Final output is JPEG with sRGB ICC
- Logs show NormalizeToSrgb called once at the end

### Test 5: Resize/Crop Operations

**Test**: Upload image → Resize to 1280 → or → Crop to 1:1

**Expected Result**:
- Operations complete successfully
- All outputs are JPEG with sRGB ICC
- Logs show NormalizeToSrgb called for each operation

### Test 6: Composite Operations

**Test**: Upload 2-3 images → Create Split or Split3

**Expected Result**:
- Composite created successfully
- Output is JPEG with sRGB ICC
- All input images processed through NormalizeToSrgb

## Verification Methods

### 1. Check ICC Profile with exiftool

Install exiftool:
```bash
sudo apt-get install libimage-exiftool-perl
```

Check profile:
```bash
exiftool -IccProfile output.jpg
exiftool -ColorSpace output.jpg
```

Expected output:
```
ICC Profile: sRGB IEC61966-2.1
Color Space: sRGB
```

### 2. Check with ImageMagick identify

```bash
identify -verbose output.jpg | grep -i "colorspace\|profile"
```

Expected:
```
Colorspace: sRGB
Profiles:
  Profile-icc: 560 bytes
```

### 3. Visual Inspection

- Images should display correctly in browsers
- No unexpected color shifts for typical sRGB inputs
- Wide-gamut inputs (AdobeRGB, etc.) may show color shifts - this is expected

## Known Limitations

### ❌ What Does NOT Work

1. **ICC Color Conversion**: ImageSharp cannot transform pixel values between color spaces
   - AdobeRGB → sRGB: Colors may oversaturate
   - ProPhoto RGB → sRGB: Colors may oversaturate
   - Display P3 → sRGB: Colors may shift

### ✅ What DOES Work

1. **Profile Embedding**: All outputs have embedded sRGB ICC
2. **Alpha Flattening**: Transparency correctly converted to white
3. **Metadata Stripping**: EXIF/XMP/IPTC removed, ICC kept
4. **Auto-Orient**: EXIF orientation applied to pixels
5. **Logging**: Comprehensive diagnostics for all operations

## Troubleshooting

### Issue: No logs appearing

**Solution**: Check log level in `appsettings.json`:
```json
{
  "Logging": {
    "LogLevel": {
      "Jmaka.Api.Services.ImagePipelineService": "Debug"
    }
  }
}
```

### Issue: Colors look wrong

**Expected** if:
- Input has wide-gamut profile (AdobeRGB, ProPhoto)
- Warning logged about non-sRGB profile

**Not Expected** if:
- Input is standard sRGB
- Check logs for unexpected errors

### Issue: Transparency shows as black instead of white

**Check**:
- Alpha handling in NormalizeToSrgb
- Logs should show `hasAlpha=true`
- This should be fixed - report as bug

## Creating Test Images

### sRGB Test Image
```bash
# Using ImageMagick to create test sRGB image
convert -size 800x600 gradient:red-blue -colorspace sRGB -profile /usr/share/color/icc/sRGB.icc test-srgb.jpg
```

### AdobeRGB Test Image
```bash
# If you have AdobeRGB profile
convert -size 800x600 gradient:red-blue -profile AdobeRGB1998.icc test-adobergb.jpg
```

### PNG with Alpha
```bash
convert -size 800x600 gradient:red-blue -channel Alpha -evaluate set 50% test-alpha.png
```

## Success Criteria

All tests pass if:
1. ✅ All outputs are JPEG format
2. ✅ All outputs have embedded ICC profile
3. ✅ sRGB inputs process without warnings
4. ✅ Non-sRGB inputs log warnings
5. ✅ Alpha channels flatten to white
6. ✅ No crashes or errors
7. ✅ Logs show NormalizeToSrgb called in all paths

## Reporting Issues

When reporting issues, include:
1. Input image details (format, color space, profile)
2. Operation performed (upload, edit, resize, etc.)
3. Log excerpt showing NormalizeToSrgb call
4. Expected vs actual output
5. exiftool output of result
