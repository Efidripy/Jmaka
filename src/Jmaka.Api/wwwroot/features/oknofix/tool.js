// OknoFix state: одно окно фиксированного шаблона под PNG-оверлеем
const oknoFixState = {
  open: false,
  mode: 'fix', // фиксированный шаблон
  storedName: null,
  url: null,
  natW: 0,
  natH: 0,
  window: { y: 0, w: 0, h: 0 },
  img: { x: 0, y: 0, w: 0, h: 0 },
  action: null // { type: 'img-move' | 'img-scale', ... }
};

// OknoScale: отдельное состояние, независимое от OknoFix
const oknoScaleState = {
  open: false,
  storedName: null,
  url: null,
  natW: 0,
  natH: 0,
  window: { y: 0, w: 0, h: 0 },
  img: { x: 0, y: 0, w: 0, h: 0 },
  action: null // { type: 'window-resize' | 'img-move' | 'img-scale', ... }
};

const imageEditState = {
  open: false,
  storedName: null,
  previewUrl: null,
  pending: null
};

function split3RememberViewSize(which, viewW, viewH) {
  const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
  if (!st) return;
  st.viewW = viewW;
  st.viewH = viewH;
}

function split3GetRememberedViewSize(st, which) {
  if (st && Number.isFinite(st.viewW) && Number.isFinite(st.viewH) && st.viewW > 0 && st.viewH > 0) {
    return { w: st.viewW, h: st.viewH };
  }
  return split3GetPanelSize(which);
}

function split3ShowItem(which) {
  const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
  const el = which === 'a' ? split3ItemA : (which === 'b' ? split3ItemB : split3ItemC);
  if (!el) return;
  el.style.left = `${st.x}px`;
  el.style.top = `${st.y}px`;
  el.style.width = `${st.w}px`;
  el.style.height = `${st.h}px`;
}

function split3ClampMove(which, st, w, h) {
  const minVisible = 24;
  const minX = -st.w + minVisible;
  const maxX = w - minVisible;
  const minY = -st.h + minVisible;
  const maxY = h - minVisible;
  st.x = Math.min(Math.max(st.x, minX), maxX);
  st.y = Math.min(Math.max(st.y, minY), maxY);
}

function split3LayoutDefaults() {
  for (const which of ['a', 'b', 'c']) {
    split3LayoutDefaultFor(which);
  }
}

function split3LayoutDefaultFor(which) {
  const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
  if (!st.url || !st.natW || !st.natH) return;

  const { w: panelW, h: panelH } = split3GetPanelSize(which);
  if (!panelW || !panelH) return;

  const aspect = st.natW / st.natH;
  const targetW = panelW * 1.15;
  st.w = targetW;
  st.h = st.w / aspect;

  if (st.h > panelH * 0.9) {
    st.h = panelH * 0.9;
    st.w = st.h * aspect;
  }

  st.x = (panelW - st.w) / 2;
  st.y = (panelH - st.h) / 2;

  split3ClampMove(which, st, panelW, panelH);
  split3RememberViewSize(which, panelW, panelH);
  split3ShowItem(which);
}

function split3ReflowOnResize() {
  for (const which of ['a', 'b', 'c']) {
    const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
    if (!st.url || !st.natW || !st.natH) continue;

    const { w: panelW, h: panelH } = split3GetPanelSize(which);
    if (!panelW || !panelH) continue;

    const prev = split3GetRememberedViewSize(st, which);
    if (!prev.w || !prev.h || !st.w || !st.h) {
      split3LayoutDefaultFor(which);
      continue;
    }

    const sx = panelW / prev.w;
    const sy = panelH / prev.h;
    st.x *= sx;
    st.y *= sy;
    st.w *= sx;
    st.h *= sy;
    split3ClampMove(which, st, panelW, panelH);
    split3RememberViewSize(which, panelW, panelH);
    split3ShowItem(which);
  }
}

function split3UpdateTargetThumb(which) {
  const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
  const img = which === 'a' ? split3TargetImgA : (which === 'b' ? split3TargetImgB : split3TargetImgC);
  if (!img) return;

  if (!st || !st.storedName) {
    img.removeAttribute('src');
    img.alt = '';
    return;
  }

  const item = split3State.history.find(x => x && x.storedName === st.storedName);
  const src = item ? splitGetPreviewUrl(item) : null;
  if (!src) {
    img.removeAttribute('src');
    img.alt = '';
    return;
  }

  img.src = src;
  img.alt = item.originalName || item.storedName || '';
}

