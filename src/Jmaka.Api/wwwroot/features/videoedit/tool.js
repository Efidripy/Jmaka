(() => {
  console.info('VideoEdit v0.5.2 loaded');
  
  const videoEditModal = document.getElementById('videoEditModal');
  if (!videoEditModal) return;

  const videoEditToolBtn = document.getElementById('videoEditToolBtn');
  const videoEditCloseBtn = document.getElementById('videoEditClose');
  const videoEditCancelBtn = document.getElementById('videoEditCancel');
  const videoEditHint = document.getElementById('videoEditHint');
  const videoEditPreview = document.getElementById('videoEditPreview');
  const videoUploadInput = document.getElementById('videoUploadInput');
  const videoUploadBtn = document.getElementById('videoUploadBtn');
  const videoHistoryRefresh = document.getElementById('videoHistoryRefresh');
  const videoProcessedRefresh = document.getElementById('videoProcessedRefresh');
  const videoOverlayUploadBtn = document.getElementById('videoOverlayUploadBtn');
  const videoOverlaySelect = document.getElementById('videoOverlaySelect');
  const videoOverlayInput = document.getElementById('videoOverlayInput');
  const videoOverlayPreview = document.getElementById('videoOverlayPreview');
  const videoStatusText = document.getElementById('videoStatusText');
  const videoStatusBar = document.getElementById('videoStatusBar');
  const videoOriginalsList = document.getElementById('videoOriginalsList');
  const videoProcessedList = document.getElementById('videoProcessedList');
  const videoTimelineStrip = document.getElementById('videoTimelineStrip');
  const videoTimelineCanvas = document.getElementById('videoTimelineCanvas');
  const videoTimelineSegments = document.getElementById('videoTimelineSegments');
  const videoTimelinePlayhead = document.getElementById('videoTimelinePlayhead');
  const videoTimelineOverview = document.getElementById('videoTimelineOverview');
  const videoTimelineOverviewWindow = document.getElementById('videoTimelineOverviewWindow');
  const videoTimelineZoomOut = document.getElementById('videoTimelineZoomOut');
  const videoTimelineZoomIn = document.getElementById('videoTimelineZoomIn');
  const videoTimelineZoomFit = document.getElementById('videoTimelineZoomFit');
  const videoTimelineZoomLabel = document.getElementById('videoTimelineZoomLabel');
  const videoTrimStartLabel = document.getElementById('videoTrimStartLabel');
  const videoTrimEndLabel = document.getElementById('videoTrimEndLabel');
  const videoCurrentTime = document.getElementById('videoCurrentTime');
  const videoDuration = document.getElementById('videoDuration');
  const videoPlayToggle = document.getElementById('videoPlayToggle');
  const videoEditSave = document.getElementById('videoEditSave');
  const videoPreviewStage = videoEditModal.querySelector('.video-preview-stage');
  const videoRotateCw = document.getElementById('videoRotateCw');
  const videoRotateCcw = document.getElementById('videoRotateCcw');
  const videoRotateReset = document.getElementById('videoRotateReset');
  const videoSpeedRange = document.getElementById('videoSpeedRange');
  const videoSpeedValue = document.getElementById('videoSpeedValue');
  const videoFlipH = document.getElementById('videoFlipH');
  const videoFlipV = document.getElementById('videoFlipV');
  const videoFlipReset = document.getElementById('videoFlipReset');
  const videoTargetSize = document.getElementById('videoTargetSize');
  const videoCropOverlay = document.getElementById('videoCropOverlay');
  const videoCropRect = document.getElementById('videoCropRect');
  const videoProcessingOverlay = document.getElementById('videoProcessingOverlay');
  const videoAddSegment = document.getElementById('videoAddSegment');
  const videoRemoveSegment = document.getElementById('videoRemoveSegment');
  const videoSegmentsInfo = document.getElementById('videoSegmentsInfo');
  const videoMuteAudio = document.getElementById('videoMuteAudio');
  const videoMuteLabel = document.getElementById('videoMuteLabel');
  const videoResetBtn = document.getElementById('videoResetBtn');
  const videoModeVidcov = document.getElementById('videoModeVidcov');
  const sizeLimitButtons = Array.from(videoEditModal.querySelectorAll('[data-size-limit]'));
  const cropRatioButtons = Array.from(videoEditModal.querySelectorAll('[data-crop-ratio]'));

  const timelinePreviewState = {
    dirty: true,
    sourceToken: '',
    frameCount: 0,
    baseToken: '',
    windowStart: 0,
    windowEnd: 0,
    renderNonce: 0,
    renderTimerId: 0,
    cachedCanvas: null
  };

  const toolButtons = Array.from(videoEditModal.querySelectorAll('[data-tool]'));
  const toolPanels = Array.from(videoEditModal.querySelectorAll('[data-tool-panel]'));

  const state = {
    tool: 'trim',
    outputMode: 'episod',
    storedName: null,
    duration: 0,
    trim: { start: 0, end: 0 },
    segments: [{ start: 0, end: 0 }],
    activeSegmentIndex: 0,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    rotateDeg: 0,
    flipH: false,
    flipV: false,
    speed: 1,
    cropRatio: null,
    verticalOffsetPx: 0,
    overlayTemplateRelativePath: null,
    muteAudio: false,
    targetSizeMb: 10,
    selectedSizeLimit: '10mb',
    timelineZoom: 1,
    timelineStartSec: 0
  };

  let originals = [];
  let processed = [];
  let overlayTemplates = [];
  let timelineDrag = null;
  let timelineOverviewDrag = null;
  let verticalDrag = null;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function vt(key, fallback) {
    try {
      if (window.JMAKA_I18N && typeof window.JMAKA_I18N.t === 'function') {
        const value = window.JMAKA_I18N.t(key);
        if (value && value !== key) return value;
      }
    } catch {}
    return fallback;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const total = Math.max(0, seconds);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const tenths = Math.floor((total % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
  }

  function formatDurationCompact(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatSizeMb(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return '—';
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatEta(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function normalizeSegments() {
    const duration = state.duration || 0;
    const minGap = 0.1;
    const normalized = [];
    for (const seg of state.segments) {
      const start = clamp(Number(seg.start || 0), 0, duration);
      const end = clamp(Number(seg.end || 0), 0, duration);
      if (end - start >= minGap) normalized.push({ start, end });
    }
    normalized.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const seg of normalized) {
      if (merged.length === 0) {
        merged.push(seg);
        continue;
      }
      const prev = merged[merged.length - 1];
      if (seg.start <= prev.end + 0.05) {
        prev.end = Math.max(prev.end, seg.end);
      } else {
        merged.push(seg);
      }
    }
    state.segments = merged.length > 0 ? merged : [{ start: 0, end: duration }];
    state.activeSegmentIndex = clamp(state.activeSegmentIndex, 0, state.segments.length - 1);
    state.trim = { ...state.segments[state.activeSegmentIndex] };
  }

  function setHint(text) {
    if (videoEditHint) videoEditHint.textContent = text;
    setStatus(text, null);
  }

  function setStatus(text, percent, options = {}) {
    const indeterminate = !!options.indeterminate;
    if (videoStatusText) videoStatusText.textContent = text || 'Ready';
    if (videoStatusBar) {
      videoStatusBar.classList.toggle('is-indeterminate', indeterminate);
      const pct = Number.isFinite(percent) ? clamp(percent, 0, 100) : 0;
      videoStatusBar.style.width = indeterminate ? '55%' : `${pct}%`;
    }
  }

  function parseProgressPercent(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw)) return clamp(raw, 0, 100);
    const m = String(raw || '').match(/(\d+(?:\.\d+)?)\s*%?/);
    if (!m) return null;
    const value = Number(m[1]);
    return Number.isFinite(value) ? clamp(value, 0, 100) : null;
  }

  function uploadFormWithProgress(url, formData, onProgress, onUploadComplete) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', toAbsoluteUrl(url), true);
      xhr.responseType = 'json';
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || typeof onProgress !== 'function') return;
        onProgress((event.loaded / event.total) * 100);
      };
      xhr.upload.onload = () => {
        if (typeof onUploadComplete === 'function') onUploadComplete();
      };
      xhr.onload = () => {
        const payload = xhr.response || (() => {
          try { return JSON.parse(xhr.responseText || '{}'); } catch { return null; }
        })();
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: payload });
      };
      xhr.onerror = () => reject(new Error('network error'));
      xhr.send(formData);
    });
  }

  function setProcessing(isProcessing) {
    if (videoProcessingOverlay) videoProcessingOverlay.classList.toggle('is-active', !!isProcessing);
    if (videoEditSave) videoEditSave.disabled = isProcessing || !state.storedName;
  }

  function renderToolState() {
    toolButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tool === state.tool));
    toolPanels.forEach((panel) => { panel.hidden = panel.dataset.toolPanel !== state.tool; });
    cropRatioButtons.forEach((btn) => btn.classList.toggle('is-active', state.cropRatio === btn.dataset.cropRatio));
    if (videoCropOverlay) videoCropOverlay.hidden = state.tool !== 'crop';
    if (videoPreviewStage) {
      const hasVideo = videoEditPreview && videoEditPreview.videoWidth && videoEditPreview.videoHeight;
      videoPreviewStage.classList.toggle('is-draggable', !!hasVideo);
    }
    if (videoSegmentsInfo) {
      const n = state.segments.length;
      videoSegmentsInfo.textContent = `${n} segment${n === 1 ? '' : 's'}`;
    }
  }

  function renderOverlayTemplates() {
    if (!videoOverlaySelect) return;
    const selected = state.overlayTemplateRelativePath || '';
    videoOverlaySelect.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'No overlay';
    videoOverlaySelect.appendChild(empty);
    overlayTemplates.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.relativePath;
      opt.textContent = item.fileName || item.relativePath;
      videoOverlaySelect.appendChild(opt);
    });
    videoOverlaySelect.value = selected;
  }

  function renderOverlayPreview() {
    if (!videoOverlayPreview) return;
    if (!state.overlayTemplateRelativePath) {
      videoOverlayPreview.hidden = true;
      videoOverlayPreview.removeAttribute('src');
      return;
    }
    videoOverlayPreview.hidden = false;
    videoOverlayPreview.src = toAbsoluteUrl(state.overlayTemplateRelativePath);
  }

  function renderPlaybackState() {
    if (!videoEditPreview) return;
    const maxOffset = getMaxVerticalOffsetPx();
    if (Number.isFinite(maxOffset)) {
      state.verticalOffsetPx = clamp(state.verticalOffsetPx, -maxOffset, maxOffset);
    } else {
      state.verticalOffsetPx = 0;
    }
    const flipX = state.flipH ? -1 : 1;
    const flipY = state.flipV ? -1 : 1;
    // Shift visible content inside the fixed 16:9 viewport without moving the element box
    // to avoid exposing empty background when panning tall/square videos.
    videoEditPreview.style.objectPosition = `50% calc(50% + ${state.verticalOffsetPx.toFixed(2)}px)`;
    videoEditPreview.style.transform = `rotate(${state.rotateDeg}deg) scale(${flipX}, ${flipY})`;
    videoEditPreview.playbackRate = state.speed;
    if (videoSpeedValue) videoSpeedValue.textContent = `${state.speed.toFixed(1)}x`;
    if (videoFlipH) videoFlipH.classList.toggle('is-active', state.flipH);
    if (videoFlipV) videoFlipV.classList.toggle('is-active', state.flipV);
  }

  function getMaxVerticalOffsetPx() {
    if (!videoPreviewStage || !videoEditPreview) return 0;
    const stageRect = videoPreviewStage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return 0;
    const vw = videoEditPreview.videoWidth || 0;
    const vh = videoEditPreview.videoHeight || 0;
    if (!vw || !vh) return 0;
    const scale = Math.max(stageRect.width / vw, stageRect.height / vh);
    const renderedH = vh * scale;
    const extra = Math.max(0, renderedH - stageRect.height);
    return extra / 2;
  }

  function renderCropRect() {
    if (!videoCropRect || !videoEditPreview || !videoCropOverlay) return;
    const bounds = videoEditPreview.getBoundingClientRect();
    const overlayBounds = videoCropOverlay.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const left = (bounds.left - overlayBounds.left) + state.crop.x * bounds.width;
    const top = (bounds.top - overlayBounds.top) + state.crop.y * bounds.height;
    videoCropRect.style.left = `${left}px`;
    videoCropRect.style.top = `${top}px`;
    videoCropRect.style.width = `${state.crop.w * bounds.width}px`;
    videoCropRect.style.height = `${state.crop.h * bounds.height}px`;
  }

  function getTimelineWindowDurationSec() {
    const duration = state.duration || 0;
    if (!duration) return 0;
    return clamp(duration / Math.max(1, state.timelineZoom || 1), Math.min(1, duration), duration);
  }

  function clampTimelineStart() {
    const duration = state.duration || 0;
    if (!duration) {
      state.timelineStartSec = 0;
      return;
    }
    const windowDur = getTimelineWindowDurationSec();
    state.timelineStartSec = clamp(state.timelineStartSec || 0, 0, Math.max(0, duration - windowDur));
  }

  function getTimelineWindow() {
    const duration = state.duration || 0;
    const windowDur = getTimelineWindowDurationSec();
    clampTimelineStart();
    const start = clamp(state.timelineStartSec || 0, 0, Math.max(0, duration - windowDur));
    const end = clamp(start + windowDur, 0, duration);
    return { start, end, duration: Math.max(0.0001, end - start) };
  }

  function timelineTimeToX(timeSec, widthPx) {
    const window = getTimelineWindow();
    const rel = (timeSec - window.start) / window.duration;
    return clamp(rel, 0, 1) * widthPx;
  }

  function timelineXToTime(xPx, widthPx) {
    const window = getTimelineWindow();
    const rel = widthPx > 0 ? clamp(xPx / widthPx, 0, 1) : 0;
    return clamp(window.start + rel * window.duration, 0, state.duration || 0);
  }

  function setTimelineZoom(nextZoom, anchorTimeSec = null) {
    const duration = state.duration || 0;
    if (!duration) {
      state.timelineZoom = 1;
      state.timelineStartSec = 0;
      return;
    }
    const minZoom = 1;
    const maxZoom = clamp(duration / Math.min(0.5, duration), 1, 400);
    const prevZoom = clamp(state.timelineZoom || 1, minZoom, maxZoom);
    const prevWindowDur = duration / prevZoom;
    const zoom = clamp(nextZoom, minZoom, maxZoom);
    const nextWindowDur = duration / zoom;
    const anchor = Number.isFinite(anchorTimeSec) ? clamp(anchorTimeSec, 0, duration) : (state.timelineStartSec + prevWindowDur / 2);
    const anchorRel = prevWindowDur > 0 ? (anchor - state.timelineStartSec) / prevWindowDur : 0.5;
    state.timelineZoom = zoom;
    state.timelineStartSec = anchor - anchorRel * nextWindowDur;
    clampTimelineStart();
  }

  function panTimelineBy(deltaSec) {
    state.timelineStartSec += deltaSec;
    clampTimelineStart();
  }

  function renderTimelineOverview() {
    if (!videoTimelineOverview || !videoTimelineOverviewWindow) return;
    const duration = state.duration || 0;
    if (!duration) {
      videoTimelineOverviewWindow.style.left = '0px';
      videoTimelineOverviewWindow.style.width = '100%';
      return;
    }
    const rect = videoTimelineOverview.getBoundingClientRect();
    if (!rect.width) return;
    const window = getTimelineWindow();
    const left = (window.start / duration) * rect.width;
    const width = Math.max(10, (window.duration / duration) * rect.width);
    videoTimelineOverviewWindow.style.left = `${left}px`;
    videoTimelineOverviewWindow.style.width = `${width}px`;
  }

  function renderTimeline() {
    if (!videoTimelineStrip || !videoTimelineSegments) return;
    const rect = videoTimelineStrip.getBoundingClientRect();
    const duration = state.duration || 0;
    const timelineWindow = getTimelineWindow();
    videoTimelineSegments.innerHTML = '';
    if (rect.width > 0 && duration > 0) {
      state.segments.forEach((seg, index) => {
        const visStart = Math.max(seg.start, timelineWindow.start);
        const visEnd = Math.min(seg.end, timelineWindow.end);
        if (visEnd <= visStart) return;
        const startX = timelineTimeToX(visStart, rect.width);
        const endX = timelineTimeToX(visEnd, rect.width);
        const node = document.createElement('div');
        node.className = 'timeline-selection';
        if (index === state.activeSegmentIndex) node.classList.add('is-active');
        node.dataset.index = String(index);
        node.style.left = `${startX}px`;
        node.style.width = `${Math.max(0, endX - startX)}px`;
        node.innerHTML = '<span class="timeline-handle start" data-handle="start"></span><span class="timeline-handle end" data-handle="end"></span>';
        videoTimelineSegments.appendChild(node);
      });
    }

    const active = state.segments[state.activeSegmentIndex] || { start: 0, end: 0 };
    if (videoTrimStartLabel) videoTrimStartLabel.textContent = formatTime(active.start);
    if (videoTrimEndLabel) videoTrimEndLabel.textContent = formatTime(active.end);
    if (videoDuration) videoDuration.textContent = formatTime(duration);
    if (videoTimelineZoomLabel) videoTimelineZoomLabel.textContent = `${(state.timelineZoom || 1).toFixed(1)}x`;

    queueFilmstripRender(false);
    renderPlayhead();
    renderTimelineOverview();
    renderToolState();
  }

  function drawFilmstripPlaceholder() {
    if (!videoTimelineCanvas || !videoTimelineStrip) return;
    const rect = videoTimelineStrip.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const canvas = videoTimelineCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      timelinePreviewState.dirty = true;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(0, 0, width, height);
    const frameWidth = 28;
    for (let x = 0; x < width; x += frameWidth) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(x + 1, 8, frameWidth - 2, height - 16);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
      ctx.strokeRect(x + 1, 8, frameWidth - 2, height - 16);
    }
  }

  function drawFilmstripFromCache(baseToken, window, width, height) {
    const cached = timelinePreviewState.cachedCanvas;
    if (!cached || !timelinePreviewState.baseToken || timelinePreviewState.baseToken !== baseToken) return false;
    const oldStart = timelinePreviewState.windowStart;
    const oldEnd = timelinePreviewState.windowEnd;
    const oldDur = oldEnd - oldStart;
    const newDur = window.end - window.start;
    if (!oldDur || !newDur) return false;
    const overlapStart = Math.max(oldStart, window.start);
    const overlapEnd = Math.min(oldEnd, window.end);
    const ctx = videoTimelineCanvas && videoTimelineCanvas.getContext('2d');
    if (!ctx || overlapEnd <= overlapStart) return false;

    drawFilmstripPlaceholder();
    const sx = ((overlapStart - oldStart) / oldDur) * cached.width;
    const sw = ((overlapEnd - overlapStart) / oldDur) * cached.width;
    const dx = ((overlapStart - window.start) / newDur) * width;
    const dw = ((overlapEnd - overlapStart) / newDur) * width;
    const y = 6;
    const h = height - 12;
    ctx.drawImage(cached, sx, y, sw, h, dx, y, dw, h);
    return true;
  }

  async function renderFilmstripAsync(opts) {
    const { width, height, frameCount, timelineWindow, baseToken, nonce, src } = opts;
    const canvas = videoTimelineCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const captureVideo = document.createElement('video');
    captureVideo.crossOrigin = 'anonymous';
    captureVideo.muted = true;
    captureVideo.preload = 'auto';
    captureVideo.src = src;

    const frameCanvas = document.createElement('canvas');
    const frameCtx = frameCanvas.getContext('2d');
    if (!frameCtx) return;

    await new Promise((resolve) => {
      const done = () => resolve();
      captureVideo.addEventListener('loadedmetadata', done, { once: true });
      captureVideo.addEventListener('error', done, { once: true });
    });
    if (nonce !== timelinePreviewState.renderNonce) return;
    if (!captureVideo.videoWidth || !captureVideo.videoHeight) return;

    frameCanvas.width = captureVideo.videoWidth;
    frameCanvas.height = captureVideo.videoHeight;
    drawFilmstripPlaceholder();

    const drawFrameAtIndex = (index) => {
      const x = Math.floor(index * (width / frameCount));
      const nextX = Math.floor((index + 1) * (width / frameCount));
      const w = Math.max(1, nextX - x - 1);
      const y = 6;
      const h = height - 12;
      frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
      frameCtx.drawImage(captureVideo, 0, 0, frameCanvas.width, frameCanvas.height);
      ctx.drawImage(frameCanvas, x + 1, y, w, h);
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.strokeRect(x + 0.5, y + 0.5, w + 1, h - 1);
    };

    for (let i = 0; i < frameCount; i++) {
      if (nonce !== timelinePreviewState.renderNonce) return;
      const t = frameCount === 1
        ? timelineWindow.start
        : timelineWindow.start + (i / (frameCount - 1)) * Math.max(0, timelineWindow.duration - 0.05);
      try {
        await new Promise((resolve) => {
          const done = () => {
            captureVideo.removeEventListener('seeked', done);
            resolve();
          };
          captureVideo.addEventListener('seeked', done, { once: true });
          captureVideo.currentTime = t;
        });
        if (nonce !== timelinePreviewState.renderNonce) return;
        drawFrameAtIndex(i);
      } catch {
        // ignore and keep what we have
      }
    }

    const cacheCanvas = document.createElement('canvas');
    cacheCanvas.width = width;
    cacheCanvas.height = height;
    const cacheCtx = cacheCanvas.getContext('2d');
    if (cacheCtx) cacheCtx.drawImage(canvas, 0, 0);
    timelinePreviewState.cachedCanvas = cacheCanvas;
    timelinePreviewState.baseToken = baseToken;
    timelinePreviewState.windowStart = timelineWindow.start;
    timelinePreviewState.windowEnd = timelineWindow.end;
  }

  function queueFilmstripRender(force) {
    if (!videoEditPreview || !videoTimelineCanvas || !state.duration) {
      drawFilmstripPlaceholder();
      return;
    }

    const canvas = videoTimelineCanvas;
    const width = canvas.width || Math.floor(videoTimelineStrip.getBoundingClientRect().width || 0);
    const height = canvas.height || Math.floor(videoTimelineStrip.getBoundingClientRect().height || 0);
    if (!width || !height) {
      drawFilmstripPlaceholder();
      return;
    }

    const frameWidth = Math.max(40, Math.floor(width / 16));
    const frameCount = Math.max(6, Math.ceil(width / frameWidth));
    const timelineWindow = getTimelineWindow();
    const src = videoEditPreview.currentSrc || videoEditPreview.src || '';
    const baseToken = `${src}|${state.duration}|${width}x${height}`;
    const sourceToken = `${baseToken}|${timelineWindow.start.toFixed(3)}|${timelineWindow.end.toFixed(3)}|${frameCount}`;
    if (!force && !timelinePreviewState.dirty && timelinePreviewState.sourceToken === sourceToken) {
      return;
    }

    timelinePreviewState.sourceToken = sourceToken;
    timelinePreviewState.frameCount = frameCount;
    timelinePreviewState.dirty = false;

    if (!force) {
      drawFilmstripFromCache(baseToken, timelineWindow, width, height);
    } else {
      drawFilmstripPlaceholder();
    }

    window.clearTimeout(timelinePreviewState.renderTimerId);
    const nonce = timelinePreviewState.renderNonce + 1;
    timelinePreviewState.renderNonce = nonce;
    const delay = force ? 0 : 140;
    timelinePreviewState.renderTimerId = window.setTimeout(() => {
      renderFilmstripAsync({ width, height, frameCount, timelineWindow, baseToken, nonce, src });
    }, delay);
  }

  function renderPlayhead() {
    if (!videoTimelinePlayhead || !videoTimelineStrip || !videoEditPreview || !state.duration) return;
    const rect = videoTimelineStrip.getBoundingClientRect();
    const x = timelineTimeToX(videoEditPreview.currentTime, rect.width);
    videoTimelinePlayhead.style.left = `${x}px`;
    if (videoCurrentTime) videoCurrentTime.textContent = formatTime(videoEditPreview.currentTime);
  }

  function renderOutputControls() {
    const isVidcovMode = state.outputMode === 'vidcov';
    if (videoTargetSize) videoTargetSize.value = String(state.targetSizeMb);
    if (videoEditSave) videoEditSave.disabled = !state.storedName;
    if (videoMuteLabel) videoMuteLabel.textContent = state.muteAudio ? 'Unmute' : 'Mute';
    if (videoMuteAudio) {
      videoMuteAudio.checked = !!state.muteAudio;
      videoMuteAudio.disabled = isVidcovMode;
    }
    const muteWrap = videoMuteLabel ? (videoMuteLabel.closest('.video-bottom-mute') || videoMuteLabel.closest('.tool-toggle')) : null;
    if (muteWrap) {
      muteWrap.classList.toggle('is-active', state.muteAudio);
      muteWrap.classList.toggle('is-locked', isVidcovMode);
      muteWrap.setAttribute('aria-pressed', state.muteAudio ? 'true' : 'false');
    }
    if (videoModeVidcov) {
      videoModeVidcov.classList.toggle('is-active', isVidcovMode);
      videoModeVidcov.setAttribute('aria-pressed', isVidcovMode ? 'true' : 'false');
    }
    sizeLimitButtons.forEach((btn) => {
      const isActive = !isVidcovMode && btn.dataset.sizeLimit === state.selectedSizeLimit;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderAll() {
    normalizeSegments();
    renderToolState();
    renderPlaybackState();
    renderCropRect();
    renderTimeline();
    renderOutputControls();
    renderOverlayTemplates();
    renderOverlayPreview();
  }

  async function loadVideoHistory() {
    if (!videoOriginalsList || !videoProcessedList) return;
    videoOriginalsList.textContent = vt('loading', 'Загрузка...');
    videoProcessedList.textContent = vt('loading', 'Загрузка...');
    try {
      const res = await fetch(toAbsoluteUrl('video-history'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        videoOriginalsList.textContent = vt('loadError', 'Ошибка загрузки.');
        videoProcessedList.textContent = vt('loadError', 'Ошибка загрузки.');
        return;
      }
      originals = data.filter((item) => item && item.kind !== 'processed');
      processed = data.filter((item) => item && item.kind === 'processed');
      renderVideoLists();
      if (processed.length === 0) {
        setHint(vt('Results пуст. Нажмите Refresh, если обработка завершилась только что.', 'Results пуст. Нажмите Refresh, если обработка завершилась только что.'));
      }
    } catch {
      videoOriginalsList.textContent = vt('loadError', 'Ошибка загрузки.');
      videoProcessedList.textContent = vt('loadError', 'Ошибка загрузки.');
    }
  }

  async function loadOverlayTemplates() {
    if (!videoOverlaySelect) return;
    try {
      const res = await fetch(toAbsoluteUrl('video-overlay-templates'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) return;
      overlayTemplates = data;
      if (state.overlayTemplateRelativePath && !overlayTemplates.some((x) => x.relativePath === state.overlayTemplateRelativePath)) {
        state.overlayTemplateRelativePath = null;
      }
      renderOverlayTemplates();
      renderOverlayPreview();
    } catch {
      // keep current state silently
    }
  }

  function normalizeJobStatus(rawStatus) {
    if (typeof rawStatus === 'string') return rawStatus.toUpperCase();
    const enumMap = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED'];
    if (Number.isInteger(rawStatus) && rawStatus >= 0 && rawStatus < enumMap.length) {
      return enumMap[rawStatus];
    }
    return String(rawStatus || '').toUpperCase();
  }

  async function waitForJobCompletion(jobId, timeoutMs = 180000, onProgress, pollMs = 1000) {
    const started = Date.now();
    const terminal = new Set(['SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED']);

    while (Date.now() - started < timeoutMs) {
      const res = await fetch(toAbsoluteUrl(`video/jobs/${jobId}`), { cache: 'no-store' });
      let data;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok) {
        throw new Error(data && data.error ? data.error : vt('Не удалось получить статус задачи', 'Не удалось получить статус задачи'));
      }

      const status = normalizeJobStatus(data && data.status);
      if (typeof onProgress === 'function') {
        onProgress({
          status,
          progress: parseProgressPercent(data && data.progress),
          rawProgress: data && data.progress
        });
      }
      if (terminal.has(status)) {
        return { ...data, status };
      }

      await new Promise((resolve) => setTimeout(resolve, Math.max(150, pollMs)));
    }

    throw new Error(vt('Превышено время ожидания завершения задачи', 'Превышено время ожидания завершения задачи'));
  }

  async function waitForUploadNormalizeCompletion(jobId, timeoutMs = 1800000, onProgress, pollMs = 1000) {
    const started = Date.now();
    const terminal = new Set(['SUCCEEDED', 'FAILED']);

    while (Date.now() - started < timeoutMs) {
      const res = await fetch(toAbsoluteUrl(`video/upload-jobs/${jobId}`), { cache: 'no-store' });
      let data;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok) {
        throw new Error(data && data.error ? data.error : vt('videoNormalizeStatusError', 'Не удалось получить статус нормализации'));
      }

      const status = normalizeJobStatus(data && data.status);
      const progress = parseProgressPercent(data && data.progress);
      if (typeof onProgress === 'function') {
        onProgress({ status, progress, raw: data });
      }
      if (terminal.has(status)) {
        return { ...data, status };
      }

      await new Promise((resolve) => setTimeout(resolve, Math.max(200, pollMs)));
    }

    throw new Error(vt('videoNormalizeTimeout', 'Превышено время ожидания нормализации видео'));
  }

  function renderVideoLists() {
    if (!videoOriginalsList || !videoProcessedList) return;
    videoOriginalsList.textContent = '';
    videoProcessedList.textContent = '';

    const renderItem = (item, listEl, isProcessed) => {
      const row = document.createElement('div');
      row.className = 'video-list-item';
      if (isProcessed) row.classList.add('is-processed');
      if (!isProcessed && item.storedName === state.storedName) row.classList.add('is-active');
      row.addEventListener('click', () => {
        if (!item.relativePath) return;
        const url = withCacheBust ? withCacheBust(item.relativePath, item.storedName) : item.relativePath;
        if (videoEditPreview) {
          videoEditPreview.src = url;
          timelinePreviewState.dirty = true;
        }
        if (isProcessed) {
          setHint(vt('Просмотр результата. Для обработки выберите оригинал.', 'Просмотр результата. Для обработки выберите оригинал.'));
          return;
        }
        state.storedName = item.storedName;
        setHint(vt('Выберите отрезки на таймлайне и нажмите Сделать.', 'Выберите отрезки на таймлайне и нажмите Сделать.'));
        if (videoEditSave) videoEditSave.disabled = false;
        renderVideoLists();
      });

      const thumb = document.createElement('div');
      thumb.className = 'video-thumb';
      if (item.relativePath) {
        const videoThumb = document.createElement('video');
        videoThumb.className = 'video-thumb-media';
        videoThumb.muted = true;
        videoThumb.preload = 'metadata';
        videoThumb.src = toAbsoluteUrl(item.relativePath);
        videoThumb.playsInline = true;
        videoThumb.addEventListener('loadeddata', () => {
          try { videoThumb.currentTime = Math.min(0.2, Math.max(0, (item.durationSeconds || 0) / 10)); } catch { /* ignore */ }
        }, { once: true });
        thumb.appendChild(videoThumb);
      } else {
        thumb.textContent = 'MP4';
      }
      const meta = document.createElement('div');
      meta.className = 'video-list-meta';
      const details = document.createElement('div');
      details.textContent = `${formatDurationCompact(item.durationSeconds)} · ${formatSizeMb(item.size)}`;
      meta.appendChild(details);

      const actions = document.createElement('div');
      actions.className = 'video-list-actions';
      if (item.relativePath) {
        const dl = document.createElement('a');
        dl.className = 'btn small';
        dl.textContent = '💾';
        dl.href = toAbsoluteUrl(item.relativePath);
        dl.download = item.originalName || item.storedName || 'video.mp4';
        dl.addEventListener('click', (event) => event.stopPropagation());
        actions.appendChild(dl);
      }

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn small';
      del.textContent = '✖';
      del.addEventListener('click', async (event) => {
        event.stopPropagation();
        del.disabled = true;
        try {
          const res = await fetch(toAbsoluteUrl('delete-video'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storedName: item.storedName })
          });
          if (!res.ok) throw new Error('delete failed');
        } catch {
          del.disabled = false;
          return;
        }
        if (item.storedName === state.storedName) {
          state.storedName = null;
          if (videoEditPreview) videoEditPreview.removeAttribute('src');
          if (videoEditSave) videoEditSave.disabled = true;
        }
        await loadVideoHistory();
      });
      actions.appendChild(del);

      row.appendChild(thumb);
      row.appendChild(meta);
      row.appendChild(actions);
      listEl.appendChild(row);
    };

    if (originals.length === 0) videoOriginalsList.textContent = vt('No uploads.', 'No uploads.');
    else originals.forEach((item) => renderItem(item, videoOriginalsList, false));

    if (processed.length === 0) {
      const warn = document.createElement('div');
      warn.className = 'video-list-empty-warning';
      warn.textContent = vt('Results are empty for now.', 'Results are empty for now.');
      const refreshBtn = document.createElement('button');
      refreshBtn.type = 'button';
      refreshBtn.className = 'btn small';
      refreshBtn.textContent = vt('Обновить', 'Обновить');
      refreshBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        loadVideoHistory();
      });
      warn.appendChild(refreshBtn);
      videoProcessedList.appendChild(warn);
    }
    else processed.forEach((item) => renderItem(item, videoProcessedList, true));
  }

  function openModal() {
    videoEditModal.hidden = false;
    setHint(vt('videoUploadHint', 'Загрузите видео и перетащите границы на таймлайне.'));
    setStatus('Ready', 0);
    loadVideoHistory();
    loadOverlayTemplates();
    renderAll();
  }

  function closeModal() {
    videoEditModal.hidden = true;
    if (videoEditPreview) videoEditPreview.pause();
  }

  function timelinePointerToTime(clientX) {
    if (!videoTimelineStrip || !state.duration) return 0;
    const rect = videoTimelineStrip.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    return timelineXToTime(x, rect.width);
  }

  function handleTimelinePointerDown(event) {
    if (!videoTimelineStrip || !videoTimelineSegments) return;
    if (event.button === 1 || event.altKey) {
      const startX = event.clientX;
      const startTimelineStart = state.timelineStartSec;
      const rect = videoTimelineStrip.getBoundingClientRect();
      const windowDur = getTimelineWindowDurationSec();
      const move = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const secPerPx = rect.width > 0 ? (windowDur / rect.width) : 0;
        state.timelineStartSec = startTimelineStart - dx * secPerPx;
        clampTimelineStart();
        renderTimeline();
      };
      const stop = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop, { once: true });
      event.preventDefault();
      return;
    }

    const selection = event.target.closest('.timeline-selection');
    const index = selection ? Number(selection.dataset.index) : -1;
    if (index >= 0) state.activeSegmentIndex = index;

    if (event.target.dataset && event.target.dataset.handle && index >= 0) {
      timelineDrag = { type: event.target.dataset.handle, index };
    } else if (selection && index >= 0) {
      const clickTime = timelinePointerToTime(event.clientX);
      timelineDrag = {
        type: 'range',
        index,
        offset: clickTime - state.segments[index].start,
        length: state.segments[index].end - state.segments[index].start
      };
    } else {
      timelineDrag = { type: 'playhead' };
    }

    handleTimelinePointerMove(event);
    window.addEventListener('pointermove', handleTimelinePointerMove);
    window.addEventListener('pointerup', handleTimelinePointerUp);
  }

  function handleTimelineWheel(event) {
    if (!state.duration || !videoTimelineStrip) return;
    event.preventDefault();
    const rect = videoTimelineStrip.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const anchor = timelineXToTime(x, rect.width);
    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      const windowDur = getTimelineWindowDurationSec();
      const shiftSec = (windowDur * (event.deltaX || event.deltaY)) / Math.max(1, rect.width);
      panTimelineBy(shiftSec);
    } else {
      const factor = event.deltaY > 0 ? 1 / 1.18 : 1.18;
      setTimelineZoom((state.timelineZoom || 1) * factor, anchor);
    }
    renderTimeline();
  }

  function handleTimelinePointerMove(event) {
    if (!timelineDrag) return;
    const time = timelinePointerToTime(event.clientX);
    const minGap = 0.1;

    if (timelineDrag.type === 'playhead') {
      if (videoEditPreview) videoEditPreview.currentTime = time;
      renderPlayhead();
      return;
    }

    const seg = state.segments[timelineDrag.index];
    if (!seg) return;

    if (timelineDrag.type === 'start') {
      seg.start = clamp(time, 0, seg.end - minGap);
    } else if (timelineDrag.type === 'end') {
      seg.end = clamp(time, seg.start + minGap, state.duration);
    } else if (timelineDrag.type === 'range') {
      const start = clamp(time - timelineDrag.offset, 0, state.duration - timelineDrag.length);
      seg.start = start;
      seg.end = start + timelineDrag.length;
    }

    normalizeSegments();
    if (videoEditPreview && Number.isFinite(time)) {
      videoEditPreview.currentTime = clamp(time, 0, state.duration || 0);
      renderPlayhead();
    }
    renderTimeline();
  }

  function handleTimelinePointerUp() {
    timelineDrag = null;
    window.removeEventListener('pointermove', handleTimelinePointerMove);
    window.removeEventListener('pointerup', handleTimelinePointerUp);
  }

  function setOverviewCenterByClientX(clientX) {
    if (!videoTimelineOverview || !state.duration) return;
    const rect = videoTimelineOverview.getBoundingClientRect();
    if (!rect.width) return;
    const x = clamp(clientX - rect.left, 0, rect.width);
    const centerSec = (x / rect.width) * state.duration;
    const half = getTimelineWindowDurationSec() / 2;
    state.timelineStartSec = centerSec - half;
    clampTimelineStart();
    renderTimeline();
  }

  function handleVerticalDrag(event) {
    if (!verticalDrag) return;
    const delta = event.clientY - verticalDrag.startY;
    const maxOffset = getMaxVerticalOffsetPx();
    state.verticalOffsetPx = clamp(verticalDrag.startOffset + delta, -maxOffset, maxOffset);
    renderPlaybackState();
    renderCropRect();
  }

  function stopVerticalDrag() {
    verticalDrag = null;
    if (videoPreviewStage) videoPreviewStage.classList.remove('is-dragging');
    window.removeEventListener('pointermove', handleVerticalDrag);
  }

  function addSegment() {
    const duration = state.duration || 0;
    if (!duration) return;
    const maxSegments = 20;
    if (state.segments.length >= maxSegments) return;
    const active = state.segments[state.activeSegmentIndex] || { start: 0, end: duration };
    const len = Math.max(0.5, Math.min(5, (active.end - active.start) / 2));
    const start = clamp(active.end + 0.2, 0, Math.max(0, duration - len));
    state.segments.push({ start, end: start + len });
    state.activeSegmentIndex = state.segments.length - 1;
    normalizeSegments();
    renderTimeline();
  }

  function removeSegment() {
    if (state.segments.length <= 1) return;
    state.segments.splice(state.activeSegmentIndex, 1);
    state.activeSegmentIndex = clamp(state.activeSegmentIndex, 0, state.segments.length - 1);
    normalizeSegments();
    renderTimeline();
  }

  function applyCropRatio(rawRatio) {
    const ratio = String(rawRatio || '').trim();
    const parts = ratio.split(':');
    if (parts.length !== 2) return;
    const rw = Number(parts[0]);
    const rh = Number(parts[1]);
    if (!Number.isFinite(rw) || !Number.isFinite(rh) || rw <= 0 || rh <= 0) return;

    const target = rw / rh;
    const stageRect = videoPreviewStage ? videoPreviewStage.getBoundingClientRect() : null;
    const baseAspect = stageRect && stageRect.width > 0 && stageRect.height > 0
      ? (stageRect.width / stageRect.height)
      : (16 / 9);

    let w;
    let h;
    if (target > baseAspect) {
      w = 1;
      h = baseAspect / target;
    } else {
      h = 1;
      w = target / baseAspect;
    }
    w = clamp(w, 0.1, 1);
    h = clamp(h, 0.1, 1);

    const cx = state.crop.x + state.crop.w / 2;
    const cy = state.crop.y + state.crop.h / 2;
    const x = clamp(cx - w / 2, 0, 1 - w);
    const y = clamp(cy - h / 2, 0, 1 - h);

    state.crop = { x, y, w, h };
    state.cropRatio = ratio;
    state.verticalOffsetPx = clamp(state.verticalOffsetPx, -getMaxVerticalOffsetPx(), getMaxVerticalOffsetPx());
    renderCropRect();
    renderPlaybackState();
    renderToolState();
  }

  function resetAllEdits() {
    const duration = state.duration || 0;
    state.segments = [{ start: 0, end: duration }];
    state.activeSegmentIndex = 0;
    state.trim = { start: 0, end: duration };
    state.crop = { x: 0, y: 0, w: 1, h: 1 };
    state.cropRatio = null;
    state.verticalOffsetPx = 0;
    state.rotateDeg = 0;
    state.flipH = false;
    state.flipV = false;
    state.speed = 1;
    state.muteAudio = false;
    state.outputMode = 'episod';
    state.targetSizeMb = 10;
    state.selectedSizeLimit = '10mb';
    state.tool = 'trim';
    state.timelineZoom = 1;
    state.timelineStartSec = 0;
    
    // Update UI elements
    if (videoSpeedRange) videoSpeedRange.value = '1';
    if (videoMuteAudio) videoMuteAudio.checked = false;
    
    // Re-render everything
    renderToolState();
    renderPlaybackState();
    renderCropRect();
    renderTimeline();
    renderOutputControls();
    
    setHint(vt('Все изменения сброшены. Начните заново.', 'Все изменения сброшены. Начните заново.'));
  }

  function handleCropPointerDown(event) {
    if (!videoCropRect || state.tool !== 'crop') return;
    const handle = event.target.dataset && event.target.dataset.handle;
    const startX = event.clientX;
    const startY = event.clientY;
    const startState = { ...state.crop };
    const bounds = videoEditPreview.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / bounds.width;
      const dy = (moveEvent.clientY - startY) / bounds.height;
      if (!handle) {
        state.crop.x = clamp(startState.x + dx, 0, 1 - startState.w);
        state.crop.y = clamp(startState.y + dy, 0, 1 - startState.h);
      } else {
        let nextX = startState.x;
        let nextY = startState.y;
        let nextW = startState.w;
        let nextH = startState.h;
        if (handle.includes('r')) nextW = clamp(startState.w + dx, 0.1, 1 - startState.x);
        if (handle.includes('l')) {
          nextX = clamp(startState.x + dx, 0, startState.x + startState.w - 0.1);
          nextW = startState.w - (nextX - startState.x);
        }
        if (handle.includes('b')) nextH = clamp(startState.h + dy, 0.1, 1 - startState.y);
        if (handle.includes('t')) {
          nextY = clamp(startState.y + dy, 0, startState.y + startState.h - 0.1);
          nextH = startState.h - (nextY - startState.y);
        }
        state.crop = { x: nextX, y: nextY, w: nextW, h: nextH };
      }
      state.cropRatio = null;
      renderCropRect();
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  if (videoEditToolBtn) videoEditToolBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  if (videoEditCloseBtn) videoEditCloseBtn.addEventListener('click', closeModal);
  if (videoEditCancelBtn) videoEditCancelBtn.addEventListener('click', closeModal);
  if (videoEditModal) videoEditModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) closeModal();
  });

  toolButtons.forEach((btn) => btn.addEventListener('click', () => { state.tool = btn.dataset.tool; renderToolState(); }));
  if (videoAddSegment) videoAddSegment.addEventListener('click', addSegment);
  if (videoRemoveSegment) videoRemoveSegment.addEventListener('click', removeSegment);

  if (videoRotateCw) videoRotateCw.addEventListener('click', () => { state.rotateDeg = (state.rotateDeg + 90) % 360; renderPlaybackState(); });
  if (videoRotateCcw) videoRotateCcw.addEventListener('click', () => { state.rotateDeg = (state.rotateDeg - 90 + 360) % 360; renderPlaybackState(); });
  if (videoRotateReset) videoRotateReset.addEventListener('click', () => { state.rotateDeg = 0; renderPlaybackState(); });
  if (videoSpeedRange) videoSpeedRange.addEventListener('input', () => {
    state.speed = Number(videoSpeedRange.value);
    renderPlaybackState();
  });
  if (videoFlipH) videoFlipH.addEventListener('click', () => {
    state.flipH = !state.flipH;
    renderPlaybackState();
  });
  if (videoFlipV) videoFlipV.addEventListener('click', () => {
    state.flipV = !state.flipV;
    renderPlaybackState();
  });
  if (videoFlipReset) videoFlipReset.addEventListener('click', () => {
    state.flipH = false;
    state.flipV = false;
    renderPlaybackState();
  });
  if (videoPreviewStage) {
    videoPreviewStage.addEventListener('pointerdown', (event) => {
      if (event.target && event.target.closest && event.target.closest('.video-crop-rect')) return;
      if (!videoEditPreview || !videoEditPreview.videoWidth || !videoEditPreview.videoHeight) return;
      verticalDrag = { startY: event.clientY, startOffset: state.verticalOffsetPx };
      videoPreviewStage.classList.add('is-dragging');
      event.preventDefault();
      window.addEventListener('pointermove', handleVerticalDrag);
      window.addEventListener('pointerup', stopVerticalDrag, { once: true });
    });
  }
  if (cropRatioButtons.length > 0) {
    cropRatioButtons.forEach((btn) => {
      btn.addEventListener('click', () => applyCropRatio(btn.dataset.cropRatio || ''));
    });
  }

  if (videoMuteAudio) videoMuteAudio.addEventListener('change', () => {
    if (state.outputMode === 'vidcov' && !videoMuteAudio.checked) {
      videoMuteAudio.checked = true;
    }
    state.muteAudio = videoMuteAudio.checked;
    renderOutputControls();
  });

  if (videoResetBtn) videoResetBtn.addEventListener('click', resetAllEdits);
  if (videoTargetSize) videoTargetSize.addEventListener('change', () => {
    const next = Number(videoTargetSize.value);
    state.targetSizeMb = Number.isFinite(next) ? clamp(next, 0.1, 2048) : 1;
    renderOutputControls();
  });
  if (videoModeVidcov) {
    videoModeVidcov.addEventListener('click', () => {
      state.outputMode = state.outputMode === 'vidcov' ? 'episod' : 'vidcov';
      if (state.outputMode === 'vidcov') {
        state.muteAudio = true;
      }
      renderOutputControls();
    });
  }
  if (sizeLimitButtons.length > 0) {
    sizeLimitButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.sizeLimit || '10mb';
        const value = Number.parseFloat(raw);
        if (Number.isFinite(value) && value > 0) {
          state.targetSizeMb = value;
          state.selectedSizeLimit = raw;
          state.outputMode = 'episod';
          state.muteAudio = false;
          renderOutputControls();
        }
      });
    });
  }

  if (videoPlayToggle && videoEditPreview) {
    videoPlayToggle.addEventListener('click', () => {
      if (videoEditPreview.paused) videoEditPreview.play();
      else videoEditPreview.pause();
    });
    videoEditPreview.addEventListener('play', () => { videoPlayToggle.textContent = '⏸'; });
    videoEditPreview.addEventListener('pause', () => { videoPlayToggle.textContent = '▶'; });
  }

  if (videoEditPreview) {
    videoEditPreview.addEventListener('loadedmetadata', () => {
      state.duration = Number(videoEditPreview.duration) || 0;
      state.segments = [{ start: 0, end: state.duration }];
      state.activeSegmentIndex = 0;
      state.trim = { ...state.segments[0] };
      state.timelineZoom = 1;
      state.timelineStartSec = 0;
      state.verticalOffsetPx = 0;
      timelinePreviewState.dirty = true;
      renderTimeline();
      queueFilmstripRender(true);
      renderCropRect();
      renderPlaybackState();
    });
    videoEditPreview.addEventListener('timeupdate', renderPlayhead);
  }

  if (videoTimelineStrip) {
    videoTimelineStrip.addEventListener('pointerdown', handleTimelinePointerDown);
    videoTimelineStrip.addEventListener('wheel', handleTimelineWheel, { passive: false });
  }
  if (videoTimelineZoomIn) videoTimelineZoomIn.addEventListener('click', () => {
    setTimelineZoom((state.timelineZoom || 1) * 1.25);
    renderTimeline();
  });
  if (videoTimelineZoomOut) videoTimelineZoomOut.addEventListener('click', () => {
    setTimelineZoom((state.timelineZoom || 1) / 1.25);
    renderTimeline();
  });
  if (videoTimelineZoomFit) videoTimelineZoomFit.addEventListener('click', () => {
    state.timelineZoom = 1;
    state.timelineStartSec = 0;
    renderTimeline();
  });
  if (videoTimelineOverview) {
    videoTimelineOverview.addEventListener('pointerdown', (event) => {
      if (!state.duration) return;
      if (event.target === videoTimelineOverviewWindow) {
        timelineOverviewDrag = {
          startX: event.clientX,
          startSec: state.timelineStartSec
        };
        videoTimelineOverviewWindow.classList.add('is-dragging');
      } else {
        setOverviewCenterByClientX(event.clientX);
      }
      const move = (moveEvent) => {
        if (!timelineOverviewDrag || !videoTimelineOverview) return;
        const rect = videoTimelineOverview.getBoundingClientRect();
        const dx = moveEvent.clientX - timelineOverviewDrag.startX;
        const secPerPx = rect.width > 0 ? (state.duration / rect.width) : 0;
        state.timelineStartSec = timelineOverviewDrag.startSec + dx * secPerPx;
        clampTimelineStart();
        renderTimeline();
      };
      const up = () => {
        timelineOverviewDrag = null;
        if (videoTimelineOverviewWindow) videoTimelineOverviewWindow.classList.remove('is-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
      event.preventDefault();
    });
  }
  window.addEventListener('keydown', (event) => {
    if (videoEditModal.hidden) return;
    const seg = state.segments[state.activeSegmentIndex];
    if (!seg || !state.duration) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!event.altKey) return;
    const dir = event.key === 'ArrowLeft' ? -1 : 1;
    const step = event.ctrlKey ? 1 : 0.1;
    const minGap = 0.1;
    if (event.shiftKey) {
      seg.end = clamp(seg.end + dir * step, seg.start + minGap, state.duration);
    } else {
      seg.start = clamp(seg.start + dir * step, 0, seg.end - minGap);
    }
    normalizeSegments();
    renderTimeline();
    event.preventDefault();
  });
  if (videoCropRect) videoCropRect.addEventListener('pointerdown', handleCropPointerDown);
  if (videoHistoryRefresh) videoHistoryRefresh.addEventListener('click', (e) => { e.preventDefault(); loadVideoHistory(); });
  if (videoProcessedRefresh) videoProcessedRefresh.addEventListener('click', (e) => { e.preventDefault(); loadVideoHistory(); });
  if (videoUploadBtn && videoUploadInput) {
    videoUploadBtn.addEventListener('click', () => {
      videoUploadInput.click();
    });
  }

  if (videoOverlayUploadBtn && videoOverlayInput) {
    videoOverlayUploadBtn.addEventListener('click', () => videoOverlayInput.click());
  }

  if (videoOverlayInput) {
    videoOverlayInput.addEventListener('change', async () => {
      const file = videoOverlayInput.files && videoOverlayInput.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      setStatus('Uploading overlay template... 0%', 0);
      try {
        const res = await uploadFormWithProgress('upload-video-overlay-template', form, (pct) => {
          setStatus(`Uploading overlay template... ${Math.round(pct)}%`, pct);
        });
        const data = res.data;
        if (!res.ok) throw new Error(data && data.error ? data.error : `overlay upload failed (${res.status})`);
        state.overlayTemplateRelativePath = data && data.relativePath ? data.relativePath : null;
        await loadOverlayTemplates();
        setStatus('Overlay uploaded', 100);
      } catch (err) {
        setStatus(`Overlay upload failed: ${String(err || '').trim()}`.trim(), 0);
      } finally {
        videoOverlayInput.value = '';
      }
    });
  }

  if (videoOverlaySelect) {
    videoOverlaySelect.addEventListener('change', () => {
      const value = videoOverlaySelect.value || null;
      state.overlayTemplateRelativePath = value;
      renderOverlayPreview();
    });
  }

  if (videoUploadInput) {
    videoUploadInput.addEventListener('change', async () => {
      const file = videoUploadInput.files && videoUploadInput.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      setStatus(vt('videoUploading', 'Загружаю видео... 0%'), 0);
      try {
        const res = await uploadFormWithProgress('upload-video', form, (pct) => {
          setStatus(`${vt('videoUploading', 'Загружаю видео...')} ${Math.round(pct)}%`, pct);
        });
        const data = res.data;
        if (!res.ok) {
          const msg = data && data.error ? data.error : `upload failed (${res.status})`;
          if (res.status === 413) throw new Error('Payload too large. Increase reverse-proxy body limit (e.g. nginx client_max_body_size).');
          throw new Error(msg);
        }

        if (data && data.jobId) {
          const normalizeStartedAt = Date.now();
          const normalizeJob = await waitForUploadNormalizeCompletion(data.jobId, 1800000, (p) => {
            const pct = Number.isFinite(p.progress) ? p.progress : null;
            const elapsedSec = (Date.now() - normalizeStartedAt) / 1000;
            const etaSec = pct != null && pct > 1 ? (elapsedSec * (100 - pct)) / pct : null;
            const etaText = Number.isFinite(etaSec) ? ` • ~${formatEta(etaSec)} ${vt('etaLeft', 'осталось')}` : '';
            const label = pct != null
              ? `${vt('videoNormalize', 'Нормализую формат для редактора...')} ${Math.round(pct)}%${etaText}`
              : `${vt('videoNormalizeElapsed', 'Нормализую формат для редактора... прошло')} ${formatEta(elapsedSec)}`;
            setStatus(label, pct, { indeterminate: pct == null });
          }, 1000);

          if (normalizeJob.status !== 'SUCCEEDED') {
            throw new Error(normalizeJob.error || 'normalize failed');
          }
          state.storedName = normalizeJob.storedName || state.storedName;
          if (videoEditPreview && normalizeJob.relativePath) {
            const url = withCacheBust ? withCacheBust(normalizeJob.relativePath, normalizeJob.storedName || normalizeJob.jobId) : normalizeJob.relativePath;
            videoEditPreview.src = url;
            timelinePreviewState.dirty = true;
          }
        } else {
          state.storedName = data.storedName;
          if (videoEditPreview && data.relativePath) {
            const url = withCacheBust ? withCacheBust(data.relativePath, data.storedName) : data.relativePath;
            videoEditPreview.src = url;
            timelinePreviewState.dirty = true;
          }
        }
        setStatus(vt('videoUploaded', 'Видео загружено. Выберите отрезки на таймлайне и нажмите Сделать.'), 100, { indeterminate: false });
        await loadVideoHistory();
        renderOutputControls();
      } catch (err) {
        setStatus(`${vt('videoUploadErrorPrefix', 'Ошибка загрузки видео.')} ${String(err || '').trim()}`.trim(), 0, { indeterminate: false });
      }
    });
  }

  if (videoEditSave) {
    videoEditSave.addEventListener('click', async () => {
      if (!state.storedName) return;
      normalizeSegments();
      const isVidcovMode = state.outputMode === 'vidcov';
      const stageRect = videoPreviewStage ? videoPreviewStage.getBoundingClientRect() : null;
      const outputHeight = isVidcovMode ? 404 : 720;
      const offsetOutPx = stageRect && stageRect.height
        ? (state.verticalOffsetPx / stageRect.height) * outputHeight
        : 0;
      const targetSizeMb = isVidcovMode ? 1.5 : state.targetSizeMb;
      const muteAudio = isVidcovMode ? true : state.muteAudio;

      const payload = {
        storedName: state.storedName,
        trimStartSec: state.segments[0]?.start ?? 0,
        trimEndSec: state.segments[state.segments.length - 1]?.end ?? 0,
        cutStartSec: null,
        cutEndSec: null,
        outputWidth: 1280,
        targetSizeMb,
        verticalOffsetPx: offsetOutPx,
        segments: state.segments.map((x) => ({ startSec: x.start, endSec: x.end })),
        cropX: state.crop.x,
        cropY: state.crop.y,
        cropW: state.crop.w,
        cropH: state.crop.h,
        rotateDeg: state.rotateDeg,
        flipH: state.flipH,
        flipV: state.flipV,
        speed: state.speed,
        muteAudio,
        encodingMode: isVidcovMode ? 'VIDCOV' : 'BALANCED',
        overlayTemplateRelativePath: state.overlayTemplateRelativePath
      };

      setProcessing(true);
      setStatus(vt('videoProcessing', 'Обрабатываю видео... 0%'), 0);
      const processingStartedAt = Date.now();
      const minVisualProcessMs = 1200;
      try {
        const res = await fetch(toAbsoluteUrl('video-process'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        let data;
        try { data = await res.json(); } catch { data = null; }
        if (!res.ok) throw new Error(data && data.error ? data.error : 'process failed');

        if (!data || !data.jobId) throw new Error(vt('Сервер не вернул jobId', 'Сервер не вернул jobId'));
        const job = await waitForJobCompletion(data.jobId, 180000, (p) => {
          const pct = Number.isFinite(p.progress) ? p.progress : null;
          let label;
          if (p.status === 'QUEUED') {
            label = vt('videoQueue', 'В очереди...');
          } else if (pct != null) {
            const elapsedSec = (Date.now() - processingStartedAt) / 1000;
            const etaSec = pct > 1 ? (elapsedSec * (100 - pct)) / pct : null;
            const etaText = Number.isFinite(etaSec) ? ` • ~${formatEta(etaSec)} ${vt('etaLeft', 'осталось')}` : '';
            label = `${vt('videoProcessing', 'Обрабатываю видео...')} ${Math.round(pct)}%${etaText}`;
          } else {
            label = vt('videoProcessing', 'Обрабатываю видео...');
          }
          setStatus(label, pct ?? 0);
        }, 1000);

        const spentMs = Date.now() - processingStartedAt;
        if (spentMs < minVisualProcessMs) {
          await new Promise((resolve) => setTimeout(resolve, minVisualProcessMs - spentMs));
        }
        if (job.status !== 'SUCCEEDED') {
          const statusMsg = vt('Задача завершилась со статусом', 'Задача завершилась со статусом');
          throw new Error(job.error || `${statusMsg} ${job.status}`);
        }

        if (videoEditPreview && job.relativeOutputPath) {
          videoEditPreview.src = withCacheBust ? withCacheBust(job.relativeOutputPath, data.jobId) : job.relativeOutputPath;
          timelinePreviewState.dirty = true;
        }

        setStatus(vt('videoDone', 'Готово. Результат появился в Processed.'), 100);
        await loadVideoHistory();
        console.info(`Results refreshed (${processed.length})`);
      } catch (err) {
        setStatus(`${vt('videoProcessErrorPrefix', 'Ошибка обработки видео.')} ${String(err || '').trim()}`.trim(), 0);
      } finally {
        setProcessing(false);
      }
    });
  }

  window.addEventListener('resize', () => {
    renderCropRect();
    renderTimeline();
  });

  renderAll();

  window.addEventListener('jmaka:language-changed', () => {
    if (!videoEditModal.hidden) {
      renderToolState();
    }
  });
})();
