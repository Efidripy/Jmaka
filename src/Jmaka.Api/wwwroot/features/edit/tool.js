// -------- Image Edit --------
const defaultImageEditParams = () => ({
  preset: 'None',
  color: { vibrance: 0, saturation: 0, temperature: 0, tint: 0, hue: 0 },
  light: { brightness: 0, exposure: 0, contrast: 0, black: 0, white: 0, highlights: 0, shadows: 0 },
  details: { sharpen: 0, clarity: 0, smooth: 0, blur: 0, grain: 0 },
  scene: { vignette: 0, glamour: 0, bloom: 0, dehaze: 0 }
});

const presetValues = {
  Auto: {
    color: { vibrance: 8, saturation: 4, temperature: 0, tint: 0, hue: 0 },
    light: { brightness: 2, exposure: 2, contrast: 7, black: 0, white: 0, highlights: -4, shadows: 6 },
    details: { sharpen: 4, clarity: 8, smooth: 0, blur: 0, grain: 0 },
    scene: { vignette: 0, glamour: 0, bloom: 0, dehaze: 4 }
  },
  BW: {
    color: { vibrance: 0, saturation: -100, temperature: 0, tint: 0, hue: 0 },
    light: { brightness: 0, exposure: 0, contrast: 12, black: 4, white: 4, highlights: -5, shadows: 6 },
    details: { sharpen: 4, clarity: 6, smooth: 0, blur: 0, grain: 5 },
    scene: { vignette: 10, glamour: 0, bloom: 0, dehaze: 0 }
  },
  Pop: {
    color: { vibrance: 24, saturation: 14, temperature: 0, tint: 0, hue: 0 },
    light: { brightness: 0, exposure: 0, contrast: 14, black: 2, white: 4, highlights: -4, shadows: 5 },
    details: { sharpen: 10, clarity: 15, smooth: 0, blur: 0, grain: 0 },
    scene: { vignette: 8, glamour: 0, bloom: 2, dehaze: 8 }
  }
};

function clampPresetValue(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function analyzeImageStats(imageData) {
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;
  const targetSamples = 20000;
  const step = Math.max(1, Math.floor(totalPixels / targetSamples));

  let sumLuma = 0;
  let sumLumaSq = 0;
  let satSum = 0;
  let highClip = 0;
  let lowClip = 0;
  let samples = 0;

  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

    sumLuma += luma;
    sumLumaSq += luma * luma;
    satSum += sat;
    if (luma > 245) highClip += 1;
    if (luma < 10) lowClip += 1;
    samples += 1;
  }

  if (!samples) {
    return {
      meanLuma: 128,
      contrastStd: 48,
      meanSaturation: 0.32,
      highClipRatio: 0,
      lowClipRatio: 0
    };
  }

  const meanLuma = sumLuma / samples;
  const variance = Math.max(0, (sumLumaSq / samples) - (meanLuma * meanLuma));
  return {
    meanLuma,
    contrastStd: Math.sqrt(variance),
    meanSaturation: satSum / samples,
    highClipRatio: highClip / samples,
    lowClipRatio: lowClip / samples
  };
}

function buildAdaptiveAutoPreset(stats) {
  const lumaError = 126 - stats.meanLuma;
  const contrastError = 52 - stats.contrastStd;
  const satError = 0.34 - stats.meanSaturation;
  const clipBias = stats.highClipRatio - stats.lowClipRatio;

  return {
    color: {
      vibrance: clampPresetValue(8 + satError * 80 - clipBias * 12, -100, 100),
      saturation: clampPresetValue(4 + satError * 55 - clipBias * 8, -100, 100),
      temperature: 0,
      tint: 0,
      hue: 0
    },
    light: {
      brightness: clampPresetValue(lumaError * 0.35, -100, 100),
      exposure: clampPresetValue(lumaError * 0.28, -100, 100),
      contrast: clampPresetValue(contrastError * 0.55, -100, 100),
      black: clampPresetValue(stats.lowClipRatio * 120 - 2, -100, 100),
      white: clampPresetValue(stats.highClipRatio * 120 - 2, -100, 100),
      highlights: clampPresetValue(-stats.highClipRatio * 260 + lumaError * 0.08, -100, 100),
      shadows: clampPresetValue(stats.lowClipRatio * 240 + lumaError * 0.14, -100, 100)
    },
    details: {
      sharpen: clampPresetValue(3 + Math.max(0, 56 - stats.contrastStd) * 0.10, -100, 100),
      clarity: clampPresetValue(6 + Math.max(0, 55 - stats.contrastStd) * 0.18, -100, 100),
      smooth: 0,
      blur: 0,
      grain: 0
    },
    scene: {
      vignette: 0,
      glamour: 0,
      bloom: clampPresetValue(Math.max(0, 118 - stats.meanLuma) * 0.08, -100, 100),
      dehaze: clampPresetValue(Math.max(0, 56 - stats.contrastStd) * 0.22, -100, 100)
    }
  };
}