function split3SyncGallerySelection() {
  if (!split3Gallery) return;
  const a = split3State.a && split3State.a.storedName;
  const b = split3State.b && split3State.b.storedName;
  const c = split3State.c && split3State.c.storedName;

  for (const btn of Array.from(split3Gallery.querySelectorAll('button.split-thumb'))) {
    const sn = btn.dataset && btn.dataset.sn ? btn.dataset.sn : '';
    btn.classList.toggle('is-selected', sn && (sn === a || sn === b || sn === c));
  }
}

function split3SetItemFromStoredName(which, storedName) {
  const el = which === 'a' ? split3ItemA : (which === 'b' ? split3ItemB : split3ItemC);
  if (!el) return;

  const img = el.querySelector('img.split-img');
  if (!img) return;

  const item = split3State.history.find(x => x && x.storedName === storedName);
  if (!item) {
    el.hidden = true;
    return;
  }

  const url = splitGetOriginalUrl(item);
  if (!url) {
    el.hidden = true;
    return;
  }

  const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
  st.storedName = item.storedName;
  st.url = url;

  el.hidden = false;
  split3BringToFront(which);

  img.onload = () => {
    st.natW = img.naturalWidth || 0;
    st.natH = img.naturalHeight || 0;
    // Replacing one slot should not reset neighboring slot transforms.
    split3LayoutDefaultFor(which);
  };

  img.onerror = () => {
    if (split3Hint) split3Hint.textContent = t('Не удалось загрузить картинку для Split3.');
  };

  img.src = url;
  img.alt = item.originalName || item.storedName || '';
}

async function openSplit3Modal() {
  if (!split3Modal) return;

  split3Modal.hidden = false;
  split3State.open = true;
  split3State.pickTarget = 'a';

  if (split3PickTargetA) split3PickTargetA.classList.add('is-active');
  if (split3PickTargetB) split3PickTargetB.classList.remove('is-active');
  if (split3PickTargetC) split3PickTargetC.classList.remove('is-active');

  if (split3Hint) split3Hint.textContent = t('Загружаю список...');

  split3State.history = await fetchHistoryRaw();
  const candidates = split3State.history.filter(it => !!(it && it.originalRelativePath && it.imageWidth && it.imageHeight));

  if (split3Gallery) {
    split3Gallery.textContent = '';

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
        const which = split3State.pickTarget || 'a';
        split3SetItemFromStoredName(which, it.storedName);
        split3UpdateTargetThumb(which);
        split3SyncGallerySelection();
      });

      split3Gallery.appendChild(btn);
    }
  }

  const preferredA = (lastUpload && lastUpload.storedName && candidates.some(x => x && x.storedName === lastUpload.storedName))
    ? lastUpload.storedName
    : (candidates[0] && candidates[0].storedName);

  const first = preferredA;
  const second = candidates.find(x => x && x.storedName !== first) && candidates.find(x => x && x.storedName !== first).storedName;
  const third = candidates.find(x => x && x.storedName !== first && x.storedName !== second)
    && candidates.find(x => x && x.storedName !== first && x.storedName !== second).storedName;

  if (split3ItemA) split3ItemA.hidden = true;
  if (split3ItemB) split3ItemB.hidden = true;
  if (split3ItemC) split3ItemC.hidden = true;

  if (first) {
    split3SetItemFromStoredName('a', first);
    split3UpdateTargetThumb('a');
  }
  if (second || first) {
    split3SetItemFromStoredName('b', second || first);
    split3UpdateTargetThumb('b');
  }
  if (third || second || first) {
    split3SetItemFromStoredName('c', third || second || first);
    split3UpdateTargetThumb('c');
  }

  split3SyncGallerySelection();

  if (split3Hint) {
    split3Hint.textContent = candidates.length > 0
      ? t('Выберите слот (#1/#2/#3), затем кликните по превью. Дальше перетаскивайте/масштабируйте.')
      : t('Нет загруженных изображений.');
  }

  if (split3ApplyBtn) {
    split3ApplyBtn.disabled = candidates.length === 0;
  }
}

function closeSplit3Modal() {
  if (!split3Modal) return;
  split3Modal.hidden = true;
  split3State.open = false;
  split3State.action = null;

  if (split3ItemA) split3ItemA.hidden = true;
  if (split3ItemB) split3ItemB.hidden = true;
  if (split3ItemC) split3ItemC.hidden = true;

  if (split3Gallery) split3Gallery.textContent = '';

  if (split3TargetImgA) split3TargetImgA.removeAttribute('src');
  if (split3TargetImgB) split3TargetImgB.removeAttribute('src');
  if (split3TargetImgC) split3TargetImgC.removeAttribute('src');

  // stop image loading
  for (const el of [split3ItemA, split3ItemB, split3ItemC]) {
    if (!el) continue;
    const img = el.querySelector('img.split-img');
    if (img) img.removeAttribute('src');
  }
}

