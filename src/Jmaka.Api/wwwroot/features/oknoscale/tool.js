// ----- OknoScale geometry helpers -----

function getPointerPosInOknoScaleStage(e) {
  if (!oknoScaleStage) return { x: 0, y: 0 };
  const r = oknoScaleStage.getBoundingClientRect();
  return {
    x: e.clientX - r.left,
    y: e.clientY - r.top
  };
}

const OKNOSCALE_ASPECT = 16 / 9; // базовое соотношение карточки

function layoutOknoScaleWindowInitial() {
  if (!oknoScaleStage || !oknoScaleCard) return;
  const stageRect = oknoScaleStage.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return;

  const maxH = stageRect.height * 0.8;
  let h = maxH;
  let w = h * OKNOSCALE_ASPECT * 0.7; // стартовое окно немного уже, чем 16:9
  const maxW = stageRect.width * 0.9;
  if (w > maxW) {
    w = maxW;
    h = w / (OKNOSCALE_ASPECT * 0.7);
  }

  const y = (stageRect.height - h) / 2;

  oknoScaleState.window.y = y;
  oknoScaleState.window.h = h;
  oknoScaleState.window.w = w;

  updateOknoScaleWindowLayout();
}

function updateOknoScaleWindowLayout() {
  if (!oknoScaleStage || !oknoScaleCard) return;
  const stageRect = oknoScaleStage.getBoundingClientRect();
  if (!stageRect.width) return;

  const h = oknoScaleState.window.h;
  const w = oknoScaleState.window.w;
  const left = (stageRect.width - w) / 2;
  const top = oknoScaleState.window.y;

  oknoScaleCard.style.width = `${w}px`;
  oknoScaleCard.style.height = `${h}px`;
  oknoScaleCard.style.left = `${left}px`;
  oknoScaleCard.style.top = `${top}px`;
}

function getOknoScaleWindowRectInCard() {
  if (!oknoScaleCard) return { x: 0, y: 0, w: 0, h: 0 };
  const cardRect = oknoScaleCard.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) return { x: 0, y: 0, w: 0, h: 0 };
  // Для OknoScale окном считаем всю карточку.
  return { x: 0, y: 0, w: cardRect.width, h: cardRect.height };
}

function layoutOknoScaleImageCover() {
  if (!oknoScaleCard || !oknoScaleImg || !oknoScaleState.natW || !oknoScaleState.natH) return;
  const win = getOknoScaleWindowRectInCard();
  const winW = win.w;
  const winH = win.h;
  if (!winW || !winH) return;

  const scale = winH / oknoScaleState.natH;
  const w = oknoScaleState.natW * scale;
  const h = winH;

  const centerX = win.x + winW / 2;
  const centerY = win.y + winH / 2;
  const x0 = centerX - w / 2;
  const y0 = centerY - h / 2;

  const clamped = clampImageToWindow({ x: x0, y: y0, w, h }, win);
  oknoScaleState.img = clamped;

  oknoScaleImg.style.width = `${clamped.w}px`;
  oknoScaleImg.style.height = `${clamped.h}px`;
  oknoScaleImg.style.left = `${clamped.x}px`;
  oknoScaleImg.style.top = `${clamped.y}px`;
}

function openOknoScaleModal() {
  if (!oknoScaleModal || !oknoScaleStage || !oknoScaleCard || !oknoScaleImgViewport || !oknoScaleImg) return;

  if (!lastUpload || !lastUpload.storedName || !lastUpload.originalRelativePath) {
    if (oknoScaleHint) {
      oknoScaleHint.textContent = 'Сначала выберите строку в таблице файлов.';
    }
    return;
  }

  oknoScaleState.open = true;
  oknoScaleState.storedName = lastUpload.storedName;
  // Для OknoScale в превью всегда используем исходник upload-original/<storedName>,
  // а не обрезанный upload/*.
  const rel = `upload-original/${lastUpload.storedName}`;
  oknoScaleState.url = withCacheBust(rel, lastUpload.storedName);

  oknoScaleModal.hidden = false;
  if (oknoScaleApplyBtn) oknoScaleApplyBtn.disabled = true;

  if (oknoScaleHint) {
    oknoScaleHint.textContent = 'Двигайте и масштабируйте картинку под окном. Ширину окна можно менять ручками слева/справа.';
  }

  layoutOknoScaleWindowInitial();

  oknoScaleImg.onload = () => {
    oknoScaleState.natW = oknoScaleImg.naturalWidth || 0;
    oknoScaleState.natH = oknoScaleImg.naturalHeight || 0;
    layoutOknoScaleImageCover();
    if (oknoScaleApplyBtn) oknoScaleApplyBtn.disabled = false;
  };

  oknoScaleImg.src = oknoScaleState.url;
  oknoScaleImg.alt = lastUpload.originalName || lastUpload.storedName || '';
}