function buildAdaptivePopPreset(stats) {
  const lowSatBoost = Math.max(0, 0.46 - stats.meanSaturation);
  const lowContrastBoost = Math.max(0, 58 - stats.contrastStd);
  const protectHighlights = stats.highClipRatio * 1.0;

  return {
    color: {
      vibrance: clampPresetValue(20 + lowSatBoost * 90, -100, 100),
      saturation: clampPresetValue(10 + lowSatBoost * 55, -100, 100),
      temperature: 0,
      tint: 0,
      hue: 0
    },
    light: {
      brightness: clampPresetValue((120 - stats.meanLuma) * 0.12, -100, 100),
      exposure: clampPresetValue((122 - stats.meanLuma) * 0.10, -100, 100),
      contrast: clampPresetValue(12 + lowContrastBoost * 0.16 - protectHighlights * 8, -100, 100),
      black: clampPresetValue(2 + lowContrastBoost * 0.05, -100, 100),
      white: clampPresetValue(4 - protectHighlights * 20, -100, 100),
      highlights: clampPresetValue(-4 - protectHighlights * 45, -100, 100),
      shadows: clampPresetValue(4 + Math.max(0, 0.03 - stats.lowClipRatio) * 150, -100, 100)
    },
    details: {
      sharpen: clampPresetValue(8 + lowContrastBoost * 0.09, -100, 100),
      clarity: clampPresetValue(14 + lowContrastBoost * 0.12, -100, 100),
      smooth: 0,
      blur: 0,
      grain: 0
    },
    scene: {
      vignette: clampPresetValue(7 + lowContrastBoost * 0.03, -100, 100),
      glamour: 0,
      bloom: clampPresetValue(Math.max(0, 115 - stats.meanLuma) * 0.08, -100, 100),
      dehaze: clampPresetValue(8 + lowContrastBoost * 0.16, -100, 100)
    }
  };
}

function getAdaptivePresetValues(presetKey) {
  const source = imageEditState && imageEditState.originalImageData;
  if (!source) return presetValues[presetKey] || null;
  const stats = analyzeImageStats(source);
  if (presetKey === 'Auto') return buildAdaptiveAutoPreset(stats);
  if (presetKey === 'Pop') return buildAdaptivePopPreset(stats);
  return presetValues[presetKey] || null;
}

function cloneParams(params) {
  return JSON.parse(JSON.stringify(params));
}

function getParamByPath(params, path) {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), params);
}

