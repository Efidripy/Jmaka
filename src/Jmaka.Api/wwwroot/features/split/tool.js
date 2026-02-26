// -------- Split tool --------

function getSplitHalfRect(which) {
  const el = which === 'a' ? splitHalfLeft : splitHalfRight;
  if (!el) return null;
  return el.getBoundingClientRect();
}

function splitGetPointerPosInHalf(which, e) {
  const r = getSplitHalfRect(which);
  if (!r) return { x: 0, y: 0 };
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function splitBringToFront(which) {
  if (!splitItemA || !splitItemB) return;
  if (which === 'a') {
    splitItemA.style.zIndex = '2';
    splitItemB.style.zIndex = '1';
  } else {
    splitItemA.style.zIndex = '1';
    splitItemB.style.zIndex = '2';
  }
}

function splitGetHalfSize(which) {
  const r = getSplitHalfRect(which);
  if (!r) return { w: 0, h: 0 };
  return { w: r.width, h: r.height };
}

const splitState = {
  open: false,
  history: [],
  action: null,
  a: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 },
  b: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 }
};

function splitShowItem(which) {
  const st = which === 'a' ? splitState.a : splitState.b;
  const el = which === 'a' ? splitItemA : splitItemB;
  if (!el) return;

  el.style.left = `${st.x}px`;
  el.style.top = `${st.y}px`;
  el.style.width = `${st.w}px`;
  el.style.height = `${st.h}px`;
}

function splitClampMove(which, st, halfW, halfH) {
  // Allow moving/scale freely inside each half container.
  // Anything outside the half is clipped by CSS overflow hidden.
  // Keep at least a small visible portion so you don't lose the image completely.
  const minVisible = 24;

  const minX = -st.w + minVisible;
  const maxX = halfW - minVisible;

  const minY = -st.h + minVisible;
  const maxY = halfH - minVisible;

  st.x = Math.min(Math.max(st.x, minX), maxX);
  st.y = Math.min(Math.max(st.y, minY), maxY);
}

function splitClampResize(which, st, halfW, halfH, aspect) {
  const minW = 60;
  const maxWHard = 20000;

  // In half mode there is no "forbidden" crossing; the other side is simply clipped.
  st.w = Math.max(minW, Math.min(st.w, maxWHard));
  st.h = st.w / aspect;

  splitClampMove(which, st, halfW, halfH);
}

function splitLayoutDefaults() {
  // Layout inside each half container.
  for (const which of ['a', 'b']) {
    const st = which === 'a' ? splitState.a : splitState.b;
    if (!st.url || !st.natW || !st.natH) continue;

    const { w: halfW, h: halfH } = splitGetHalfSize(which);
    if (!halfW || !halfH) continue;

    const aspect = st.natW / st.natH;
    const targetW = halfW * 1.15;
    st.w = targetW;
    st.h = st.w / aspect;

    if (st.h > halfH * 0.9) {
      st.h = halfH * 0.9;
      st.w = st.h * aspect;
    }

    st.x = (halfW - st.w) / 2;
    st.y = (halfH - st.h) / 2;
    splitClampMove(which, st, halfW, halfH);
    splitShowItem(which);
  }
}

