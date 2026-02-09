(() => {
  const videoEditModal = document.getElementById('videoEditModal');
  if (!videoEditModal) return;

  const videoEditToolBtn = document.getElementById('videoEditToolBtn');
  const videoEditCloseBtn = document.getElementById('videoEditClose');
  const videoEditCancelBtn = document.getElementById('videoEditCancel');
  const videoEditHint = document.getElementById('videoEditHint');
  const videoEditPreview = document.getElementById('videoEditPreview');
  const videoUploadInput = document.getElementById('videoUploadInput');
  const videoHistoryRefresh = document.getElementById('videoHistoryRefresh');
  const videoOriginalsList = document.getElementById('videoOriginalsList');
  const videoProcessedList = document.getElementById('videoProcessedList');
  const videoTimelineStrip = document.getElementById('videoTimelineStrip');
  const videoTimelineCanvas = document.getElementById('videoTimelineCanvas');
  const videoTimelineSelection = document.getElementById('videoTimelineSelection');
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
  const videoFlipH = document.getElementById('videoFlipH');
  const videoFlipV = document.getElementById('videoFlipV');
  const videoSpeedRange = document.getElementById('videoSpeedRange');
  const videoSpeedValue = document.getElementById('videoSpeedValue');
  const videoTargetSize = document.getElementById('videoTargetSize');
  const videoVerticalOffset = document.getElementById('videoVerticalOffset');
  const videoCropOverlay = document.getElementById('videoCropOverlay');
  const videoCropRect = document.getElementById('videoCropRect');
  const videoProcessingOverlay = document.getElementById('videoProcessingOverlay');

  const toolButtons = Array.from(videoEditModal.querySelectorAll('[data-tool]'));
  const toolPanels = Array.from(videoEditModal.querySelectorAll('[data-tool-panel]'));
  const outputWidthInputs = Array.from(videoEditModal.querySelectorAll('input[name="videoOutputWidth"]'));

  const state = {
    tool: 'trim',
    storedName: null,
    duration: 0,
    trim: { start: 0, end: 0 },
    segments: [{ start: 0, end: 0 }],
    crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    rotateDeg: 0,
    flipH: false,
    flipV: false,
    speed: 1,
    outputWidth: 1280,
    targetSizeMb: 5,
    verticalOffsetPx: 0
  };

  let originals = [];
  let processed = [];
  let timelineDrag = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const total = Math.max(0, seconds);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const tenths = Math.floor((total % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
  }

  function setHint(text) {
    if (videoEditHint) videoEditHint.textContent = text;
  }

  function setProcessing(isProcessing) {
    if (videoProcessingOverlay) videoProcessingOverlay.hidden = !isProcessing;
    if (videoEditSave) videoEditSave.disabled = isProcessing || !state.storedName;
  }

  function setTool(tool) {
    state.tool = tool;
    renderToolState();
  }

  function renderToolState() {
    toolButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tool === state.tool);
    });
    toolPanels.forEach((panel) => {
      panel.hidden = panel.dataset.toolPanel !== state.tool;
    });
    if (videoCropOverlay) {
      videoCropOverlay.hidden = state.tool !== 'crop';
    }
  }

  function renderPlaybackState() {
    if (!videoEditPreview) return;
    const flipX = state.flipH ? -1 : 1;
    const flipY = state.flipV ? -1 : 1;
    videoEditPreview.style.transform = `rotate(${state.rotateDeg}deg) scale(${flipX}, ${flipY})`;
    videoEditPreview.playbackRate = state.speed;
    if (videoSpeedValue) {
      videoSpeedValue.textContent = `${state.speed.toFixed(1)}x`;
    }
  }

  function renderCropRect() {
    if (!videoCropRect || !videoEditPreview || !videoCropOverlay) return;
    const bounds = videoEditPreview.getBoundingClientRect();
    const overlayBounds = videoCropOverlay.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const offsetLeft = bounds.left - overlayBounds.left;
    const offsetTop = bounds.top - overlayBounds.top;
    const left = offsetLeft + state.crop.x * bounds.width;
    const top = offsetTop + state.crop.y * bounds.height;
    const width = state.crop.w * bounds.width;
    const height = state.crop.h * bounds.height;
    videoCropRect.style.left = `${left}px`;
    videoCropRect.style.top = `${top}px`;
    videoCropRect.style.width = `${width}px`;
    videoCropRect.style.height = `${height}px`;
  }

  function updateTrim(start, end) {
    const duration = state.duration || 0;
    const safeStart = clamp(start, 0, duration);
    const safeEnd = clamp(end, 0, duration);
    const minGap = 0.1;
    if (safeEnd - safeStart < minGap) {
      if (timelineDrag && timelineDrag.type === 'start') {
        state.trim.start = clamp(safeEnd - minGap, 0, duration);
        state.trim.end = safeEnd;
      } else {
        state.trim.start = safeStart;
        state.trim.end = clamp(safeStart + minGap, 0, duration);
      }
    } else {
      state.trim.start = safeStart;
      state.trim.end = safeEnd;
    }
    state.segments[0] = { start: state.trim.start, end: state.trim.end };
    renderTimeline();
  }

  function renderTimeline() {
    if (!videoTimelineStrip || !videoTimelineSelection) return;
    const rect = videoTimelineStrip.getBoundingClientRect();
    if (!rect.width) return;
    const duration = state.duration || 0;
    const startPct = duration ? state.trim.start / duration : 0;
    const endPct = duration ? state.trim.end / duration : 0;
    const leftPx = startPct * rect.width;
    const rightPx = endPct * rect.width;
    videoTimelineSelection.style.left = `${leftPx}px`;
    videoTimelineSelection.style.width = `${Math.max(0, rightPx - leftPx)}px`;
    if (videoTrimStartLabel) videoTrimStartLabel.textContent = formatTime(state.trim.start);
    if (videoTrimEndLabel) videoTrimEndLabel.textContent = formatTime(state.trim.end);
    if (videoDuration) videoDuration.textContent = formatTime(duration);
    drawFilmstrip();
    renderPlayhead();
  }

  function renderPlayhead() {
    if (!videoTimelinePlayhead || !videoTimelineStrip || !videoEditPreview) return;
    const rect = videoTimelineStrip.getBoundingClientRect();
    if (!rect.width || !state.duration) return;
    const pct = clamp(videoEditPreview.currentTime / state.duration, 0, 1);
    videoTimelinePlayhead.style.left = `${pct * rect.width}px`;
    if (videoCurrentTime) videoCurrentTime.textContent = formatTime(videoEditPreview.currentTime);
  }

  function drawFilmstrip() {
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

  function renderOutputControls() {
    outputWidthInputs.forEach((input) => {
      input.checked = Number(input.value) === state.outputWidth;
    });
    if (videoTargetSize) videoTargetSize.value = String(state.targetSizeMb);
    if (videoVerticalOffset) videoVerticalOffset.value = String(state.verticalOffsetPx);
    if (videoEditSave) videoEditSave.disabled = !state.storedName;
  }

  function renderAll() {
    renderToolState();
    renderPlaybackState();
    renderCropRect();
    renderTimeline();
    renderOutputControls();
  }

  async function loadVideoHistory() {
    if (!videoOriginalsList || !videoProcessedList) return;
    videoOriginalsList.textContent = 'Загрузка...';
    videoProcessedList.textContent = 'Загрузка...';
    try {
      const res = await fetch(toAbsoluteUrl('video-history'), { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        videoOriginalsList.textContent = 'Ошибка загрузки.';
        videoProcessedList.textContent = 'Ошибка загрузки.';
        return;
      }
      originals = data.filter((item) => item && item.kind !== 'processed');
      processed = data.filter((item) => item && item.kind === 'processed');
      renderVideoLists();
    } catch {
      videoOriginalsList.textContent = 'Ошибка загрузки.';
      videoProcessedList.textContent = 'Ошибка загрузки.';
    }
  }

  function renderVideoLists() {
    if (!videoOriginalsList || !videoProcessedList) return;
    videoOriginalsList.textContent = '';
    videoProcessedList.textContent = '';
    const renderItem = (item, listEl, isProcessed) => {
      const row = document.createElement('div');
      row.className = 'video-list-item';
      if (!isProcessed && item.storedName === state.storedName) {
        row.classList.add('is-active');
      }
      row.addEventListener('click', () => {
        if (!item.relativePath) return;
        const url = withCacheBust ? withCacheBust(item.relativePath, item.storedName) : item.relativePath;
        if (videoEditPreview) {
          videoEditPreview.src = url;
        }
        if (isProcessed) {
          setHint('Просмотр результата. Для обработки выберите оригинал.');
          return;
        }
        state.storedName = item.storedName;
        setHint('Выберите отрезок и нажмите Save.');
        if (videoEditSave) videoEditSave.disabled = false;
      });
      const thumb = document.createElement('div');
      thumb.className = 'video-thumb';
      thumb.textContent = 'MP4';
      const meta = document.createElement('div');
      meta.className = 'video-list-meta';
      const name = document.createElement('div');
      name.textContent = item.originalName || item.storedName || 'video';
      const details = document.createElement('div');
      const duration = Number(item.durationSeconds || 0);
      details.textContent = `${formatTime(duration)} · ${item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}`;
      meta.appendChild(name);
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

    if (originals.length === 0) {
      videoOriginalsList.textContent = 'Нет загрузок.';
    } else {
      originals.forEach((item) => renderItem(item, videoOriginalsList, false));
    }

    if (processed.length === 0) {
      videoProcessedList.textContent = 'Пока нет результатов.';
    } else {
      processed.forEach((item) => renderItem(item, videoProcessedList, true));
    }
  }

  function openModal() {
    videoEditModal.hidden = false;
    setHint('Загрузите видео и выберите отрезок.');
    loadVideoHistory();
    renderAll();
  }

  function closeModal() {
    videoEditModal.hidden = true;
    if (videoEditPreview) {
      videoEditPreview.pause();
    }
  }

  function timelinePointerToTime(clientX) {
    if (!videoTimelineStrip || !state.duration) return 0;
    const rect = videoTimelineStrip.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    return (x / rect.width) * state.duration;
  }

  function handleTimelinePointerDown(event) {
    if (!videoTimelineStrip) return;
    const target = event.target;
    if (target && target.dataset && target.dataset.handle) {
      timelineDrag = { type: target.dataset.handle };
    } else if (target === videoTimelineSelection) {
      const clickTime = timelinePointerToTime(event.clientX);
      timelineDrag = {
        type: 'range',
        offset: clickTime - state.trim.start,
        length: state.trim.end - state.trim.start
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
    if (timelineDrag.type === 'start') {
      updateTrim(time, state.trim.end);
    } else if (timelineDrag.type === 'end') {
      updateTrim(state.trim.start, time);
    } else if (timelineDrag.type === 'range') {
      const start = clamp(time - timelineDrag.offset, 0, state.duration - timelineDrag.length);
      updateTrim(start, start + timelineDrag.length);
    } else if (timelineDrag.type === 'playhead' && videoEditPreview) {
      videoEditPreview.currentTime = time;
      renderPlayhead();
    }
  }

  function handleTimelinePointerUp() {
    timelineDrag = null;
    window.removeEventListener('pointermove', handleTimelinePointerMove);
    window.removeEventListener('pointerup', handleTimelinePointerUp);
  }

  function handleCropPointerDown(event) {
    if (!videoCropRect || state.tool !== 'crop') return;
    const handle = event.target.dataset && event.target.dataset.handle;
    const rect = videoCropRect.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startState = { ...state.crop };
    const bounds = videoEditPreview.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / bounds.width;
      const dy = (moveEvent.clientY - startY) / bounds.height;
      if (!handle) {
        const nextX = clamp(startState.x + dx, 0, 1 - startState.w);
        const nextY = clamp(startState.y + dy, 0, 1 - startState.h);
        state.crop.x = nextX;
        state.crop.y = nextY;
      } else {
        let nextX = startState.x;
        let nextY = startState.y;
        let nextW = startState.w;
        let nextH = startState.h;
        if (handle.includes('r')) {
          nextW = clamp(startState.w + dx, 0.1, 1 - startState.x);
        }
        if (handle.includes('l')) {
          nextX = clamp(startState.x + dx, 0, startState.x + startState.w - 0.1);
          nextW = startState.w - (nextX - startState.x);
        }
        if (handle.includes('b')) {
          nextH = clamp(startState.h + dy, 0.1, 1 - startState.y);
        }
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

  if (videoEditToolBtn) {
    videoEditToolBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openModal();
    });
  }

  if (videoEditCloseBtn) videoEditCloseBtn.addEventListener('click', closeModal);
  if (videoEditCancelBtn) videoEditCancelBtn.addEventListener('click', closeModal);
  if (videoEditModal) {
    videoEditModal.addEventListener('click', (event) => {
      const t = event.target;
      if (t && t.dataset && t.dataset.close) closeModal();
    });
  }

  toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  if (videoRotateCw) {
    videoRotateCw.addEventListener('click', () => {
      state.rotateDeg = (state.rotateDeg + 90) % 360;
      renderPlaybackState();
    });
  }
  if (videoRotateCcw) {
    videoRotateCcw.addEventListener('click', () => {
      state.rotateDeg = (state.rotateDeg - 90 + 360) % 360;
      renderPlaybackState();
    });
  }
  if (videoRotateReset) {
    videoRotateReset.addEventListener('click', () => {
      state.rotateDeg = 0;
      renderPlaybackState();
    });
  }
  if (videoFlipH) {
    videoFlipH.addEventListener('click', () => {
      state.flipH = !state.flipH;
      renderPlaybackState();
    });
  }
  if (videoFlipV) {
    videoFlipV.addEventListener('click', () => {
      state.flipV = !state.flipV;
      renderPlaybackState();
    });
  }

  if (videoSpeedRange) {
    videoSpeedRange.addEventListener('input', () => {
      state.speed = Number(videoSpeedRange.value);
      renderPlaybackState();
    });
  }

  outputWidthInputs.forEach((input) => {
    input.addEventListener('change', () => {
      state.outputWidth = Number(input.value);
      renderOutputControls();
    });
  });

  if (videoTargetSize) {
    videoTargetSize.addEventListener('change', () => {
      state.targetSizeMb = Number(videoTargetSize.value) || 5;
      renderOutputControls();
    });
  }

  if (videoVerticalOffset) {
    videoVerticalOffset.addEventListener('change', () => {
      state.verticalOffsetPx = Number(videoVerticalOffset.value) || 0;
      renderOutputControls();
    });
  }

  if (videoPlayToggle && videoEditPreview) {
    videoPlayToggle.addEventListener('click', () => {
      if (videoEditPreview.paused) {
        videoEditPreview.play();
      } else {
        videoEditPreview.pause();
      }
    });
    videoEditPreview.addEventListener('play', () => {
      videoPlayToggle.textContent = '⏸';
    });
    videoEditPreview.addEventListener('pause', () => {
      videoPlayToggle.textContent = '▶';
    });
  }

  if (videoEditPreview) {
    videoEditPreview.addEventListener('loadedmetadata', () => {
      state.duration = Number(videoEditPreview.duration) || 0;
      state.trim = { start: 0, end: state.duration };
      state.segments = [{ ...state.trim }];
      renderTimeline();
      renderCropRect();
    });
    videoEditPreview.addEventListener('timeupdate', renderPlayhead);
  }

  if (videoTimelineStrip) {
    videoTimelineStrip.addEventListener('pointerdown', handleTimelinePointerDown);
  }

  if (videoCropRect) {
    videoCropRect.addEventListener('pointerdown', handleCropPointerDown);
  }

  if (videoHistoryRefresh) {
    videoHistoryRefresh.addEventListener('click', (event) => {
      event.preventDefault();
      loadVideoHistory();
    });
  }

  if (videoUploadInput) {
    videoUploadInput.addEventListener('change', async () => {
      const file = videoUploadInput.files && videoUploadInput.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      setHint('Загружаю видео...');
      try {
        const res = await fetchWithFallback('upload-video', { method: 'POST', body: form });
        let data;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (!res.ok) throw new Error(data && data.error ? data.error : 'upload failed');
        state.storedName = data.storedName;
        if (videoEditPreview && data.relativePath) {
          const url = withCacheBust ? withCacheBust(data.relativePath, data.storedName) : data.relativePath;
          videoEditPreview.src = url;
        }
        setHint('Видео загружено. Отметьте отрезок и нажмите Save.');
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
      const payload = {
        storedName: state.storedName,
        trimStartSec: state.trim.start,
        trimEndSec: state.trim.end,
        cutStartSec: null,
        cutEndSec: null,
        outputWidth: state.outputWidth,
        targetSizeMb: state.targetSizeMb,
        verticalOffsetPx: state.verticalOffsetPx
      };
      setProcessing(true);
      setHint('Обрабатываю видео...');
      try {
        const res = await fetch(toAbsoluteUrl('video-process'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        let data;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        if (!res.ok) throw new Error(data && data.error ? data.error : 'process failed');
        if (videoEditPreview && data.relativePath) {
          videoEditPreview.src = withCacheBust ? withCacheBust(data.relativePath, state.storedName) : data.relativePath;
        }
        setHint('Готово. Результат появился в Processed.');
        await loadVideoHistory();
      } catch (err) {
        setHint(`Ошибка обработки видео. ${String(err || '').trim()}`.trim());
      } finally {
        setProcessing(false);
      }
    });
  }

  renderAll();
  window.addEventListener('resize', () => {
    renderCropRect();
    renderTimeline();
  });
})();