function setParamByPath(params, path, value) {
  const parts = path.split('.');
  let current = params;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function resetImageEditParams() {
  imageEditState.params = defaultImageEditParams();
  imageEditState.selectedPreset = 'None';
  syncPresetButtons();
  syncSliderUI();
}

function syncPresetButtons() {
  if (!imageEditPresetBtns) return;
  for (const btn of imageEditPresetBtns) {
    const preset = btn.dataset.preset;
    btn.classList.toggle('is-active', preset === imageEditState.selectedPreset);
  }
}

function syncSliderUI() {
  if (!imageEditSliderRows) return;
  for (const row of imageEditSliderRows) {
    const path = row.dataset.param;
    const value = Number(getParamByPath(imageEditState.params, path) || 0);
    const input = row.querySelector('input[type="range"]');
    const valueEl = row.querySelector('.slider-value');
    if (input) input.value = String(value);
    if (valueEl) valueEl.textContent = String(value);
  }
}

function normalizeInputValue(row, inputValue) {
  const min = Number(row.dataset.min);
  const max = Number(row.dataset.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return Number(inputValue);
  const clamped = Math.max(min, Math.min(max, Number(inputValue)));
  return clamped;
}

function initImageEditSliders() {
  if (!imageEditSliderRows) return;
  for (const row of imageEditSliderRows) {
    const input = row.querySelector('input[type="range"]');
    const label = row.querySelector('.slider-label');
    const valueEl = row.querySelector('.slider-value');
    const min = row.dataset.min || '-100';
    const max = row.dataset.max || '100';
    if (input) {
      input.min = min;
      input.max = max;
      input.step = '1';
      input.value = '0';
      input.addEventListener('input', () => {
        const normalized = normalizeInputValue(row, input.value);
        setParamByPath(imageEditState.params, row.dataset.param, normalized);
        imageEditState.params.preset = 'None';
        if (valueEl) valueEl.textContent = String(normalized);
        imageEditState.selectedPreset = 'None';
        syncPresetButtons();
        scheduleImageEditRender();
      });
    }
    const resetHandler = () => {
      setParamByPath(imageEditState.params, row.dataset.param, 0);
      imageEditState.params.preset = 'None';
      if (input) input.value = '0';
      if (valueEl) valueEl.textContent = '0';
      imageEditState.selectedPreset = 'None';
      syncPresetButtons();
      scheduleImageEditRender();
    };
    if (label) label.addEventListener('dblclick', resetHandler);
    if (valueEl) valueEl.addEventListener('click', resetHandler);
  }
}

function applyPreset(presetKey) {
  const preset = getAdaptivePresetValues(presetKey);
  if (!preset) return;
  imageEditState.params = {
    preset: presetKey,
    color: { ...preset.color },
    light: { ...preset.light },
    details: { ...preset.details },
    scene: { ...preset.scene }
  };
  imageEditState.selectedPreset = presetKey;
  syncPresetButtons();
  syncSliderUI();
  scheduleImageEditRender();
}

function updatePanelCollapsing() {
  if (!imageEditPanelHeaders) return;
  for (const header of imageEditPanelHeaders) {
    header.addEventListener('click', () => {
      const panel = header.closest('.edit-panel');
      if (panel) {
        panel.classList.toggle('is-collapsed');
      }
    });
  }
}

function scheduleImageEditRender() {
  if (!imageEditState.open) return;
  if (imageEditState.renderQueued) return;
  imageEditState.renderQueued = true;
  requestAnimationFrame(() => {
    imageEditState.renderQueued = false;
    renderImageEditPreview();
  });
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, value));
}

function applyAdjustmentsToImageData(imageData, params) {
  const data = imageData.data;
  const brightness = params.light.brightness / 100;
  const exposure = params.light.exposure / 100;
  const contrast = params.light.contrast / 100;
  const saturation = params.color.saturation / 100;
  const vibrance = params.color.vibrance / 100;
  const hue = params.color.hue;
  const temperature = params.color.temperature / 100;
  const tint = params.color.tint / 100;
  const highlights = params.light.highlights / 100;
  const shadows = params.light.shadows / 100;
  const black = params.light.black / 100;
  const white = params.light.white / 100;
  const clarity = params.details.clarity / 100;
  const grain = params.details.grain / 100;
  const vignette = params.scene.vignette / 100;
  const dehaze = params.scene.dehaze / 100;
  const glamour = params.scene.glamour / 100;
  const bloom = params.scene.bloom / 100;

  const contrastFactor = (1 + contrast + clarity * 0.3 + dehaze * 0.2);
  const brightnessOffset = brightness * 40 + exposure * 60 + bloom * 25;

  const hueShift = (hue / 180) * Math.PI;
  const cosH = Math.cos(hueShift);
  const sinH = Math.sin(hueShift);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Temperature & tint.
    r += temperature * 18;
    b -= temperature * 18;
    g += tint * 12;
    r -= tint * 6;
    b -= tint * 6;

    // Contrast/brightness.
    r = (r - 128) * contrastFactor + 128 + brightnessOffset;
    g = (g - 128) * contrastFactor + 128 + brightnessOffset;
    b = (b - 128) * contrastFactor + 128 + brightnessOffset;

    // Black/white, highlights/shadows.
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luma < 128) {
      const shadowBoost = (shadows + black * 0.6) * (1 - luma / 128);
      r += shadowBoost * 55;
      g += shadowBoost * 55;
      b += shadowBoost * 55;
    } else {
      const highlightBoost = (highlights + white * 0.6) * ((luma - 128) / 127);
      r += highlightBoost * 55;
      g += highlightBoost * 55;
      b += highlightBoost * 55;
    }

    // Hue rotation.
    const rPrime = r * (0.299 + 0.701 * cosH + 0.168 * sinH) +
      g * (0.587 - 0.587 * cosH + 0.330 * sinH) +
      b * (0.114 - 0.114 * cosH - 0.497 * sinH);
    const gPrime = r * (0.299 - 0.299 * cosH - 0.328 * sinH) +
      g * (0.587 + 0.413 * cosH + 0.035 * sinH) +
      b * (0.114 - 0.114 * cosH + 0.292 * sinH);
    const bPrime = r * (0.299 - 0.300 * cosH + 1.250 * sinH) +
      g * (0.587 - 0.588 * cosH - 1.050 * sinH) +
      b * (0.114 + 0.886 * cosH - 0.203 * sinH);

    r = rPrime;
    g = gPrime;
    b = bPrime;

    // Saturation + vibrance.
    const avg = (r + g + b) / 3;
    const satFactor = 1 + saturation + (vibrance * (1 - Math.abs(avg - 128) / 128));
    r = avg + (r - avg) * satFactor;
    g = avg + (g - avg) * satFactor;
    b = avg + (b - avg) * satFactor;

    // Glamour/Dehaze tweak.
    r += glamour * 6;
    g += glamour * 6;
    b += glamour * 6;

    // Grain.
    if (grain !== 0) {
      const noise = (Math.random() - 0.5) * grain * 18;
      r += noise;
      g += noise;
      b += noise;
    }

    // Vignette.
    if (vignette !== 0) {
      const x = (i / 4) % imageData.width;
      const y = Math.floor(i / 4 / imageData.width);
      const dx = (x / imageData.width) - 0.5;
      const dy = (y / imageData.height) - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vig = 1 - Math.min(1, dist * 1.6) * Math.abs(vignette);
      r *= vig;
      g *= vig;
      b *= vig;
    }

    data[i] = clampChannel(r);
    data[i + 1] = clampChannel(g);
    data[i + 2] = clampChannel(b);
  }
  return imageData;
}

