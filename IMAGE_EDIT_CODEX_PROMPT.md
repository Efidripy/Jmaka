# Image Edit UI + Backend Feature Implementation (Realtime, Zero-Centered Sliders, Select Images)

Copy/paste the block below into Codex as a single prompt:

```
# Task: Implement Image Edit UI & Backend (Realtime sliders, zero centered, select saved images)

## High-Level Requirements
We need to build an advanced Image Edit section with real-time editing, zero-centered sliders, selection of already uploaded images, and a Compare (hold to compare) feature. Sliders and UI must match the following groups:

- Presets: Auto, B&W, Pop
- Color: Vibrance, Saturation, Temperature, Tint, Hue
- Light: Brightness, Exposure, Contrast, Black, White, Highlights, Shadows
- Details: Sharpen, Clarity, Smooth, Blur, Grain
- Scene: Vignette, Glamour, Bloom, Dehaze

Each slider must:
- Always show the zero position (0) as the center tick.
- Support double-click / reset to 0.
- Have a displayed numeric value.

Editing must be **real-time** with no noticeable delays during user interaction.

Support:
- Selecting an image from a list of previously uploaded and saved edits.
- “Compare” button that on hold switches to original image preview.

The final result should be rendered and saved via backend endpoints using Magick.NET.

## What to implement (for Codex)

### 1. Data Model
Create a shared data object `ImageEditParams` with all slider values and preset enum:

```
type ImageEditParams = {
  imageId: string;
  preset: "None" | "Auto" | "BW" | "Pop";
  color: {
    vibrance: number;
    saturation: number;
    temperature: number;
    tint: number;
    hue: number;
  };
  light: {
    brightness: number;
    exposure: number;
    contrast: number;
    black: number;
    white: number;
    highlights: number;
    shadows: number;
  };
  details: {
    sharpen: number;
    clarity: number;
    smooth: number;
    blur: number;
    grain: number;
  };
  scene: {
    vignette: number;
    glamour: number;
    bloom: number;
    dehaze: number;
  };
};
```

### 2. UI Components (Frontend)

1. **ImageSelector**
   - Fetch list of saved and original images from `GET /images`.
   - Show thumbnails + name + “Save” + “Delete”.

2. **PreviewCanvas**
   - Main preview area using a canvas/WebGL layer for fast real-time editing.
   - When sliders change, update preview via client side filter application.

3. **CompareButton**
   - A button labeled “Hold to Compare”.
   - On pointer down: show original image preview.
   - On pointer up: restore edited preview.

4. **PresetsBar**
   - Buttons: Auto, B&W, Pop.
   - Clicking applies preset values to `ImageEditParams` and updates preview.

5. **Sliders Panel**
   - Group panels: Color, Light, Details, Scene.
   - Each slider uses a `SliderWithZero` component:
     - Range symmetric around zero (e.g., -100 → +100).
     - Zero tick in middle.
     - Numeric value next to slider.
     - Double-click on label or value resets to 0.

Example UI widget:

```
<SliderWithZero
  label="Saturation"
  min={-100}
  max={100}
  value={params.color.saturation}
  onChange={(v) => updateParam("color.saturation", v)}
/>
```

6. **Real-time preview logic**
   - Use `requestAnimationFrame` throttling.
   - Apply filters on the preview canvas with same math as backend.
   - Ensure smooth interactions at 30–60 FPS.

### 3. Backend Endpoints

1. **List Images**

```
GET /images
Response: [{ id, name, thumbnailUrl, type: "original" | "saved" }]
```

2. **Render Preview / Final**

```
POST /images/{id}/render
Body: ImageEditParams
Action: apply edits via Magick.NET to original image
Returns: rendered image bytes or URL
```

3. **Save Edited Image**

```
POST /images/{id}/save-edit
Body: ImageEditParams
Action: render + save as new “saved” image, create thumbnail
Returns: { newImageId, url, thumbUrl }
```

4. **Delete Image**

```
DELETE /images/{id}
```

### 4. Shared Filter Math
Create a shared specification file `slider_math.md` or YAML with formulas for each slider, for both client and server:
- How saturation changes pixel values
- How temperature/tint transform RGB
- Light adjustments
- Sharpen/clarity/smooth/blur/grain definitions

Ensure preview (client) and final render (backend) use identical math.

## Accept Criteria

1. Sliders instantly update preview (no spinner, no lag).
2. Zero marker visible and selectable.
3. Compare hold button works reliably.
4. UI consistent with the reference screenshot layout.
5. Saving edited images stores correct rendered results.
6. Backend endpoints work and use Magick.NET for final rendering.

## Notes

- Use canvas/WebGL for fast preview.
- Keep slider values normalized (e.g., -100..100).
- Make the presets override only relevant fields.
```