async function applySplit3() {
  if (!split3State.open) return;

  const a = split3State.a;
  const b = split3State.b;
  const c = split3State.c;

  if (!a || !a.storedName || !b || !b.storedName || !c || !c.storedName) {
    if (split3Hint) split3Hint.textContent = t('Выберите три картинки.');
    return;
  }

  const panelA = split3GetPanelSize('a');
  const panelB = split3GetPanelSize('b');
  const panelC = split3GetPanelSize('c');

  if (!panelA.w || !panelA.h || !panelB.w || !panelB.h || !panelC.w || !panelC.h) {
    if (split3Hint) split3Hint.textContent = t('Не удалось определить размер поля.');
    return;
  }

  const req = {
    storedNameA: a.storedName,
    storedNameB: b.storedName,
    storedNameC: c.storedName,
    a: { x: a.x, y: a.y, w: a.w, h: a.h, viewW: panelA.w, viewH: panelA.h },
    b: { x: b.x, y: b.y, w: b.w, h: b.h, viewW: panelB.w, viewH: panelB.h },
    c: { x: c.x, y: c.y, w: c.w, h: c.h, viewW: panelC.w, viewH: panelC.h }
  };

  try {
    if (split3ApplyBtn) split3ApplyBtn.disabled = true;
    setBusy(true);
    if (split3Hint) split3Hint.textContent = t('Склеиваю...');

    const res = await fetch(toAbsoluteUrl('split3'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      if (split3Hint) split3Hint.textContent = t('Ошибка split3.');
      showResult(data);
      return;
    }

    showResult(data);

    // Split3 output is independent, but sources may change; still bump cache for involved sources.
    cacheBust.set(a.storedName, Date.now());
    cacheBust.set(b.storedName, Date.now());
    cacheBust.set(c.storedName, Date.now());
    await loadComposites();

    hint.textContent = t('Split3 создан.');
    closeSplit3Modal();
  } catch (e) {
    if (split3Hint) split3Hint.textContent = t('Ошибка split3.');
    showResult(String(e));
  } finally {
    setBusy(false);
    if (split3ApplyBtn) split3ApplyBtn.disabled = false;
  }
}

function wireSplit3UI() {
  if (!split3Modal || !split3Stage || !split3ThirdA || !split3ThirdB || !split3ThirdC) return;

  if (split3ToolBtn) {
    split3ToolBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSplit3Modal();
    });
  }

  const close = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeSplit3Modal();
  };

  if (split3CloseBtn) split3CloseBtn.addEventListener('click', close);
  if (split3CancelBtn) split3CancelBtn.addEventListener('click', close);

  split3Modal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeSplit3Modal();
    }
  });

  const setPickTarget = (which) => {
    split3State.pickTarget = which;
    if (split3PickTargetA) split3PickTargetA.classList.toggle('is-active', which === 'a');
    if (split3PickTargetB) split3PickTargetB.classList.toggle('is-active', which === 'b');
    if (split3PickTargetC) split3PickTargetC.classList.toggle('is-active', which === 'c');
  };

  if (split3PickTargetA) split3PickTargetA.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setPickTarget('a'); });
  if (split3PickTargetB) split3PickTargetB.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setPickTarget('b'); });
  if (split3PickTargetC) split3PickTargetC.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setPickTarget('c'); });

  const wireItem = (which, el) => {
    if (!el) return;

    el.addEventListener('pointerdown', (e) => {
      if (!split3State.open) return;

      const t = e.target;
      let handle = t && t.dataset ? t.dataset.h : null;
      const p = split3GetPointerPosInPanel(which, e);

      const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
      if (!st || !st.url) return;

      split3BringToFront(which);
      split3State.pickTarget = which;
      if (split3PickTargetA) split3PickTargetA.classList.toggle('is-active', which === 'a');
      if (split3PickTargetB) split3PickTargetB.classList.toggle('is-active', which === 'b');
      if (split3PickTargetC) split3PickTargetC.classList.toggle('is-active', which === 'c');

      // If not on a handle element - allow resize by grabbing ANY point near the edges.
      if (!handle) {
        const localX = p.x - st.x;
        const localY = p.y - st.y;
        handle = detectEdgeHandle(localX, localY, st.w, st.h, 12).handle;
      }

      if (handle) {
        split3State.action = {
          type: 'resize',
          which,
          handle,
          startX: p.x,
          startY: p.y,
          startRect: { x: st.x, y: st.y, w: st.w, h: st.h }
        };
      } else {
        split3State.action = {
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
      if (!split3State.open) return;

      const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
      if (!st || !st.url) return;

      const p = split3GetPointerPosInPanel(which, e);

      // Idle: update cursor so user can grab edges anywhere.
      if (!split3State.action) {
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

      if (split3State.action.which !== which) return;

      const { w: panelW, h: panelH } = split3GetPanelSize(which);
      if (!panelW || !panelH) return;

      if (split3State.action.type === 'move') {
        st.x = p.x - split3State.action.offsetX;
        st.y = p.y - split3State.action.offsetY;
        split3ClampMove(which, st, panelW, panelH);
        split3RememberViewSize(which, panelW, panelH);
        split3ShowItem(which);
        return;
      }

      const dx = p.x - split3State.action.startX;
      const dy = p.y - split3State.action.startY;

      const aspect = st.natW && st.natH ? (st.natW / st.natH) : 1;
      const sr = split3State.action.startRect;
      const h = String(split3State.action.handle || 'br');

      const dwX = (h.includes('l') ? -dx : dx);
      const dwY = (h.includes('t') ? -dy : dy) * aspect;

      let dw;
      if (h === 'l' || h === 'r') {
        dw = dwX;
      } else if (h === 't' || h === 'b') {
        dw = dwY;
      } else {
        dw = Math.abs(dwX) >= Math.abs(dwY) ? dwX : dwY;
      }

      const minW = 60;
      const maxWHard = 20000;
      const newW = Math.max(minW, Math.min(sr.w + dw, maxWHard));
      const newH = newW / aspect;

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

      split3ClampMove(which, st, panelW, panelH);
      split3RememberViewSize(which, panelW, panelH);
      split3ShowItem(which);
    });

    const end = (e) => {
      if (!split3State.action || split3State.action.which !== which) return;
      split3State.action = null;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  wireItem('a', split3ItemA);
  wireItem('b', split3ItemB);
  wireItem('c', split3ItemC);

  // Zoom по колёсику мыши в Split3 (увеличивает/уменьшает картинку под курсором)
  split3Stage.addEventListener('wheel', (e) => {
    if (!split3State.open) return;

    // выясняем, над какой третью сейчас курсор
    const stageRect = split3Stage.getBoundingClientRect();
    const thirdA = getSplit3PanelRect('a');
    const thirdB = getSplit3PanelRect('b');
    const thirdC = getSplit3PanelRect('c');

    let which;
    if (thirdA && e.clientX >= thirdA.left && e.clientX <= thirdA.right) which = 'a';
    else if (thirdB && e.clientX >= thirdB.left && e.clientX <= thirdB.right) which = 'b';
    else which = 'c';

    const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
    if (!st || !st.url) return;

    const { w: panelW, h: panelH } = split3GetPanelSize(which);
    if (!panelW || !panelH) return;

    const panelRect = which === 'a' ? thirdA : (which === 'b' ? thirdB : thirdC);
    if (!panelRect) return;

    const px = e.clientX - panelRect.left;
    const py = e.clientY - panelRect.top;

    const imgPx = px - st.x;
    const imgPy = py - st.y;

    e.preventDefault();

    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    const minW = 60;
    const maxWHard = 20000;

    const newW = Math.max(minW, Math.min(st.w * factor, maxWHard));
    const aspect = st.natW && st.natH ? (st.natW / st.natH) : (st.w && st.h ? st.w / st.h : 1);
    const newH = newW / aspect;

    const relX = imgPx / st.w;
    const relY = imgPy / st.h;

    let newX = px - relX * newW;
    let newY = py - relY * newH;

    st.x = newX;
    st.y = newY;
    st.w = newW;
    st.h = newH;

    split3ClampMove(which, st, panelW, panelH);
    split3RememberViewSize(which, panelW, panelH);
    split3ShowItem(which);
  });

  if (split3ApplyBtn) {
    split3ApplyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applySplit3();
    });
  }

  window.addEventListener('resize', () => {
    if (!split3State.open) return;
    split3ReflowOnResize();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireSplit3UI, { once: true });
} else {
  wireSplit3UI();
}