function renderImageEditPreview() {
  if (!imageEditCanvas || !imageEditState.originalImageData) return;
  const ctx = imageEditCanvas.getContext('2d');
  if (!ctx) return;

  if (imageEditState.compare) {
    ctx.putImageData(imageEditState.originalImageData, 0, 0);
    return;
  }

  const params = imageEditState.params || defaultImageEditParams();
  const blurVal = Math.max(params.details.blur, params.details.smooth, params.scene.glamour > 0 ? 8 : 0);
  let baseImageData = imageEditState.originalImageData;

  if (blurVal > 0) {
    if (!imageEditState.offscreen) {
      imageEditState.offscreen = document.createElement('canvas');
    }
    const off = imageEditState.offscreen;
    off.width = imageEditCanvas.width;
    off.height = imageEditCanvas.height;
    const offCtx = off.getContext('2d');
    if (offCtx) {
      const blurPx = (blurVal / 100) * 6;
      offCtx.filter = `blur(${blurPx}px)`;
      if (imageEditState.baseImage) {
        offCtx.drawImage(imageEditState.baseImage, 0, 0, off.width, off.height);
      } else {
        offCtx.putImageData(imageEditState.originalImageData, 0, 0);
      }
      offCtx.filter = 'none';
      baseImageData = offCtx.getImageData(0, 0, off.width, off.height);
    }
  } else {
    baseImageData = new ImageData(
      new Uint8ClampedArray(imageEditState.originalImageData.data),
      imageEditState.originalImageData.width,
      imageEditState.originalImageData.height
    );
  }

  const adjusted = applyAdjustmentsToImageData(baseImageData, params);
  ctx.putImageData(adjusted, 0, 0);
}

async function loadImageEditBase(url) {
  if (!imageEditCanvas) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  // Limit to reasonable size but consider both dimensions
  const maxDimension = 1280;
  let scale = 1;
  
  // Scale down if either dimension exceeds the maximum
  if (img.width > maxDimension || img.height > maxDimension) {
    const widthScale = maxDimension / img.width;
    const heightScale = maxDimension / img.height;
    // Use the smaller scale to ensure both dimensions fit
    scale = Math.min(widthScale, heightScale);
  }
  
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  imageEditCanvas.width = width;
  imageEditCanvas.height = height;
  const ctx = imageEditCanvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, width, height);
  imageEditState.baseImage = img;
  imageEditState.originalImageData = ctx.getImageData(0, 0, width, height);
  scheduleImageEditRender();
}

