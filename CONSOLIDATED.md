# Jmaka — consolidated reference (latest)

Version: **0.3.2**

This document consolidates the current product, API, storage, and deployment details for Jmaka.

## Product overview
- ASP.NET Core Minimal API with a simple web UI for image and video processing.
- Primary use cases: upload, preview, resize, crop, composite (split/split3), card generation (OknoFix/OknoScale), image edits, and video processing.

## Core capabilities
### Images
- Multi-file image upload (up to 15 per request).
- Normalization to JPEG + sRGB.
- Automatic preview thumbnail generation at 320px width (`/preview`).
- History tracking for recent uploads.
- Resize on demand to fixed widths: **1280 / 1920 / 2440** (upscale allowed).
- Crop from the untouched original (`upload-original`), with preset aspect ratios in UI.
- Split: merge two images into 1280×720 with a 7px white divider.
- Split3: merge three images into 1280×720 with two 7px white dividers.
- OknoFix: fixed-window portrait card based on a PNG template.
- OknoScale: same card with adjustable window width.
- Image Edit: Brightness/Contrast/Saturation/Hue/Exposure/Vibrance preview + apply.

### Video
- Upload videos and store originals.
- Video processing: trimming/cutting, 2‑pass compression to a target size, H.264 output (no audio), 16:9 framing and vertical offset.

### Retention
- Automatic cleanup of entries and files older than the retention window.
- Default retention: **48 hours** (configurable).

## Runtime limits
- Max image upload size: **75 MB** per file.
- Max video upload size: **300 MB** per file.
- Multipart and server request body limits follow the video max size.

## Storage layout
Runtime storage root defaults to the app ContentRootPath, but can be moved via environment variables.

Directory structure (under `JMAKA_STORAGE_ROOT`):
- `upload/` — normalized originals (JPEG + sRGB).
- `upload-original/` — untouched originals for crop.
- `preview/` — 320px thumbnails.
- `resized/{width}/` — on-demand resized images.
- `split/`, `split3/` — composite outputs.
- `oknofix/`, `oknoscale/` — card outputs.
- `edits/`, `edits-preview/` — image edit results and previews.
- `video/`, `video-out/` — input videos and processed outputs.
- `data/` — JSON histories:
  - `history.json` (uploads + resized data)
  - `composites.json` (split/split3/okno/edit history)
  - `video-history.json` (video outputs)

## Environment variables
- `JMAKA_STORAGE_ROOT` — overrides runtime storage root.
- `JMAKA_BASE_PATH` — base path for running behind a reverse proxy (e.g., `/jmaka`).
- `JMAKA_RETENTION_HOURS` — retention window in hours (default 48).

## HTTP API (current)
### Upload & history
- `POST /upload` — multipart form-data: `files` (multi).
- `GET /history` — latest history entries (images).
- `POST /delete` — delete image entry and related files.

### Resizes & crop
- `POST /resize` — JSON `{ storedName, width }`.
- `POST /crop` — JSON `{ storedName, x, y, width, height }`.

### Composites & cards
- `POST /split` — JSON `{ storedNameA, storedNameB, a, b }`.
- `POST /split3` — JSON `{ storedNameA, storedNameB, storedNameC, a, b, c }`.
- `POST /oknofix` — JSON `{ storedName, x, y, w, h }`.
- `POST /oknoscale` — JSON `{ storedName, x, y, w, h }`.
- `GET /composites` — composite history.
- `POST /delete-composite` — delete composite by `relativePath`.

### Image edit
- `POST /image-edit-preview` — JSON `{ storedName, brightness, contrast, saturation, hue, exposure, vibrance }`.
- `POST /image-edit-apply` — JSON `{ storedName, brightness, contrast, saturation, hue, exposure, vibrance }`.

### Video
- `POST /upload-video` — multipart form-data: `file`.
- `POST /video-process` — JSON `{ storedName, trimStartSec, trimEndSec, cutStartSec, cutEndSec, outputWidth, targetSizeMb, verticalOffsetPx }`.
- `GET /video-history` — video output history.
- `POST /delete-video` — delete video history entry + files.

## Local run & build
### Run
```bash
dotnet run --project src/Jmaka.Api --launch-profile http
```
Open: `http://localhost:5189/`.

### Build
```bash
dotnet build Jmaka.slnx -c Release
```

## Deployment (Ubuntu 24)
- Use `deploy/ubuntu24/install.sh` for initial install.
- Use `deploy/ubuntu24/update-instance.sh` for updates.
- Recommended workflow: download the latest release archive and run the installer.