function closeOknoScaleModal() {
  if (!oknoScaleModal) return;
  oknoScaleModal.hidden = true;
  oknoScaleState.open = false;
  oknoScaleState.action = null;
  if (oknoScaleImg) {
    oknoScaleImg.removeAttribute('src');
    oknoScaleImg.alt = '';
  }
}

function wireOknoScaleUI() {
  if (!oknoScaleModal || !oknoScaleStage || !oknoScaleCard) return;

  // Кнопка инструмента OknoScale
  if (oknoScaleToolBtn) {
    oknoScaleToolBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openOknoScaleModal();
    });
  }

  const oknoScaleZoomByFactor = (factor) => {
    if (!oknoScaleState.open || !oknoScaleCard || !oknoScaleImg || !oknoScaleState.img) return;
    const rect = oknoScaleCard.getBoundingClientRect();
    const win = getOknoScaleWindowRectInCard();
    const winW = win.w;
    const winH = win.h;
    if (!winW || !winH) return;

    const img0 = oknoScaleState.img;
    let f = factor;
    f = Math.max(0.2, Math.min(5, f));

    let w = img0.w * f;
    let h = img0.h * f;

    const minScale = winH / img0.h;
    if (f < minScale) {
      w = img0.w * minScale;
      h = img0.h * minScale;
    }

    const centerX = rect.left + win.x + winW / 2;
    const centerY = rect.top + win.y + winH / 2;
    const cx = centerX - rect.left;
    const cy = centerY - rect.top;

    const x0 = cx - (w / img0.w) * (centerX - (rect.left + img0.x));
    const y0 = cy - (h / img0.h) * (centerY - (rect.top + img0.y));

    const img1 = clampImageToWindow({ x: x0, y: y0, w, h }, win);
    oknoScaleState.img = img1;
    oknoScaleImg.style.width = `${img1.w}px`;
    oknoScaleImg.style.height = `${img1.h}px`;
    oknoScaleImg.style.left = `${img1.x}px`;
    oknoScaleImg.style.top = `${img1.y}px`;
  };

  const close = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeOknoScaleModal();
  };

  if (oknoScaleCloseBtn) oknoScaleCloseBtn.addEventListener('click', close);
  if (oknoScaleCancelBtn) oknoScaleCancelBtn.addEventListener('click', close);

  oknoScaleModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeOknoScaleModal();
    }
  });

  if (oknoScaleZoomInBtn) {
    oknoScaleZoomInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      oknoScaleZoomByFactor(1.12);
    });
  }

  if (oknoScaleZoomOutBtn) {
    oknoScaleZoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      oknoScaleZoomByFactor(0.9);
    });
  }

  // Изменение ширины окна ручками (симметрично от центра)
  oknoScaleStage.addEventListener('pointerdown', (e) => {
    if (!oknoScaleState.open) return;
    const t = e.target;
    const side = t && t.dataset ? t.dataset.side : null;
    if (!side) return;

    oknoScaleState.action = {
      type: 'window-resize',
      side,
      startX: e.clientX,
      startW: oknoScaleState.window.w
    };

    try { oknoScaleStage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  });

  oknoScaleStage.addEventListener('pointermove', (e) => {
    if (!oknoScaleState.open || !oknoScaleState.action) return;
    const action = oknoScaleState.action;
    if (action.type !== 'window-resize') return;

    const stageRect = oknoScaleStage.getBoundingClientRect();
    if (!stageRect.width) return;

    const dx = e.clientX - action.startX;
    let dw = dx * 2;
    if (action.side === 'left') {
      dw = -dx * 2;
    }

    const minW = stageRect.width * 0.2;
    const maxW = stageRect.width * 0.95;
    let newW = action.startW + dw;
    if (newW < minW) newW = minW;
    if (newW > maxW) newW = maxW;

    oknoScaleState.window.w = newW;
    updateOknoScaleWindowLayout();
    layoutOknoScaleImageCover();
  });

  const endWindowResize = (e) => {
    if (!oknoScaleState.action || oknoScaleState.action.type !== 'window-resize') return;
    oknoScaleState.action = null;
    try { oknoScaleStage.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  oknoScaleStage.addEventListener('pointerup', endWindowResize);
  oknoScaleStage.addEventListener('pointercancel', endWindowResize);

  // Панорамирование/zoom изображения внутри окна
  if (oknoScaleImgViewport) {
    oknoScaleImgViewport.addEventListener('wheel', (e) => {
      if (!oknoScaleState.open) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      oknoScaleZoomByFactor(factor);
    });

    oknoScaleImgViewport.addEventListener('pointerdown', (e) => {
      if (!oknoScaleState.open) return;
      if (!oknoScaleCard) return;

      const rect = oknoScaleCard.getBoundingClientRect();
      const win = getOknoScaleWindowRectInCard();
      const winW = win.w;
      const winH = win.h;
      const cx = rect.left + win.x + winW / 2;
      const cy = rect.top + win.y + winH / 2;

      const img = oknoScaleState.img;
      const localX = e.clientX - (rect.left + img.x);
      const localY = e.clientY - (rect.top + img.y);
      const edgeInfo = detectEdgeHandle(localX, localY, img.w, img.h, 12);

      if (edgeInfo.handle) {
        oknoScaleState.action = {
          type: 'img-scale',
          handle: edgeInfo.handle,
          startPointerX: e.clientX,
          startPointerY: e.clientY,
          startImg: { ...img },
          centerX: cx,
          centerY: cy
        };
      } else {
        oknoScaleState.action = {
          type: 'img-move',
          startPointerX: e.clientX,
          startPointerY: e.clientY,
          startX: img.x,
          startY: img.y
        };
      }

      try { oknoScaleImgViewport.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });

    oknoScaleImgViewport.addEventListener('pointermove', (e) => {
      if (!oknoScaleState.open || !oknoScaleState.action) return;

      const action = oknoScaleState.action;

      if (action.type === 'img-move') {
        const dx = e.clientX - action.startPointerX;
        const dy = e.clientY - action.startPointerY;

        const win = getOknoScaleWindowRectInCard();
        const img0 = oknoScaleState.img;
        const tentative = {
          x: action.startX + dx,
          y: action.startY + dy,
          w: img0.w,
          h: img0.h
        };

        const img1 = clampImageToWindow(tentative, win);
        oknoScaleState.img = img1;
        oknoScaleImg.style.left = `${img1.x}px`;
        oknoScaleImg.style.top = `${img1.y}px`;
        return;
      }

      if (action.type === 'img-scale') {
        if (!oknoScaleCard) return;
        const rect = oknoScaleCard.getBoundingClientRect();
        const win = getOknoScaleWindowRectInCard();
        const winW = win.w;
        const winH = win.h;
        const img0 = action.startImg;

        const dx = e.clientX - action.startPointerX;
        const dy = e.clientY - action.startPointerY;

        let factor = 1 + (dy * -0.003);
        factor = Math.max(0.2, Math.min(5, factor));

        let w = img0.w * factor;
        let h = img0.h * factor;

        const minScale = winH / img0.h;
        if (factor < minScale) {
          w = img0.w * minScale;
          h = img0.h * minScale;
        }

        const cx = action.centerX - rect.left;
        const cy = action.centerY - rect.top;

        const x0 = cx - (w / img0.w) * (action.centerX - (rect.left + img0.x));
        const y0 = cy - (h / img0.h) * (action.centerY - (rect.top + img0.y));

        const img1 = clampImageToWindow({ x: x0, y: y0, w, h }, win);
        oknoScaleState.img = img1;
        oknoScaleImg.style.width = `${img1.w}px`;
        oknoScaleImg.style.height = `${img1.h}px`;
        oknoScaleImg.style.left = `${img1.x}px`;
        oknoScaleImg.style.top = `${img1.y}px`;
        return;
      }
    });

    const endImgMove = (e) => {
      if (!oknoScaleState.action || (oknoScaleState.action.type !== 'img-move' && oknoScaleState.action.type !== 'img-scale')) return;
      oknoScaleState.action = null;
      try { oknoScaleImgViewport.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    oknoScaleImgViewport.addEventListener('pointerup', endImgMove);
    oknoScaleImgViewport.addEventListener('pointercancel', endImgMove);
  }

  if (oknoScaleApplyBtn) {
    oknoScaleApplyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!oknoScaleState.open || !oknoScaleState.storedName) return;
      if (!oknoScaleCard) return;

      const win = getOknoScaleWindowRectInCard();
      const img = oknoScaleState.img;
      if (!img || !oknoScaleState.natW || !oknoScaleState.natH || !win.w || !win.h) return;

      const scale = img.w / oknoScaleState.natW;
      if (!scale || !isFinite(scale)) return;

      const cropX = (win.x - img.x) / scale;
      const cropY = (win.y - img.y) / scale;
      const cropW = win.w / scale;
      const cropH = win.h / scale;

      const req = {
        storedName: oknoScaleState.storedName,
        x: cropX,
        y: cropY,
        w: cropW,
        h: cropH
      };

      try {
        setBusy(true);
        if (oknoScaleHint) oknoScaleHint.textContent = 'Генерирую OknoScale...';

        const res = await fetch(toAbsoluteUrl('oknoscale'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req)
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }

        if (!res.ok) {
          if (oknoScaleHint) oknoScaleHint.textContent = t('oknoScaleError');
          showResult(data);
          return;
        }

        showResult(data);
        await loadComposites();
        if (oknoScaleHint) oknoScaleHint.textContent = t('oknoScaleCreated');
        closeOknoScaleModal();
      } catch (err) {
        if (oknoScaleHint) oknoScaleHint.textContent = t('oknoScaleError');
        showResult(String(err));
      } finally {
        setBusy(false);
      }
    });
  }

  window.addEventListener('resize', () => {
    if (!oknoScaleState.open) return;
    layoutOknoScaleWindowInitial();
    layoutOknoScaleImageCover();
  });
}

function getPointerPosInOknoFixStage(e) {
  if (!oknoFixStage) return { x: 0, y: 0 };
  const r = oknoFixStage.getBoundingClientRect();
  return {
    x: e.clientX - r.left,
    y: e.clientY - r.top
  };
}

const OKNOFIX_ASPECT = 16 / 9; // окно 1920x1080
const OKNOFIX_TEMPLATE_W = 1920;
const OKNOFIX_TEMPLATE_H = 1080;
const OKNOFIX_WINDOW_PX = { x: 593, y: 79, w: 735, h: 922 };

function getOknoFixWindowRectInCard() {
  if (!oknoFixCard) return { x: 0, y: 0, w: 0, h: 0 };
  const cardRect = oknoFixCard.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) return { x: 0, y: 0, w: 0, h: 0 };
  // Для OknoFix окно задаётся по шаблону PNG (фиксированный режим).
  // Вся карточка служит подложкой, а прозрачное окно берётся из OKNOFIX_WINDOW_PX.
  const sx = cardRect.width / OKNOFIX_TEMPLATE_W;
  const sy = cardRect.height / OKNOFIX_TEMPLATE_H;
  const k = (sx + sy) / 2;

  return {
    x: OKNOFIX_WINDOW_PX.x * k,
    y: OKNOFIX_WINDOW_PX.y * k,
    w: OKNOFIX_WINDOW_PX.w * k,
    h: OKNOFIX_WINDOW_PX.h * k
  };
}

function clampImageToWindow(img, win) {
  if (!win || !img) return img;

  const minX = win.x + win.w - img.w;
  const maxX = win.x;
  const minY = win.y + win.h - img.h;
  const maxY = win.y;

  let x = img.x;
  let y = img.y;

  if (minX <= maxX) {
    x = Math.min(maxX, Math.max(minX, x));
  } else {
    // Если картинка меньше окна (теоретически) — ставим по центру.
    x = (minX + maxX) / 2;
  }

  if (minY <= maxY) {
    y = Math.min(maxY, Math.max(minY, y));
  } else {
    y = (minY + maxY) / 2;
  }

  return { ...img, x, y };
}

function layoutOknoFixWindowInitial() {
  if (!oknoFixStage || !oknoFixCard) return;
  const stageRect = oknoFixStage.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return;

  const maxW = stageRect.width * 0.8;
  const maxH = stageRect.height * 0.8;
  // вписываем окно 16:9 в центр с небольшими отступами
  let w = maxW;
  let h = w / OKNOFIX_ASPECT;
  if (h > maxH) {
    h = maxH;
    w = h * OKNOFIX_ASPECT;
  }

  const y = (stageRect.height - h) / 2;

  oknoFixState.window.y = y;
  oknoFixState.window.h = h;
  oknoFixState.window.w = w;

  updateOknoFixWindowLayout();
}

function updateOknoFixWindowLayout() {
  if (!oknoFixStage || !oknoFixCard) return;
  const stageRect = oknoFixStage.getBoundingClientRect();
  if (!stageRect.width) return;
  const h = oknoFixState.window.h;
  const w = oknoFixState.window.w;
  const left = (stageRect.width - w) / 2;
  const top = oknoFixState.window.y;

  oknoFixCard.style.width = `${w}px`;
  oknoFixCard.style.height = `${h}px`;
  oknoFixCard.style.left = `${left}px`;
  oknoFixCard.style.top = `${top}px`;
}

function openOknoFixModal(mode) {
  if (!oknoFixModal || !oknoFixStage || !oknoFixCard || !oknoFixImgViewport || !oknoFixImg) return;

  if (!lastUpload || !lastUpload.storedName || !lastUpload.originalRelativePath) {
    if (oknoFixHint) {
      oknoFixHint.textContent = 'Сначала выберите строку в таблице файлов.';
    }
    return;
  }

  oknoFixState.open = true;
  oknoFixState.mode = mode === 'fix' ? 'fix' : 'experimental';
  oknoFixState.storedName = lastUpload.storedName;
  // Для OknoFix в рабочем поле тоже всегда показываем исходник upload-original/<storedName>.
  const rel = `upload-original/${lastUpload.storedName}`;
  oknoFixState.url = withCacheBust(rel, lastUpload.storedName);

  oknoFixModal.hidden = false;
  if (oknoFixApplyBtn) oknoFixApplyBtn.disabled = true;

  if (oknoFixHint) {
    oknoFixHint.textContent = 'Двигайте и масштабируйте картинку под окном.';
  }

  layoutOknoFixWindowInitial();

  oknoFixImg.onload = () => {
    oknoFixState.natW = oknoFixImg.naturalWidth || 0;
    oknoFixState.natH = oknoFixImg.naturalHeight || 0;
    layoutOknoFixImageCover();
    if (oknoFixApplyBtn) oknoFixApplyBtn.disabled = false;
  };

  oknoFixImg.src = oknoFixState.url;
  oknoFixImg.alt = lastUpload.originalName || lastUpload.storedName || '';
}

function layoutOknoFixImageCover() {
  if (!oknoFixCard || !oknoFixImg || !oknoFixState.natW || !oknoFixState.natH) return;
  const win = getOknoFixWindowRectInCard();
  const winW = win.w;
  const winH = win.h;
  if (!winW || !winH) return;

  // Вставляем пропорционально по высоте: высота окна = высота картинки.
  const scale = winH / oknoFixState.natH;
  const w = oknoFixState.natW * scale;
  const h = winH; // === oknoFixState.natH * scale

  const centerX = win.x + winW / 2;
  const centerY = win.y + winH / 2;
  const x0 = centerX - w / 2;
  const y0 = centerY - h / 2;

  const clamped = clampImageToWindow({ x: x0, y: y0, w, h }, win);
  oknoFixState.img = clamped;

  oknoFixImg.style.width = `${clamped.w}px`;
  oknoFixImg.style.height = `${clamped.h}px`;
  oknoFixImg.style.left = `${clamped.x}px`;
  oknoFixImg.style.top = `${clamped.y}px`;
}

function closeOknoFixModal() {
  if (!oknoFixModal) return;
  oknoFixModal.hidden = true;
  oknoFixState.open = false;
  oknoFixState.action = null;
  if (oknoFixImg) {
    oknoFixImg.removeAttribute('src');
    oknoFixImg.alt = '';
  }
}

function wireOknoFixUI() {
  if (!oknoFixModal || !oknoFixStage || !oknoFixCard) return;

  // Только OknoFix (фиксированный шаблон) живёт в этой модалке.
  if (oknoFixToolBtn) {
    oknoFixToolBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openOknoFixModal('fix');
    });
  }

  const oknoFixZoomByFactor = (factor) => {
    if (!oknoFixState.open || !oknoFixCard || !oknoFixImg || !oknoFixState.img) return;
    const rect = oknoFixCard.getBoundingClientRect();
    const win = getOknoFixWindowRectInCard();
    const winW = win.w;
    const winH = win.h;
    if (!winW || !winH) return;

    const img0 = oknoFixState.img;
    let f = factor;
    // ограничиваем общий множитель, чтобы не улетать слишком далеко
    f = Math.max(0.2, Math.min(5, f));

    let w = img0.w * f;
    let h = img0.h * f;

    // минимальный масштаб: высота картинки не меньше высоты окна
    const minScale = winH / img0.h;
    if (f < minScale) {
      w = img0.w * minScale;
      h = img0.h * minScale;
    }

    const centerX = rect.left + win.x + winW / 2;
    const centerY = rect.top + win.y + winH / 2;
    const cx = centerX - rect.left;
    const cy = centerY - rect.top;

    const x0 = cx - (w / img0.w) * (centerX - (rect.left + img0.x));
    const y0 = cy - (h / img0.h) * (centerY - (rect.top + img0.y));

    const img1 = clampImageToWindow({ x: x0, y: y0, w, h }, win);
    oknoFixState.img = img1;
    oknoFixImg.style.width = `${img1.w}px`;
    oknoFixImg.style.height = `${img1.h}px`;
    oknoFixImg.style.left = `${img1.x}px`;
    oknoFixImg.style.top = `${img1.y}px`;
  };

  // Ctrl+0 — сброс масштаба фона до "по высоте окна"
  document.addEventListener('keydown', (e) => {
    if (!oknoFixState.open) return;
    if ((e.key === '0' || e.code === 'Digit0') && e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      layoutOknoFixImageCover();
    }
  });

  const close = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeOknoFixModal();
  };

  if (oknoFixCloseBtn) oknoFixCloseBtn.addEventListener('click', close);
  if (oknoFixCancelBtn) oknoFixCancelBtn.addEventListener('click', close);

  if (oknoFixZoomInBtn) {
    oknoFixZoomInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      oknoFixZoomByFactor(1.12);
    });
  }

  if (oknoFixZoomOutBtn) {
    oknoFixZoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      oknoFixZoomByFactor(0.9);
    });
  }

  oknoFixModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeOknoFixModal();
    }
  });

  // Ручки изменения ширины окна больше не используются, окно фиксировано.

  // Перемещение/масштабирование изображения под окном (панорамирование + zoom)
  if (oknoFixImgViewport) {
    oknoFixImgViewport.addEventListener('wheel', (e) => {
      if (!oknoFixState.open) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      oknoFixZoomByFactor(factor);
    });

    oknoFixImgViewport.addEventListener('pointerdown', (e) => {
      if (!oknoFixState.open) return;
      // не перехватываем, если клик по ручке окна
      if (e.target === oknoFixHandleLeft || e.target === oknoFixHandleRight) return;
      if (!oknoFixCard) return;

      const rect = oknoFixCard.getBoundingClientRect();
      const win = getOknoFixWindowRectInCard();
      const winW = win.w;
      const winH = win.h;
      const cx = rect.left + win.x + winW / 2;
      const cy = rect.top + win.y + winH / 2;

      // проверяем, попали ли в край картинки (для зума)
      const img = oknoFixState.img;
      const localX = e.clientX - (rect.left + img.x);
      const localY = e.clientY - (rect.top + img.y);
      const edgeInfo = detectEdgeHandle(localX, localY, img.w, img.h, 12);

      if (edgeInfo.handle) {
        oknoFixState.action = {
          type: 'img-scale',
          handle: edgeInfo.handle,
          startPointerX: e.clientX,
          startPointerY: e.clientY,
          startImg: { ...img },
          centerX: cx,
          centerY: cy
        };
      } else {
        oknoFixState.action = {
          type: 'img-move',
          startPointerX: e.clientX,
          startPointerY: e.clientY,
          startX: img.x,
          startY: img.y
        };
      }

      try { oknoFixImgViewport.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });

    oknoFixImgViewport.addEventListener('pointermove', (e) => {
    if (!oknoFixState.open || !oknoFixState.action) return;

      const action = oknoFixState.action;

      if (action.type === 'img-move') {
        const dx = e.clientX - action.startPointerX;
        const dy = e.clientY - action.startPointerY;

        const win = getOknoFixWindowRectInCard();
        const img0 = oknoFixState.img;
        const tentative = {
          x: action.startX + dx,
          y: action.startY + dy,
          w: img0.w,
          h: img0.h
        };

        const img1 = clampImageToWindow(tentative, win);
        oknoFixState.img = img1;
        oknoFixImg.style.left = `${img1.x}px`;
        oknoFixImg.style.top = `${img1.y}px`;
        return;
      }

      if (action.type === 'img-scale') {
        if (!oknoFixCard) return;
        const rect = oknoFixCard.getBoundingClientRect();
        const win = getOknoFixWindowRectInCard();
        const winW = win.w;
        const winH = win.h;
        const img0 = action.startImg;

        const dx = e.clientX - action.startPointerX;
        const dy = e.clientY - action.startPointerY;

        // масштаб относительно центра окна; вертикальное движение даёт более "контролируемый" zoom
        let factor = 1 + (dy * -0.003); // вверх = увеличить, вниз = уменьшить
        factor = Math.max(0.2, Math.min(5, factor));

        let w = img0.w * factor;
        let h = img0.h * factor;

        // минимальный масштаб: высота картинки не меньше высоты окна
        const minScale = winH / img0.h;
        if (factor < minScale) {
          w = img0.w * minScale;
          h = img0.h * minScale;
        }

        const cx = action.centerX - rect.left;
        const cy = action.centerY - rect.top;

        const x0 = cx - (w / img0.w) * (action.centerX - (rect.left + img0.x));
        const y0 = cy - (h / img0.h) * (action.centerY - (rect.top + img0.y));

        const img1 = clampImageToWindow({ x: x0, y: y0, w, h }, win);
        oknoFixState.img = img1;
        oknoFixImg.style.width = `${img1.w}px`;
        oknoFixImg.style.height = `${img1.h}px`;
        oknoFixImg.style.left = `${img1.x}px`;
        oknoFixImg.style.top = `${img1.y}px`;
        return;
      }
    });

    const endImgMove = (e) => {
      if (!oknoFixState.action || (oknoFixState.action.type !== 'img-move' && oknoFixState.action.type !== 'img-scale')) return;
      oknoFixState.action = null;
      try { oknoFixImgViewport.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    oknoFixImgViewport.addEventListener('pointerup', endImgMove);
    oknoFixImgViewport.addEventListener('pointercancel', endImgMove);
  }

  if (oknoFixApplyBtn) {
    oknoFixApplyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!oknoFixState.open || !oknoFixState.storedName) return;
      if (!oknoFixCard) return;

      const win = getOknoFixWindowRectInCard();
      const img = oknoFixState.img;
      if (!img || !oknoFixState.natW || !oknoFixState.natH || !win.w || !win.h) return;

      // Переводим текущее положение/масштаб картинки в координаты ОРИГИНАЛА
      // для прямоугольника, который соответствует окну шаблона.
      const scale = img.w / oknoFixState.natW;
      if (!scale || !isFinite(scale)) return;

      const cropX = (win.x - img.x) / scale;
      const cropY = (win.y - img.y) / scale;
      const cropW = win.w / scale;
      const cropH = win.h / scale;

      const req = {
        storedName: oknoFixState.storedName,
        x: cropX,
        y: cropY,
        w: cropW,
        h: cropH
      };

      try {
        setBusy(true);
        if (oknoFixHint) oknoFixHint.textContent = 'Генерирую OknoFix...';

        const res = await fetch(toAbsoluteUrl('oknofix'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req)
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }

        if (!res.ok) {
          if (oknoFixHint) oknoFixHint.textContent = t('oknoFixError');
          showResult(data);
          return;
        }

        showResult(data);
        await loadComposites();
        if (oknoFixHint) oknoFixHint.textContent = t('oknoFixCreated');
        closeOknoFixModal();
      } catch (err) {
        if (oknoFixHint) oknoFixHint.textContent = t('oknoFixError');
        showResult(String(err));
      } finally {
        setBusy(false);
      }
    });
  }

  window.addEventListener('resize', () => {
    if (!oknoFixState.open) return;
    layoutOknoFixWindowInitial();
    layoutOknoFixImageCover();
  });
}

function initOknoTools() {
  wireOknoScaleUI();
  wireOknoFixUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOknoTools, { once: true });
} else {
  initOknoTools();
}