function selectImageEditItem(item) {
  imageEditState.selected = item;
  imageEditState.storedName = item.storedName;
  imageEditState.baseUrl = item.url || item.previewUrl;
  if (imageEditHint) imageEditHint.textContent = 'Настройте параметры и сохраните.';
  if (item.type === 'saved' && item.editParams) {
    imageEditState.params = cloneParams(item.editParams);
    imageEditState.selectedPreset = item.editParams.preset || 'None';
  } else {
    resetImageEditParams();
  }
  syncSliderUI();
  syncPresetButtons();
  if (imageEditApplyBtn) imageEditApplyBtn.disabled = false;
  if (imageEditState.baseUrl) {
    loadImageEditBase(withCacheBust(imageEditState.baseUrl, item.storedName || ''));
  }
  updateImageListActiveState();
}

function updateImageListActiveState() {
  const lists = [imageEditTopList];
  for (const list of lists) {
    if (!list) continue;
    const items = list.querySelectorAll('[data-id]');
    items.forEach((el) => {
      const id = el.dataset.id;
      el.classList.toggle('is-active', imageEditState.selected && imageEditState.selected.id === id);
    });
  }
}

function buildImagePickerElement(item) {
  const el = document.createElement('button');
  el.className = 'edit-pick-item';
  el.type = 'button';
  el.dataset.id = item.id;

  const thumbUrl = item.thumbnailUrl || item.previewUrl || item.url || '';

  const thumb = document.createElement('img');
  thumb.className = 'edit-pick-thumb';
  thumb.src = withCacheBust(thumbUrl, item.storedName || '');
  thumb.alt = item.name || item.id || '';
  thumb.loading = 'lazy';

  thumb.addEventListener('error', () => {
    const fallback = item.previewUrl || item.url || item.thumbnailUrl || '';
    if (!fallback || thumb.dataset.fallbackApplied === '1') {
      el.classList.add('is-broken');
      return;
    }
    thumb.dataset.fallbackApplied = '1';
    thumb.src = withCacheBust(fallback, item.storedName || '');
  });

  el.append(thumb);
  el.addEventListener('click', () => selectImageEditItem(item));
  return el;
}

async function loadImageEditList() {
  try {
    const res = await fetch(toAbsoluteUrl('history'), { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !Array.isArray(data)) throw new Error('failed');

    imageEditState.items = data
      .filter((it) => it && it.storedName)
      .map((it) => ({
        id: it.storedName,
        name: it.originalName || it.storedName,
        type: 'original',
        storedName: it.storedName,
        url: it.originalRelativePath,
        previewUrl: it.previewRelativePath || it.originalRelativePath,
        thumbnailUrl: it.previewRelativePath || it.originalRelativePath,
        createdAt: it.createdAt
      }));

    if (imageEditTopList) {
      imageEditTopList.innerHTML = '';
      imageEditState.items.forEach((item) => {
        imageEditTopList.append(buildImagePickerElement(item));
      });
    }

    if (!imageEditState.items.length && imageEditHint) {
      imageEditHint.textContent = 'Нет загруженных изображений в разделе Original.';
    }

    updateImageListActiveState();
  } catch (err) {
    if (imageEditHint) imageEditHint.textContent = 'Не удалось загрузить список изображений.';
  }
}

async function saveImageEdit(itemOverride) {
  const item = itemOverride || imageEditState.selected;
  if (!item) return;
  if (imageEditHint) imageEditHint.textContent = t('saving');
  const payload = {
    imageId: item.id,
    preset: imageEditState.params?.preset || 'None',
    color: imageEditState.params?.color,
    light: imageEditState.params?.light,
    details: imageEditState.params?.details,
    scene: imageEditState.params?.scene
  };
  try {
    const res = await fetch(toAbsoluteUrl(`images/${encodeURIComponent(item.id)}/save-edit`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data && data.error ? data.error : 'save failed');
    if (imageEditHint) imageEditHint.textContent = t('saveDone');
    await loadImageEditList();
  } catch (err) {
    if (imageEditHint) imageEditHint.textContent = t('saveError');
  }
}

async function deleteImageEditItem(item) {
  if (!item) return;
  try {
    await fetch(toAbsoluteUrl(`images/${encodeURIComponent(item.id)}`), { method: 'DELETE' });
    await loadImageEditList();
  } catch (err) {
    if (imageEditHint) imageEditHint.textContent = 'Ошибка удаления.';
  }
}

function closeImageEdit() {
  if (!imageEditModal) return;
  imageEditModal.hidden = true;
  imageEditState.open = false;
  imageEditState.selected = null;
  imageEditState.originalImageData = null;
  imageEditState.baseUrl = null;
}

function openImageEdit() {
  if (!imageEditModal) return;
  imageEditModal.hidden = false;
  imageEditState.open = true;
  resetImageEditParams();
  if (imageEditHint) imageEditHint.textContent = 'Выберите изображение из верхнего списка.';
  if (imageEditApplyBtn) imageEditApplyBtn.disabled = true;
  loadImageEditList();
}

if (imageEditToolBtn) {
  imageEditToolBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openImageEdit();
  });
}
if (imageEditCloseBtn) imageEditCloseBtn.addEventListener('click', closeImageEdit);
if (imageEditCancelBtn) imageEditCancelBtn.addEventListener('click', closeImageEdit);
if (imageEditModal) {
  imageEditModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) closeImageEdit();
  });
}

