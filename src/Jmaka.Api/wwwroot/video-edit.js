(() => {
  console.info('VideoEdit v0.4.0 loaded');
  
  const videoEditModal = document.getElementById('videoEditModal');
  if (!videoEditModal) return;

  const videoEditToolBtn = document.getElementById('videoEditToolBtn');
  const videoEditCloseBtn = document.getElementById('videoEditClose');
  const videoEditCancelBtn = document.getElementById('videoEditCancel');
  const videoEditHint = document.getElementById('videoEditHint');
  const videoEditPreview = document.getElementById('videoEditPreview');
  const videoUploadInput = document.getElementById('videoUploadInput');
  const videoHistoryRefresh = document.getElementById('videoHistoryRefresh');
  const videoProcessedRefresh = document.getElementById('videoProcessedRefresh');
  const videoOriginalsList = document.getElementById('videoOriginalsList');
  const videoProcessedList = document.getElementById('videoProcessedList');
  const videoTimelineStrip = document.getElementById('videoTimelineStrip');
  const videoTimelineCanvas = document.getElementById('videoTimelineCanvas');
  const videoTimelineSegments = document.getElementById('videoTimelineSegments');
  const videoTimelinePlayhead = document.getElementById('videoTimelinePlayhead');
  const videoTrimStartLabel = document.getElementById('videoTrimStartLabel');
  const videoTrimEndLabel = document.getElementById('videoTrimEndLabel');
  const videoCurrentTime = document.getElementById('videoCurrentTime');
  const videoDuration = document.getElementById('videoDuration');
  const videoPlayToggle = document.getElementById('videoPlayToggle');
  const videoEditSave = document.getElementById('videoEditSave');
  const videoRotateCw = document.getElementById('videoRotateCw');
  const videoRotateCcw = document.getElementById('videoRotateCcw');
  const videoRotateReset = document.getElementById('videoRotateReset');
  const videoSpeedRange = document.getElementById('videoSpeedRange');
  const videoSpeedValue = document.getElementById('videoSpeedValue');
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

  const timelinePreviewState = {
    dirty: true,
    sourceToken: '',
    frameCount: 0
  };

  const toolButtons = Array.from(videoEditModal.querySelectorAll('[data-tool]'));
  const toolPanels = Array.from(videoEditModal.querySelectorAll('[data-tool-panel]'));

  const state = {
    tool: 'trim',
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
    muteAudio: false,
    targetSizeMb: 1,
  };

  let originals = [];
  let processed = [];
  let timelineDrag = null;

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
  }

  function setProcessing(isProcessing) {
    if (videoProcessingOverlay) videoProcessingOverlay.classList.toggle('is-active', !!isProcessing);
    if (videoEditSave) videoEditSave.disabled = isProcessing || !state.storedName;
  }

  function renderToolState() {
    toolButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tool === state.tool));
    toolPanels.forEach((panel) => { panel.hidden = panel.dataset.toolPanel !== state.tool; });
    if (videoCropOverlay) videoCropOverlay.hidden = state.tool !== 'crop';
    if (videoSegmentsInfo) {
      const n = state.segments.length;
      videoSegmentsInfo.textContent = `${n} segment${n === 1 ? '' : 's'}`;
    }
  }

  function renderPlaybackState() {
    if (!videoEditPreview) return;
    const flipX = state.flipH ? -1 : 1;
    const flipY = state.flipV ? -1 : 1;
    videoEditPreview.style.transform = `rotate(${state.rotateDeg}deg) scale(${flipX}, ${flipY})`;
    videoEditPreview.playbackRate = state.speed;
    if (videoSpeedValue) videoSpeedValue.textContent = `${state.speed.toFixed(1)}x`;
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

  function renderTimeline() {
    if (!videoTimelineStrip || !videoTimelineSegments) return;
    const rect = videoTimelineStrip.getBoundingClientRect();
    const duration = state.duration || 0;
    videoTimelineSegments.innerHTML = '';
    if (rect.width > 0 && duration > 0) {
      state.segments.forEach((seg, index) => {
        const startPct = seg.start / duration;
        const endPct = seg.end / duration;
        const node = document.createElement('div');
        node.className = 'timeline-selection';
        if (index === state.activeSegmentIndex) node.classList.add('is-active');
        node.dataset.index = String(index);
        node.style.left = `${startPct * rect.width}px`;
        node.style.width = `${Math.max(0, (endPct - startPct) * rect.width)}px`;
        node.innerHTML = '<span class="timeline-handle start" data-handle="start"></span><span class="timeline-handle end" data-handle="end"></span>';
        videoTimelineSegments.appendChild(node);
      });
    }

    const active = state.segments[state.activeSegmentIndex] || { start: 0, end: 0 };
    if (videoTrimStartLabel) videoTrimStartLabel.textContent = formatTime(active.start);
    if (videoTrimEndLabel) videoTrimEndLabel.textContent = formatTime(active.end);
    if (videoDuration) videoDuration.textContent = formatTime(duration);

    queueFilmstripRender(false);
    renderPlayhead();
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

    const frameWidth = Math.max(48, Math.floor(width / 14));
    const frameCount = Math.max(6, Math.ceil(width / frameWidth));
    const sourceToken = `${videoEditPreview.currentSrc || videoEditPreview.src || ''}|${state.duration}|${width}x${height}`;
    if (!force && !timelinePreviewState.dirty && timelinePreviewState.sourceToken === sourceToken && timelinePreviewState.frameCount === frameCount) {
      return;
    }

    timelinePreviewState.dirty = false;
    timelinePreviewState.sourceToken = sourceToken;
    timelinePreviewState.frameCount = frameCount;

    const captureVideo = document.createElement('video');
    captureVideo.crossOrigin = 'anonymous';
    captureVideo.muted = true;
    captureVideo.preload = 'auto';
    captureVideo.src = videoEditPreview.currentSrc || videoEditPreview.src;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameCanvas = document.createElement('canvas');
    const frameCtx = frameCanvas.getContext('2d');
    if (!frameCtx) return;

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

    captureVideo.addEventListener('loadedmetadata', async () => {
      if (!captureVideo.videoWidth || !captureVideo.videoHeight) return;
      frameCanvas.width = captureVideo.videoWidth;
      frameCanvas.height = captureVideo.videoHeight;

      for (let i = 0; i < frameCount; i++) {
        const t = frameCount === 1 ? 0 : (i / (frameCount - 1)) * Math.max(0, state.duration - 0.05);
        try {
          await new Promise((resolve) => {
            const done = () => {
              captureVideo.removeEventListener('seeked', done);
              resolve();
            };
            captureVideo.addEventListener('seeked', done, { once: true });
            captureVideo.currentTime = t;
          });
          drawFrameAtIndex(i);
        } catch {
          // ignore and keep placeholder if decoding fails
        }
      }
    }, { once: true });
  }

  function renderPlayhead() {
    if (!videoTimelinePlayhead || !videoTimelineStrip || !videoEditPreview || !state.duration) return;
    const rect = videoTimelineStrip.getBoundingClientRect();
    const pct = clamp(videoEditPreview.currentTime / state.duration, 0, 1);
    videoTimelinePlayhead.style.left = `${pct * rect.width}px`;
    if (videoCurrentTime) videoCurrentTime.textContent = formatTime(videoEditPreview.currentTime);
  }

  function renderOutputControls() {
    if (videoTargetSize) videoTargetSize.value = String(state.targetSizeMb);
    if (videoEditSave) videoEditSave.disabled = !state.storedName;
    if (videoMuteLabel) videoMuteLabel.textContent = state.muteAudio ? 'Unmute' : 'Mute';
    const muteWrap = videoMuteLabel ? videoMuteLabel.closest('.tool-toggle') : null;
    if (muteWrap) muteWrap.classList.toggle('is-active', state.muteAudio);
  }

  function renderAll() {
    normalizeSegments();
    renderToolState();
    renderPlaybackState();
    renderCropRect();
    renderTimeline();
    renderOutputControls();
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

  function normalizeJobStatus(rawStatus) {
    if (typeof rawStatus === 'string') return rawStatus.toUpperCase();
    const enumMap = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED'];
    if (Number.isInteger(rawStatus) && rawStatus >= 0 && rawStatus < enumMap.length) {
      return enumMap[rawStatus];
    }
    return String(rawStatus || '').toUpperCase();
  }

  async function waitForJobCompletion(jobId, timeoutMs = 180000) {
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
      if (terminal.has(status)) {
        return { ...data, status };
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw new Error(vt('Превышено время ожидания завершения задачи', 'Превышено время ожидания завершения задачи'));
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

    if (originals.length === 0) videoOriginalsList.textContent = vt('Нет загрузок.', 'Нет загрузок.');
    else originals.forEach((item) => renderItem(item, videoOriginalsList, false));

    if (processed.length === 0) {
      const warn = document.createElement('div');
      warn.className = 'video-list-empty-warning';
      warn.textContent = vt('Results пока пуст.', 'Results пока пуст.');
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
    loadVideoHistory();
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
    return (x / rect.width) * state.duration;
  }

  function handleTimelinePointerDown(event) {
    if (!videoTimelineStrip || !videoTimelineSegments) return;
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

  function resetAllEdits() {
    const duration = state.duration || 0;
    state.segments = [{ start: 0, end: duration }];
    state.activeSegmentIndex = 0;
    state.trim = { start: 0, end: duration };
    state.crop = { x: 0, y: 0, w: 1, h: 1 };
    state.rotateDeg = 0;
    state.flipH = false;
    state.flipV = false;
    state.speed = 1;
    state.muteAudio = false;
    state.tool = 'trim';
    
    // Update UI elements
    if (videoSpeedRange) videoSpeedRange.value = '1';
    if (videoMuteAudio) videoMuteAudio.checked = false;
    
    // Re-render everything
    renderToolState();
    renderPlaybackState();
    renderCropRect();
    renderTimeline();
    
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

  if (videoMuteAudio) videoMuteAudio.addEventListener('change', () => {
    state.muteAudio = videoMuteAudio.checked;
    renderOutputControls();
  });

  if (videoResetBtn) videoResetBtn.addEventListener('click', resetAllEdits);
  if (videoTargetSize) videoTargetSize.addEventListener('change', () => {
    const next = Number(videoTargetSize.value);
    state.targetSizeMb = Number.isFinite(next) ? clamp(next, 0.1, 2048) : 1;
    renderOutputControls();
  });

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
      timelinePreviewState.dirty = true;
      renderTimeline();
      queueFilmstripRender(true);
      renderCropRect();
    });
    videoEditPreview.addEventListener('timeupdate', renderPlayhead);
  }

  if (videoTimelineStrip) videoTimelineStrip.addEventListener('pointerdown', handleTimelinePointerDown);
  if (videoCropRect) videoCropRect.addEventListener('pointerdown', handleCropPointerDown);
  if (videoHistoryRefresh) videoHistoryRefresh.addEventListener('click', (e) => { e.preventDefault(); loadVideoHistory(); });
  if (videoProcessedRefresh) videoProcessedRefresh.addEventListener('click', (e) => { e.preventDefault(); loadVideoHistory(); });

  if (videoUploadInput) {
    videoUploadInput.addEventListener('change', async () => {
      const file = videoUploadInput.files && videoUploadInput.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      setHint(vt('videoUploading', 'Загружаю видео...'));
      try {
        const res = await fetchWithFallback('upload-video', { method: 'POST', body: form });
        let data;
        try { data = await res.json(); } catch { data = null; }
        if (!res.ok) throw new Error(data && data.error ? data.error : 'upload failed');
        state.storedName = data.storedName;
        if (videoEditPreview && data.relativePath) {
          const url = withCacheBust ? withCacheBust(data.relativePath, data.storedName) : data.relativePath;
          videoEditPreview.src = url;
          timelinePreviewState.dirty = true;
        }
        setHint(vt('videoUploaded', 'Видео загружено. Выберите отрезки на таймлайне и нажмите Сделать.'));
        await loadVideoHistory();
        renderOutputControls();
      } catch (err) {
        setHint(`Ошибка загрузки видео. ${String(err || '').trim()}`.trim());
      }
    });
  }

  if (videoEditSave) {
    videoEditSave.addEventListener('click', async () => {
      if (!state.storedName) return;
      normalizeSegments();
      const payload = {
        storedName: state.storedName,
        trimStartSec: state.segments[0]?.start ?? 0,
        trimEndSec: state.segments[state.segments.length - 1]?.end ?? 0,
        cutStartSec: null,
        cutEndSec: null,
        outputWidth: 1280,
        targetSizeMb: state.targetSizeMb,
        verticalOffsetPx: 0,
        segments: state.segments.map((x) => ({ startSec: x.start, endSec: x.end })),
        cropX: state.crop.x,
        cropY: state.crop.y,
        cropW: state.crop.w,
        cropH: state.crop.h,
        rotateDeg: state.rotateDeg,
        flipH: state.flipH,
        flipV: state.flipV,
        speed: state.speed,
        muteAudio: state.muteAudio
      };

      setProcessing(true);
      setHint(vt('videoProcessing', 'Обрабатываю видео...'));
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
        const job = await waitForJobCompletion(data.jobId);
        if (job.status !== 'SUCCEEDED') {
          const statusMsg = vt('Задача завершилась со статусом', 'Задача завершилась со статусом');
          throw new Error(job.error || `${statusMsg} ${job.status}`);
        }

        if (videoEditPreview && job.relativeOutputPath) {
          videoEditPreview.src = withCacheBust ? withCacheBust(job.relativeOutputPath, data.jobId) : job.relativeOutputPath;
          timelinePreviewState.dirty = true;
        }

        setHint(vt('videoDone', 'Готово. Результат появился в Processed.'));
        await loadVideoHistory();
        console.info(`Results refreshed (${processed.length})`);
      } catch (err) {
        setHint(`Ошибка обработки видео. ${String(err || '').trim()}`.trim());
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