async function fetchHistoryRaw() {
  try {
    const res = await fetch(toAbsoluteUrl('history'), { cache: 'no-store' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = []; }
    if (!res.ok || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function splitGetPreviewUrl(item) {
  if (!item) return null;
  const rel = item.previewRelativePath ? item.previewRelativePath : item.originalRelativePath;
  if (!rel) return null;
  return withCacheBust(String(rel), item.storedName);
}

function splitUpdateTargetThumb(which) {
  const st = which === 'a' ? splitState.a : splitState.b;
  const img = which === 'a' ? splitTargetImgA : splitTargetImgB;
  if (!img) return;

  if (!st || !st.storedName) {
    img.removeAttribute('src');
    img.alt = '';
    return;
  }

  const item = splitState.history.find(x => x && x.storedName === st.storedName);
  const src = item ? splitGetPreviewUrl(item) : null;
  if (!src) {
    img.removeAttribute('src');
    img.alt = '';
    return;
  }

  img.src = src;
  img.alt = item.originalName || item.storedName || '';
}

function splitSyncGallerySelection() {
  if (!splitGallery) return;
  const a = splitState.a && splitState.a.storedName;
  const b = splitState.b && splitState.b.storedName;

  for (const btn of Array.from(splitGallery.querySelectorAll('button.split-thumb'))) {
    const sn = btn.dataset && btn.dataset.sn ? btn.dataset.sn : '';
    btn.classList.toggle('is-selected', sn && (sn === a || sn === b));
  }
}

function splitGetOriginalUrl(item) {
  if (!item || !item.storedName) return null;
  // Для Split/Split3 всегда тянем настоящий исходник: upload-original/<storedName>
  const rel = `upload-original/${item.storedName}`;
  return withCacheBust(rel, item.storedName);
}

function splitSetItemFromStoredName(which, storedName) {
  const el = which === 'a' ? splitItemA : splitItemB;
  if (!el) return;

  const img = el.querySelector('img.split-img');
  if (!img) return;

  const item = splitState.history.find(x => x && x.storedName === storedName);
  if (!item) {
    el.hidden = true;
    return;
  }

  const url = splitGetOriginalUrl(item);
  if (!url) {
    el.hidden = true;
    return;
  }

  const st = which === 'a' ? splitState.a : splitState.b;
  st.storedName = item.storedName;
  st.url = url;

  el.hidden = false;
  splitBringToFront(which);

  img.onload = () => {
    st.natW = img.naturalWidth || 0;
    st.natH = img.naturalHeight || 0;
    // if it was not laid out yet, do a default layout pass
    splitLayoutDefaults();
  };

  img.onerror = () => {
    if (splitHint) splitHint.textContent = 'Не удалось загрузить 1280-картинку для Split.';
  };

  img.src = url;
  img.alt = item.originalName || item.storedName || '';
}

async function openSplitModal() {
  if (!splitModal) return;

  splitModal.hidden = false;
  splitState.open = true;
  splitState.pickTarget = 'a';

  if (splitPickTargetA) splitPickTargetA.classList.add('is-active');
  if (splitPickTargetB) splitPickTargetB.classList.remove('is-active');

  if (splitHint) {
    splitHint.textContent = 'Загружаю список...';
  }

  splitState.history = await fetchHistoryRaw();
  // allow any uploaded image (no need to pre-generate resized)
  const candidates = splitState.history.filter(it => !!(it && it.originalRelativePath && it.imageWidth && it.imageHeight));

  // build gallery
  if (splitGallery) {
    splitGallery.textContent = '';

    for (const it of candidates) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'split-thumb';
      btn.dataset.sn = it.storedName;
      btn.title = it.originalName || it.storedName || '';

      const img = document.createElement('img');
      img.alt = it.originalName || it.storedName || '';
      img.loading = 'lazy';
      img.src = splitGetPreviewUrl(it) || '';

      btn.appendChild(img);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const which = splitState.pickTarget || 'a';
        splitSetItemFromStoredName(which, it.storedName);
        splitUpdateTargetThumb(which);
        splitSyncGallerySelection();
      });

      splitGallery.appendChild(btn);
    }
  }

  // default picks: prefer current active image for slot #1
  const preferredA = (lastUpload && lastUpload.storedName && candidates.some(x => x && x.storedName === lastUpload.storedName))
    ? lastUpload.storedName
    : (candidates[0] && candidates[0].storedName);

  const first = preferredA;
  const second = candidates.find(x => x && x.storedName !== first) && candidates.find(x => x && x.storedName !== first).storedName;

  if (splitItemA) splitItemA.hidden = true;
  if (splitItemB) splitItemB.hidden = true;

  if (first) {
    splitSetItemFromStoredName('a', first);
    splitUpdateTargetThumb('a');
  }
  if (second || first) {
    splitSetItemFromStoredName('b', second || first);
    splitUpdateTargetThumb('b');
  }

  splitSyncGallerySelection();

  if (splitHint) {
    splitHint.textContent = candidates.length > 0
      ? 'Выберите слот (#1/#2), затем кликните по превью. Дальше перетаскивайте/масштабируйте.'
      : 'Нет загруженных изображений.';
  }

  if (splitApplyBtn) {
    splitApplyBtn.disabled = candidates.length === 0;
  }
}

function closeSplitModal() {
  if (!splitModal) return;
  splitModal.hidden = true;
  splitState.open = false;
  splitState.action = null;

  if (splitItemA) splitItemA.hidden = true;
  if (splitItemB) splitItemB.hidden = true;

  if (splitGallery) {
    splitGallery.textContent = '';
  }

  if (splitTargetImgA) splitTargetImgA.removeAttribute('src');
  if (splitTargetImgB) splitTargetImgB.removeAttribute('src');

  // stop image loading
  if (splitItemA) {
    const img = splitItemA.querySelector('img.split-img');
    if (img) img.removeAttribute('src');
  }
  if (splitItemB) {
    const img = splitItemB.querySelector('img.split-img');
    if (img) img.removeAttribute('src');
  }
}

async function applySplit() {
  if (!splitState.open) return;

  const a = splitState.a;
  const b = splitState.b;

  if (!a || !a.storedName || !b || !b.storedName) {
    if (splitHint) splitHint.textContent = t('splitChooseTwo');
    return;
  }

  const halfA = splitGetHalfSize('a');
  const halfB = splitGetHalfSize('b');

  if (!halfA.w || !halfA.h || !halfB.w || !halfB.h) {
    if (splitHint) splitHint.textContent = 'Не удалось определить размер поля.';
    return;
  }

  const req = {
    storedNameA: a.storedName,
    storedNameB: b.storedName,
    a: { x: a.x, y: a.y, w: a.w, h: a.h, viewW: halfA.w, viewH: halfA.h },
    b: { x: b.x, y: b.y, w: b.w, h: b.h, viewW: halfB.w, viewH: halfB.h }
  };

  try {
    if (splitApplyBtn) splitApplyBtn.disabled = true;
    setBusy(true);
    if (splitHint) splitHint.textContent = t('splitWorking');

    const res = await fetch(toAbsoluteUrl('split'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      if (splitHint) splitHint.textContent = t('splitError');
      showResult(data);
      return;
    }

    showResult(data);

    // Split output is independent, but sources may change; still bump cache for involved sources.
    cacheBust.set(a.storedName, Date.now());
    cacheBust.set(b.storedName, Date.now());

    await loadComposites();

    hint.textContent = t('splitCreated');
    closeSplitModal();
  } catch (e) {
    if (splitHint) splitHint.textContent = t('splitError');
    showResult(String(e));
  } finally {
    setBusy(false);
    if (splitApplyBtn) splitApplyBtn.disabled = false;
  }
}

function wireSplitUI() {
  if (!splitModal || !splitStage || !splitHalfLeft || !splitHalfRight) return;

  // open button
  if (splitToolBtn) {
    splitToolBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSplitModal();
    });
  }

  // close controls
  const close = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeSplitModal();
  };

  if (splitCloseBtn) splitCloseBtn.addEventListener('click', close);
  if (splitCancelBtn) splitCancelBtn.addEventListener('click', close);

  // backdrop click
  splitModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeSplitModal();
    }
  });

  // picking target (#1/#2)
  const setPickTarget = (which) => {
    splitState.pickTarget = which;
    if (splitPickTargetA) splitPickTargetA.classList.toggle('is-active', which === 'a');
    if (splitPickTargetB) splitPickTargetB.classList.toggle('is-active', which === 'b');
  };

  if (splitPickTargetA) {
    splitPickTargetA.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPickTarget('a');
    });
  }
  if (splitPickTargetB) {
    splitPickTargetB.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setPickTarget('b');
    });
  }

  // drag/resize on items
  const wireItem = (which, el) => {
    if (!el) return;

    el.addEventListener('pointerdown', (e) => {
      if (!splitState.open) return;

      const t = e.target;
      let handle = t && t.dataset ? t.dataset.h : null;
      const p = splitGetPointerPosInHalf(which, e);

      const st = which === 'a' ? splitState.a : splitState.b;
      if (!st || !st.url) return;

      splitBringToFront(which);

      // If user starts interacting, set active pick target too (convenience).
      splitState.pickTarget = which;
      if (splitPickTargetA) splitPickTargetA.classList.toggle('is-active', which === 'a');
      if (splitPickTargetB) splitPickTargetB.classList.toggle('is-active', which === 'b');

      // If not on a handle element - allow resize by grabbing ANY point near the edges.
      if (!handle) {
        const localX = p.x - st.x;
        const localY = p.y - st.y;
        handle = detectEdgeHandle(localX, localY, st.w, st.h, 12).handle;
      }

      if (handle) {
        splitState.action = {
          type: 'resize',
          which,
          handle,
          startX: p.x,
          startY: p.y,
          startRect: { x: st.x, y: st.y, w: st.w, h: st.h }
        };
      } else {
        splitState.action = {
          type: 'move',
          which,
          offsetX: p.x - st.x,
          offsetY: p.y - st.y
        };
      }

      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });

    el.addEventListener('pointermove', (e) => {
      if (!splitState.open) return;

      const st = which === 'a' ? splitState.a : splitState.b;
      if (!st || !st.url) return;

      const p = splitGetPointerPosInHalf(which, e);

      // Idle: update cursor so user can grab edges anywhere.
      if (!splitState.action) {
        const t = e.target;
        const hFromEl = t && t.dataset ? t.dataset.h : null;
        if (hFromEl) {
          el.style.cursor = cursorForHandle(hFromEl);
        } else {
          const localX = p.x - st.x;
          const localY = p.y - st.y;
          el.style.cursor = detectEdgeHandle(localX, localY, st.w, st.h, 12).cursor;
        }
        return;
      }

      if (splitState.action.which !== which) return;

      const { w: halfW, h: halfH } = splitGetHalfSize(which);
      if (!halfW || !halfH) return;

      if (splitState.action.type === 'move') {
        st.x = p.x - splitState.action.offsetX;
        st.y = p.y - splitState.action.offsetY;
        splitClampMove(which, st, halfW, halfH);
        splitShowItem(which);
        return;
      }

      // resize (proportional), with anchors depending on handle
      const dx = p.x - splitState.action.startX;
      const dy = p.y - splitState.action.startY;

      const aspect = st.natW && st.natH ? (st.natW / st.natH) : 1;
      const sr = splitState.action.startRect;
      const h = String(splitState.action.handle || 'br');

      // Compute width delta based on handle direction.
      const dwX = (h.includes('l') ? -dx : dx);
      const dwY = (h.includes('t') ? -dy : dy) * aspect;

      let dw;
      if (h === 'l' || h === 'r') {
        dw = dwX;
      } else if (h === 't' || h === 'b') {
        dw = dwY;
      } else {
        // corners: pick the dominant movement
        dw = Math.abs(dwX) >= Math.abs(dwY) ? dwX : dwY;
      }

      const minW = 60;
      const maxWHard = 20000;
      const newW = Math.max(minW, Math.min(sr.w + dw, maxWHard));
      const newH = newW / aspect;

      // Anchor: opposite side stays in place.
      let newX = sr.x;
      let newY = sr.y;
      if (h.includes('l')) {
        newX = sr.x + (sr.w - newW);
      }
      if (h.includes('t')) {
        newY = sr.y + (sr.h - newH);
      }

      st.x = newX;
      st.y = newY;
      st.w = newW;
      st.h = newH;

      splitClampMove(which, st, halfW, halfH);
      splitShowItem(which);
    });

    const end = (e) => {
      if (!splitState.action || splitState.action.which !== which) return;
      splitState.action = null;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  wireItem('a', splitItemA);
  wireItem('b', splitItemB);

  // Zoom по колёсику мыши в Split (увеличивает/уменьшает картинку под курсором)
  splitStage.addEventListener('wheel', (e) => {
    if (!splitState.open) return;

    // определяем, над какой половиной находимся
    const stageRect = splitStage.getBoundingClientRect();
    const midX = stageRect.left + stageRect.width / 2;
    const which = e.clientX < midX ? 'a' : 'b';
    const st = which === 'a' ? splitState.a : splitState.b;
    if (!st || !st.url) return;

    const { w: halfW, h: halfH } = splitGetHalfSize(which);
    if (!halfW || !halfH) return;

    const halfRect = which === 'a' ? splitHalfLeft.getBoundingClientRect() : splitHalfRight.getBoundingClientRect();
    const px = e.clientX - halfRect.left;
    const py = e.clientY - halfRect.top;

    // позиция курсора внутри самой картинки
    const imgPx = px - st.x;
    const imgPy = py - st.y;

    e.preventDefault();

    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    const minW = 60;
    const maxWHard = 20000;

    const newW = Math.max(minW, Math.min(st.w * factor, maxWHard));
    const aspect = st.natW && st.natH ? (st.natW / st.natH) : (st.w && st.h ? st.w / st.h : 1);
    const newH = newW / aspect;

    // Чтобы курсор "смотрел" на ту же точку картинки после зума
    const relX = imgPx / st.w;
    const relY = imgPy / st.h;

    let newX = px - relX * newW;
    let newY = py - relY * newH;

    st.x = newX;
    st.y = newY;
    st.w = newW;
    st.h = newH;

    splitClampMove(which, st, halfW, halfH);
    splitShowItem(which);
  });

  // apply
  if (splitApplyBtn) {
    splitApplyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applySplit();
    });
  }

  window.addEventListener('resize', () => {
    if (!splitState.open) return;
    splitLayoutDefaults();
  });
}