if (imageEditRefreshTop) imageEditRefreshTop.addEventListener('click', () => loadImageEditList());

function getImageEditPayload() {
  const params = imageEditState.params || defaultImageEditParams();
  return {
    imageId: imageEditState.storedName,
    preset: imageEditState.selectedPreset || 'None',
    color: params.color,
    light: params.light,
    details: params.details,
    scene: params.scene
  };
}

if (imageEditApplyBtn) {
  imageEditApplyBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!imageEditState.open || !imageEditState.storedName) return;
    const payload = getImageEditPayload();
    
    try {
      if (imageEditApplyBtn) imageEditApplyBtn.disabled = true;
      setBusy(true);
      if (imageEditHint) imageEditHint.textContent = t('saving');

      const res = await fetch(toAbsoluteUrl(`images/${imageEditState.storedName}/save-edit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }

      if (!res.ok) {
        if (imageEditHint) imageEditHint.textContent = t('saveError');
        showResult(data);
        return;
      }

      showResult(data);
      await loadComposites();
      await loadImageEditList();

      hint.textContent = t('editCreated');
      closeImageEdit();
    } catch (e) {
      if (imageEditHint) imageEditHint.textContent = t('saveError');
      showResult(String(e));
    } finally {
      setBusy(false);
      if (imageEditApplyBtn) imageEditApplyBtn.disabled = false;
    }
  });
}

// Initialize preset buttons
if (imageEditPresetBtns && imageEditPresetBtns.length > 0) {
  for (const btn of imageEditPresetBtns) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const preset = btn.dataset.preset;
      if (preset) {
        applyPreset(preset);
      }
    });
  }
}

// Initialize compare button
if (imageEditCompareBtn) {
  imageEditCompareBtn.addEventListener('mousedown', () => {
    imageEditState.compare = true;
    scheduleImageEditRender();
  });
  imageEditCompareBtn.addEventListener('mouseup', () => {
    imageEditState.compare = false;
    scheduleImageEditRender();
  });
  imageEditCompareBtn.addEventListener('mouseleave', () => {
    imageEditState.compare = false;
    scheduleImageEditRender();
  });
  imageEditCompareBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    imageEditState.compare = true;
    scheduleImageEditRender();
  });
  imageEditCompareBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    imageEditState.compare = false;
    scheduleImageEditRender();
  });
}

// Initialize sliders
initImageEditSliders();

// Initialize panel collapsing
updatePanelCollapsing();

// Load version from API and update all UI elements
async function loadVersion() {
  try {
    const res = await fetch('/api/version');
    if (res.ok) {
      const data = await res.json();
      if (data.version) {
        APP_VERSION = data.version;
        updateAllVersions(data.version);
      }
    }
  } catch (e) {
    console.warn('Failed to load version from API, using fallback version:', APP_VERSION, e);
  }
}

// Update all version displays in the UI
function updateAllVersions(version) {
  const versionElements = document.querySelectorAll('[data-version]');
  versionElements.forEach(el => {
    if (el.tagName === 'SPAN' || el.tagName === 'DIV') {
      el.textContent = version;
    }
  });
}

// Initialize ASCII art logo
function initAsciiLogo() {
  const asciiArt = document.getElementById('asciiArt');
  if (asciiArt && typeof window.getRandomAsciiArt === 'function') {
    asciiArt.textContent = window.getRandomAsciiArt();
  }
}

// Initialize version and ASCII logo on page load
// Wait for DOMContentLoaded to ensure ascii-art.js has loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadVersion();
    initAsciiLogo();
  });
} else {
  // DOM already loaded
  loadVersion();
  initAsciiLogo();
}
