// crop state (coords are in cropStage coordinate space)
const CROP_MIN_W = 60;

function getCropAspect() {
  // width / height
  const a = cropState && cropState.aspect ? cropState.aspect : (16 / 9);
  return a > 0 ? a : (16 / 9);
}

let cropState = {
  open: false,
  storedName: null,
  originalRelativePath: null, // current working file (upload/<storedName>)
  sourceRelativePath: null,   // immutable source (upload-original/<storedName>)
  aspect: 16 / 9,
  aspectLabel: '16:9',
  imgBox: null, // { x, y, w, h } in stage coords
  rect: { x: 0, y: 0, w: 0, h: 0 },
  action: null, // { type: 'move'|'resize', handle?: 'tl'|'tr'|'bl'|'br', startRect, startX, startY, offsetX, offsetY }
  busy: false,
  zoom: 1,
  imgPan: { x: 0, y: 0 },
  imgPanAction: null // { startPointerX, startPointerY, startOffsetX, startOffsetY }
};

function setBusy(busy) {
  saveBtn.disabled = busy;
  saveBtn.title = busy ? 'Загрузка...' : 'Загрузить файл';
}

function showResult(obj) {
  if (!result) return;

  try { result.hidden = false; } catch { /* ignore */ }

  const text = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  if (!result.textContent) {
    result.textContent = text;
  } else {
    result.textContent += "\n\n" + text;
  }
}

function setMainPreviewFromItem(item) {
  const hasItem = !!(item && item.originalRelativePath);

  setToolButtonsEnabled(hasItem);

  // Preview is optional (we may remove it from UI).
  if (!preview) {
    return;
  }

  if (!hasItem) {
    preview.style.display = 'none';
    preview.removeAttribute('src');
    preview.alt = '';
    return;
  }

  // Для превью используем миниатюру (preview/*), чтобы не грузить оригинал.
  // Важно: используем относительные пути, чтобы приложение могло жить под base-path (например /jmaka/).
  const src = item.previewRelativePath ? item.previewRelativePath : item.originalRelativePath;
  preview.src = withCacheBust(src, item.storedName);
  preview.style.display = 'block';
  preview.alt = item.originalName || item.storedName || 'original';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(d) {
  // "дд.мм.гггг - чч:мм:сс"
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} - ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function makeA(href, text) {
  const a = document.createElement('a');
  a.className = 'link-a';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = String(text).slice(0, 10);
  return a;
}

function makeImageLink(href, imgSrc, alt) {
  const a = document.createElement('a');
  a.className = 'link-img';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';

  const img = document.createElement('img');
  img.className = 'table-preview';
  img.alt = alt || '';
  img.loading = 'lazy';
  img.src = imgSrc;

  a.appendChild(img);
  return a;
}

function triggerDownload(href, suggestedName) {
  if (!href) return;
  const a = document.createElement('a');
  a.href = href;
  if (suggestedName) {
    a.download = suggestedName;
  } else {
    // Fallback: derive from URL path.
    try {
      const clean = href.split('?')[0].split('#')[0];
      const parts = clean.split('/');
      const last = parts[parts.length - 1];
      if (last) a.download = last;
    } catch {
      // ignore
    }
  }
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function appendLinkWithDownload(td, linkEl, href, suggestedName) {
  if (!td || !linkEl || !href) {
    if (td && linkEl) td.appendChild(linkEl);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'cell-with-download';

  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
  dlBtn.className = 'download-btn';
  dlBtn.title = 'Скачать';
  // Жирная иконка дискеты
  dlBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v4h9V5H6zm2 2h5V7H8v0zm-2 6v7h11v-7H6z"/></svg>';
  dlBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerDownload(href, suggestedName);
  });

  wrap.appendChild(linkEl);
  wrap.appendChild(dlBtn);
  td.appendChild(wrap);
}

function buildOpDownloadName(originalName, storedName, op) {
  // Всегда маскируем исходное имя и добавляем дату в начало имени файла.
  // В качестве базы используем только служебное имя (storedName)
  // или техническое имя файла (для Split/Okno и т.п.). originalName игнорируем.
  const core = (storedName && String(storedName).trim()) || 'image';

  // Префикс даты в формате YYYYMMDD- (по текущему времени на момент скачивания).
  let datePrefix = '';
  try {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    datePrefix = `${yyyy}${mm}${dd}`;
  } catch {
    // если по какой-то причине Date не сработал, просто без даты
    datePrefix = '';
  }

  // Не дублируем дату, если имя уже начинается с YYYYMMDD-
  let base = core;
  if (datePrefix) {
    const maybeDate = core.slice(0, 8);
    const hasDatePrefix =
      core.length > 9 &&
      core.charAt(8) === '-' &&
      /^[0-9]{8}$/.test(maybeDate);
    if (!hasDatePrefix) {
      base = `${datePrefix}-${core}`;
    }
  }

  const dot = base.lastIndexOf('.');
  const suffix = op && String(op).trim() ? `-${op}` : '';
  if (dot > 0 && dot < base.length - 1) {
    const name = base.slice(0, dot);
    const ext = base.slice(dot); // включая точку
    return `${name}${suffix}${ext}`;
  }
  // если расширения нет, просто добавим суффикс
  return `${base}${suffix}`;
}

function setActiveRow(storedName) {
  for (const v of uploads.values()) {
    v.tr.classList.remove('is-active');
  }
  const u = uploads.get(storedName);
  if (u) {
    u.tr.classList.add('is-active');
  }
}

async function deleteRow(storedName) {
  const ok = await confirmDeleteAsync(storedName);
  if (!ok) return;

  try {
    setBusy(true);
    hint.textContent = 'Удаляю...';

    const res = await fetch(toAbsoluteUrl('delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storedName })
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      hint.textContent = 'Ошибка удаления.';
      showResult(data);
      return;
    }

    // Локально удаляем строку
    const u = uploads.get(storedName);
    if (u && u.tr) {
      u.tr.remove();
    }
    uploads.delete(storedName);

    // Если удалили активную — выбираем следующую строку или очищаем превью
    if (lastUpload && lastUpload.storedName === storedName) {
      const firstTr = filesTbody && filesTbody.querySelector('tr');
      if (firstTr && firstTr.dataset.storedName) {
        const sn = firstTr.dataset.storedName;
        const first = { storedName: sn };
        // лучше перезагрузить историю, чтобы восстановить полные данные
        await loadHistory();
        return;
      }

      lastUpload = null;
      resetSizeButtons();
      setMainPreviewFromItem(null);
    }

    hint.textContent = 'Удалено.';
  } catch (e) {
    hint.textContent = 'Ошибка удаления.';
    showResult(String(e));
  } finally {
    setBusy(false);
  }
}

function ensureTableRowForUpload(data, opts) {
  if (!filesTbody) return;
  if (!data || !data.storedName || !data.originalRelativePath) return;

  const createdAt = opts && opts.createdAt ? opts.createdAt : null;
  const makeActive = opts && Object.prototype.hasOwnProperty.call(opts, 'makeActive') ? !!opts.makeActive : true;

  const storedName = data.storedName;

  // если уже есть строка (теоретически) — просто активируем
  const existing = uploads.get(storedName);
  if (existing) {
    setActiveRow(storedName);
    return;
  }

  const tr = document.createElement('tr');
  tr.dataset.storedName = storedName;

  const tdDt = document.createElement('td');
  tdDt.className = 'col-dt';
  tdDt.textContent = createdAt ? formatDateTime(new Date(createdAt)) : formatDateTime(new Date());

  const tdOrig = document.createElement('td');
  tdOrig.className = 'col-orig';

  const tdCrop = document.createElement('td');
  tdCrop.className = 'col-crop';

  if (data.imageWidth && data.imageHeight) {
    // Оригинал: всегда ведём на upload-original/<storedName> (исходный файл до кропа)
    // и именно его показываем в мини-превью.
    const origHrefRel = `upload-original/${storedName}`;
    const origHref = withCacheBust(origHrefRel, storedName);
    const origImgSrc = origHref; // маленький preview не генерируем, браузер сам ужмёт.

    const origLink = makeImageLink(origHref, origImgSrc, 'original');
    const origDlName = buildOpDownloadName(data.originalName, storedName, 'orig');
    appendLinkWithDownload(tdOrig, origLink, origHref, origDlName);

    // Crop показываем только после первого кропа (isCropped === true).
    if (data.isCropped) {
      const cropHref = withCacheBust(data.originalRelativePath, storedName);
      const cropImgSrc = withCacheBust(
        data.previewRelativePath ? data.previewRelativePath : data.originalRelativePath,
        storedName
      );
      const cropLink = makeImageLink(cropHref, cropImgSrc, 'crop');
      const dlName = buildOpDownloadName(data.originalName, storedName, 'crop');
      appendLinkWithDownload(tdCrop, cropLink, cropHref, dlName);
    } else {
      tdCrop.textContent = '—';
      tdCrop.classList.add('size-cell', 'empty');
    }
  } else {
    // Неизображения: ведём оригинальную ссылку, crop остаётся пустым.
    const href = withCacheBust(data.originalRelativePath, storedName);
    const link = makeA(href, 'original');
    const origDlName = buildOpDownloadName(data.originalName, storedName, 'orig');
    appendLinkWithDownload(tdOrig, link, href, origDlName);

    tdCrop.textContent = '—';
    tdCrop.classList.add('size-cell', 'empty');
  }

  const cells = new Map();
  for (const w of TARGET_WIDTHS) {
    const td = document.createElement('td');
    td.className = 'size-cell empty';
    td.dataset.w = String(w);
    td.textContent = '—';
    tr.appendChild(td);
    cells.set(w, td);
  }

  // Кнопка удаления (крестик)
  const tdDel = document.createElement('td');
  tdDel.className = 'col-del';
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'del-btn';
  delBtn.title = 'Удалить';
  delBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7A1 1 0 1 0 5.7 7.1L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/></svg>';
  delBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteRow(storedName);
  });
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  // Собираем ячейки в нужном порядке: Дата | Оригинал | Crop | 1280 | 1920 | 2440 | Delete
  tr.insertBefore(tdCrop, tr.firstChild);
  tr.insertBefore(tdOrig, tr.firstChild);
  tr.insertBefore(tdDt, tr.firstChild);

  // новая запись сверху
  filesTbody.insertBefore(tr, filesTbody.firstChild);

  uploads.set(storedName, { tr, cells, cropTd: tdCrop, created: new Set(), originalName: data.originalName || null });
  if (makeActive) {
    setActiveRow(storedName);
  }

  // Клик по строке делает её "активной" (т.е. на неё будут применяться кнопки размеров)
  tr.addEventListener('click', (e) => {
    // If user clicked a link inside the row, the viewer/link handler should handle it.
    const a = e && e.target && e.target.closest ? e.target.closest('a') : null;
    if (a) return;

    const sn = tr.dataset.storedName;
    if (!sn) return;

    // Обновляем текущий "контекст" работы кнопок размеров
    lastUpload = {
      storedName: sn,
      originalRelativePath: data.originalRelativePath,
      previewRelativePath: data.previewRelativePath,
      imageWidth: data.imageWidth,
      imageHeight: data.imageHeight
    };
    setActiveRow(sn);
    updateSizeButtonsForCurrent();

    // И обновляем главное превью
    setMainPreviewFromItem(data);
  });
}

function hydrateRowFromHistory(item) {
  ensureTableRowForUpload(item, { createdAt: item.createdAt, makeActive: false });

  const u = uploads.get(item.storedName);
  if (!u) return;

  const resized = item.resized;
  if (resized && typeof resized === 'object') {
    for (const [wStr, rel] of Object.entries(resized)) {
      const w = Number(wStr);
      if (!w || !rel) continue;
      if (!TARGET_WIDTHS.includes(w)) continue;
      setCellLink(item.storedName, w, rel);
      u.created.add(w);
    }
  }

}

async function loadHistory(preferStoredName) {
  if (!filesTbody) return [];

  try {
    const res = await fetch(toAbsoluteUrl('history'), { cache: 'no-store' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = []; }

    if (!res.ok || !Array.isArray(data)) {
      return [];
    }

    // Перерисовываем таблицу целиком
    filesTbody.textContent = '';
    uploads.clear();

    // Сервер уже отдаёт историю в порядке CreatedAt DESC (новые → старые).
    // ensureTableRowForUpload вставляет новые строки через insertBefore(firstChild),
    // поэтому для сохранения порядка "новые сверху" нам нужно обходить массив с конца.
    for (let i = data.length - 1; i >= 0; i--) {
      const item = data[i];
      hydrateRowFromHistory(item);
    }

    // Активная строка: предпочитаем указанную, иначе первую
    const preferred = preferStoredName ? data.find(x => x && x.storedName === preferStoredName) : null;
    const active = preferred || data[0];

    if (active && active.storedName) {
      lastUpload = {
        storedName: active.storedName,
        originalRelativePath: active.originalRelativePath,
        previewRelativePath: active.previewRelativePath,
        imageWidth: active.imageWidth,
        imageHeight: active.imageHeight
      };
      setActiveRow(active.storedName);
      updateSizeButtonsForCurrent();
      setMainPreviewFromItem(active);
    } else {
      lastUpload = null;
      resetSizeButtons();
      setMainPreviewFromItem(null);
    }

    return data;
  } catch {
    return [];
  }
}

function setCellLink(storedName, width, relativePath) {
  const u = uploads.get(storedName);
  if (!u) return;
  const td = u.cells.get(width);
  if (!td) return;

  td.classList.remove('empty');
  td.textContent = '';

  const href = withCacheBust(relativePath, storedName);
  const link = makeA(href, String(width));
  const dlName = buildOpDownloadName(u.originalName, storedName, String(width));
  appendLinkWithDownload(td, link, href, dlName);
}


function resetSizeButtons() {
  if (!sizeButtons) return;
  for (const btn of sizeBtns) {
    btn.disabled = true;
    delete btn.dataset.href;
  }
}

function setToolButtonsEnabled(hasItem) {
  if (!toolButtons) return;
  const imageToolBtns = [cropToolBtn, splitToolBtn, split3ToolBtn, oknoFixToolBtn, oknoScaleToolBtn, imageEditToolBtn]
    .filter(Boolean);

  for (const btn of imageToolBtns) {
    btn.disabled = !hasItem;
  }

  if (videoEditToolBtn) {
    videoEditToolBtn.disabled = false;
  }
}

function updateSizeButtonsForCurrent() {
  if (!sizeButtons) return;

  const storedName = lastUpload && lastUpload.storedName;
  const imageWidth = lastUpload && lastUpload.imageWidth;

  if (!storedName || !imageWidth || imageWidth <= 0) {
    resetSizeButtons();
    return;
  }

  const u = uploads.get(storedName);

  for (const btn of sizeBtns) {
    const w = Number(btn.dataset.w);
    if (!w || w <= 0) {
      btn.disabled = true;
      continue;
    }

    const already = u && u.created && u.created.has(w);
    // Allow upscaling: even if original is small, user may want to generate bigger sizes.
    btn.disabled = !!already;
  }
}

async function generateResize(width) {
  if (!lastUpload || !lastUpload.storedName) {
    return null;
  }

  const res = await fetch(toAbsoluteUrl('resize'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storedName: lastUpload.storedName, width })
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    throw new Error(typeof data === 'string' ? data : JSON.stringify(data));
  }

  return data;
}

if (sizeButtons) {
  sizeButtons.addEventListener('click', async (e) => {
    const btn = e.target && e.target.closest && e.target.closest('button.size-btn');
    if (!btn || btn.disabled) return;

    const width = Number(btn.dataset.w);
    if (!width) return;

    // Проверка дубликатов: если уже делали этот размер для текущего изображения — ничего не делаем.
    const storedName = lastUpload && lastUpload.storedName;
    const u = storedName ? uploads.get(storedName) : null;
    if (u && u.created && u.created.has(width)) {
      hint.textContent = `Размер ${width}px уже создан для этого изображения.`;
      return;
    }

    try {
      setBusy(true);
      hint.textContent = `Оптимизирую до ${width}px...`;

      const data = await generateResize(width);
      if (data && data.relativePath) {
        const storedName = lastUpload && lastUpload.storedName;
        if (!storedName) {
          hint.textContent = 'Не выбран оригинал.';
          return;
        }

        // Заполняем ячейку в таблице
        setCellLink(storedName, width, data.relativePath);

        // Запоминаем, что этот размер уже создан
        const u = uploads.get(storedName);
        if (u) {
          u.created.add(width);
        }

        // Отключаем кнопку, чтобы не делать дубликат
        btn.disabled = true;

        hint.textContent = 'Готово.';
      } else {
        hint.textContent = 'Не удалось создать файл.';
      }
    } catch (err) {
      hint.textContent = 'Ошибка оптимизации.';
      showResult(String(err));
    } finally {
      setBusy(false);
    }
  });
}

async function upload(files) {
  const list = Array.isArray(files) ? files : Array.from(files || []);

  if (list.length <= 0) {
    return;
  }

  if (list.length > 15) {
    hint.textContent = 'Можно загрузить максимум 15 файлов за раз.';
    showResult({ error: 'too_many_files', max: 15, selected: list.length });
    return;
  }

  setBusy(true);
  showResult('Загрузка...');
  resetSizeButtons();

  try {
    const fd = new FormData();
    for (const f of list) {
      fd.append('files', f);
    }

    const res = await fetchWithFallback('upload', {
      method: 'POST',
      body: fd
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      showResult(data);
      hint.textContent = 'Ошибка загрузки.';
      return;
    }

    // Backend returns an array for multi-upload; keep backward compatibility.
    const items = Array.isArray(data) ? data : [data];
    showResult(items);

    // Create rows for each uploaded file; make last one active.
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const makeActive = i === items.length - 1;
      ensureTableRowForUpload(it, { createdAt: it && it.createdAt, makeActive });

      if (makeActive) {
        lastUpload = {
          storedName: it && it.storedName,
          originalRelativePath: it && it.originalRelativePath,
          previewRelativePath: it && it.previewRelativePath,
          imageWidth: it && it.imageWidth,
          imageHeight: it && it.imageHeight
        };
      }
    }

    updateSizeButtonsForCurrent();

    // Ensure tools row becomes visible for the active item (even if we don't show the main preview).
    const activeItem = items.length > 0 ? items[items.length - 1] : null;
    setMainPreviewFromItem(activeItem);

    hint.textContent = items.length === 1
      ? 'Файл загружен.'
      : `Загружено файлов: ${items.length}.`; 
  } catch (e) {
    showResult(String(e));
  } finally {
    setBusy(false);
  }
}

saveBtn.addEventListener('click', () => {
  // Кнопка-дискета = выбор файла. После выбора загрузка стартует автоматически.
  fileInput.value = '';
  fileInput.click();
});

// Drag & drop upload
(function setupDragAndDrop() {
  const page = document.querySelector('.page');
  if (!page) return;

  let dragCounter = 0;

  const setDragState = (on) => {
    if (!page) return;
    page.classList.toggle('is-dragover', !!on);
  };

  page.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    setDragState(true);
  });

  page.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  page.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) setDragState(false);
  });

  page.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    setDragState(false);

    const dt = e.dataTransfer;
    if (!dt) return;

    const files = dt.files && dt.files.length ? Array.from(dt.files) : [];
    if (files.length === 0 && dt.items && dt.items.length) {
      for (const item of dt.items) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
    }

    if (files.length > 0) {
      hint.textContent = files.length === 1
        ? 'Загружаю файл из перетаскивания...'
        : `Загружаю файлов из перетаскивания: ${files.length}...`;
      upload(files);
    }
  });
})();

// Paste from clipboard (images)
document.addEventListener('paste', (e) => {
  const cd = e.clipboardData;
  if (!cd) return;

  const files = [];
  if (cd.files && cd.files.length) {
    for (const f of Array.from(cd.files)) {
      files.push(f);
    }
  } else if (cd.items && cd.items.length) {
    for (const item of cd.items) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
  }

  if (files.length === 0) return;

  e.preventDefault();
  hint.textContent = files.length === 1
    ? 'Загружаю файл из буфера обмена...'
    : `Загружаю файлов из буфера обмена: ${files.length}...`;
  upload(files);
});

fileInput.addEventListener('change', () => {
  const files = fileInput.files ? Array.from(fileInput.files) : [];

  selectedFile = files[0] || null;

  if (!selectedFile) {
    if (preview) {
      preview.style.display = 'none';
      preview.removeAttribute('src');
    }
    resetSizeButtons();
    hint.textContent = 'Нажмите на дискету, перетащите файлы или вставьте из буфера обмена — и они загрузятся.';
    showResult('');
    return;
  }

  if (files.length > 15) {
    if (preview) {
      preview.style.display = 'none';
      preview.removeAttribute('src');
    }
    resetSizeButtons();
    hint.textContent = 'Можно выбрать максимум 15 файлов за раз.';
    showResult({ error: 'too_many_files', max: 15, selected: files.length });
    return;
  }

  // Пока файлы не загружены — сбрасываем lastUpload
  lastUpload = null;
  resetSizeButtons();
  setMainPreviewFromItem(null);

  // Превью локального файла больше не показываем (UI без превью).
  if (preview) {
    try { preview.removeAttribute('src'); } catch { /* ignore */ }
    preview.style.display = 'none';
  }

  hint.textContent = files.length === 1 ? 'Загружаю файл...' : `Загружаю файлов: ${files.length}...`;
  showResult({
    selectedFiles: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
  });

  upload(files);
});

function setCropBusy(busy) {
  cropState.busy = !!busy;
  if (cropApplyBtn) cropApplyBtn.disabled = cropState.busy;
  if (cropCancelBtn) cropCancelBtn.disabled = cropState.busy;
  if (cropCloseBtn) cropCloseBtn.disabled = cropState.busy;
}

function showCropRect() {
  if (!cropRectEl) return;
  cropRectEl.style.left = `${cropState.rect.x}px`;
  cropRectEl.style.top = `${cropState.rect.y}px`;
  cropRectEl.style.width = `${cropState.rect.w}px`;
  cropRectEl.style.height = `${cropState.rect.h}px`;
}

function clampMoveRectToImgBox(x, y, w, h) {
  const b = cropState.imgBox;
  if (!b) return { x, y, w, h };

  const maxX = b.x + b.w - w;
  const maxY = b.y + b.h - h;

  const nx = Math.min(Math.max(x, b.x), maxX);
  const ny = Math.min(Math.max(y, b.y), maxY);

  return { x: nx, y: ny, w, h };
}

function computeImgBoxInStage() {
  if (!cropStage || !cropImg) return null;

  const stageRect = cropStage.getBoundingClientRect();
  const stageW = stageRect.width;
  const stageH = stageRect.height;
  if (!stageW || !stageH) return null;

  const natW = cropImg.naturalWidth || 0;
  const natH = cropImg.naturalHeight || 0;
  const z = typeof cropState.zoom === 'number' ? cropState.zoom : 1;
  const hasPan = cropState.imgPan && (cropState.imgPan.x || cropState.imgPan.y);

  // Если нет инфы о размере картинки — используем только boundingClientRect.
  if (!natW || !natH || natW <= 0 || natH <= 0) {
    const imgRect = cropImg.getBoundingClientRect();
    const x0 = imgRect.left - stageRect.left;
    const y0 = imgRect.top - stageRect.top;
    const w0 = imgRect.width;
    const h0 = imgRect.height;
    if (w0 <= 1 || h0 <= 1) return null;
    return { x: x0, y: y0, w: w0, h: h0 };
  }

  // Базовый прямоугольник содержимого (без zoom/pan), как отрисовывает object-fit: contain.
  const imgAspect = natW / natH;
  const stageAspect = stageW / stageH;

  let baseW;
  let baseH;

  if (imgAspect > stageAspect) {
    // шире контейнера: вписываем по ширине
    baseW = stageW;
    baseH = baseW / imgAspect;
  } else {
    // выше контейнера: вписываем по высоте
    baseH = stageH;
    baseW = baseH * imgAspect;
  }

  if (baseW <= 1 || baseH <= 1) return null;

  // Без zoom/pan просто возвращаем базовую рамку (как раньше).
  if (z === 1 && !hasPan) {
    const offsetX = (stageW - baseW) / 2;
    const offsetY = (stageH - baseH) / 2;
    return { x: offsetX, y: offsetY, w: baseW, h: baseH };
  }

  // При zoom/pan <img> масштабируется относительно центра всего stage (width/height = 100%).
  // Но реальное содержимое внутри него имеет размеры baseW/baseH. Чтобы получить рамку
  // именно по содержимому, берём boundingClientRect img и корректируем его на разницу
  // между размером элемента (stageW/stageH) и содержимого (baseW/baseH).
  const imgRect = cropImg.getBoundingClientRect();
  const xImg = imgRect.left - stageRect.left;
  const yImg = imgRect.top - stageRect.top;

  const w = baseW * z;
  const h = baseH * z;
  const x = xImg + (stageW - baseW) * z / 2;
  const y = yImg + (stageH - baseH) * z / 2;

  if (w <= 1 || h <= 1) return null;
  return { x, y, w, h };
}

function applyCropImgTransform() {
  if (!cropImg) return;
  const z = typeof cropState.zoom === 'number' ? cropState.zoom : 1;
  const pan = cropState.imgPan || { x: 0, y: 0 };

  if (z === 1 && (!pan.x && !pan.y)) {
    cropImg.style.transform = 'none';
    return;
  }

  cropImg.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${z})`;
}

function cropSetZoom(zoom) {
  if (!cropStage || !cropImg) return;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom || 1));
  cropState.zoom = z;
  applyCropImgTransform();

  const b = computeImgBoxInStage();
  if (!b) return;
  cropState.imgBox = b;

  // После изменения зума гарантируем, что рамка остаётся в пределах изображения.
  const r = clampMoveRectToImgBox(
    cropState.rect.x,
    cropState.rect.y,
    cropState.rect.w,
    cropState.rect.h
  );
  cropState.rect = r;
  showCropRect();
}

function cropZoomByFactor(factor) {
  if (!cropState.open || cropState.busy) return;
  if (!cropStage || !cropImg) return;
  const current = typeof cropState.zoom === 'number' ? cropState.zoom : 1;
  const next = current * (factor || 1);
  cropSetZoom(next);
}

function initCropRect() {
  const b = cropState.imgBox;
  if (!b) return;

  // стараемся взять ~80% площади по ширине, но чтобы влезало по высоте и держало выбранные пропорции
  const aspect = getCropAspect();
  const maxW = b.w * 0.85;
  const maxWByH = b.h * aspect;
  const w = Math.max(CROP_MIN_W, Math.min(maxW, maxWByH));
  const h = w / aspect;

  const x = b.x + (b.w - w) / 2;
  const y = b.y + (b.h - h) / 2;

  cropState.rect = clampMoveRectToImgBox(x, y, w, h);
  showCropRect();
}

function openCropModal() {
  if (!cropModal || !cropStage || !cropImg || !cropRectEl) return;

  if (!lastUpload || !lastUpload.storedName || !lastUpload.originalRelativePath) return;
  if (!lastUpload.imageWidth || !lastUpload.imageHeight) return;

  cropState.open = true;
  cropState.storedName = lastUpload.storedName;
  cropState.originalRelativePath = lastUpload.originalRelativePath;
  cropState.sourceRelativePath = `upload-original/${lastUpload.storedName}`;
  cropState.action = null;
  cropState.zoom = 1;
  cropState.imgPan = { x: 0, y: 0 };
  cropState.imgPanAction = null;
  if (cropImg) {
    cropImg.style.transform = 'none';
  }
  setCropBusy(false);

  // Keep current aspect selection (default 16:9)
  syncCropAspectButtons();

  cropModal.hidden = false;

  const v = Date.now();
  const sourceUrl = `${cropState.sourceRelativePath}?v=${v}`;
  const fallbackUrl = `${cropState.originalRelativePath}?v=${v}`;

  // UI hint: show which file we are cropping + link to open it.
  if (cropSourceLabel) {
    cropSourceLabel.textContent = `Режем оригинал: ${cropState.sourceRelativePath}`;
  }
  if (cropOpenOriginal) {
    cropOpenOriginal.href = sourceUrl;
    cropOpenOriginal.hidden = false;
  }

  // Загружаем неизменённый оригинал в модалку. Если файла нет (старые записи), fallback на upload/.
  cropImg.dataset.fallbackTried = '';
  cropImg.onerror = () => {
    if (cropImg.dataset.fallbackTried) return;
    cropImg.dataset.fallbackTried = '1';

    if (cropSourceLabel) {
      cropSourceLabel.textContent = `Режем (fallback): ${cropState.originalRelativePath}`;
    }
    if (cropOpenOriginal) {
      cropOpenOriginal.href = fallbackUrl;
      cropOpenOriginal.hidden = false;
    }

    cropImg.src = fallbackUrl;
  };

  cropImg.src = sourceUrl;
  cropImg.alt = lastUpload.originalName || lastUpload.storedName || 'crop';

  // После загрузки картинки вычислим box и инициализируем прямоугольник
  cropImg.onload = () => {
    requestAnimationFrame(() => {
      cropState.imgBox = computeImgBoxInStage();
      initCropRect();
    });
  };

  // если картинка уже в кеше и onload может не сработать — попробуем через rAF
  requestAnimationFrame(() => {
    const b = computeImgBoxInStage();
    if (b) {
      cropState.imgBox = b;
      initCropRect();
    }
  });
}

function closeCropModal() {
  if (!cropModal) return;
  cropModal.hidden = true;
  cropState.open = false;
  cropState.action = null;
  cropState.sourceRelativePath = null;
  cropState.zoom = 1;
  cropState.imgPan = { x: 0, y: 0 };
  cropState.imgPanAction = null;
  setCropBusy(false);

  if (cropImg) {
    cropImg.onerror = null;
    delete cropImg.dataset.fallbackTried;
    cropImg.style.transform = 'none';
    cropImg.removeAttribute('src');
    cropImg.alt = '';
  }
  if (cropSourceLabel) {
    cropSourceLabel.textContent = '';
  }
  if (cropOpenOriginal) {
    cropOpenOriginal.href = '#';
    cropOpenOriginal.hidden = true;
  }
}

function getPointerPosInStage(e) {
  if (!cropStage) return { x: 0, y: 0 };
  const r = cropStage.getBoundingClientRect();
  return {
    x: e.clientX - r.left,
    y: e.clientY - r.top
  };
}

function clampResizeW(anchorX, anchorY, handle, desiredW) {
  const b = cropState.imgBox;
  if (!b) return Math.max(CROP_MIN_W, desiredW);

  // Доступное пространство от anchor до границы изображения
  let maxW;
  let maxH;

  if (handle === 'br') {
    maxW = (b.x + b.w) - anchorX;
    maxH = (b.y + b.h) - anchorY;
  } else if (handle === 'tr') {
    maxW = (b.x + b.w) - anchorX;
    maxH = anchorY - b.y;
  } else if (handle === 'bl') {
    maxW = anchorX - b.x;
    maxH = (b.y + b.h) - anchorY;
  } else {
    // tl
    maxW = anchorX - b.x;
    maxH = anchorY - b.y;
  }

  maxW = Math.max(1, maxW);
  maxH = Math.max(1, maxH);

  // Ограничение по высоте тоже переводим в ограничение по ширине
  const maxWByH = maxH * getCropAspect();
  const hardMaxW = Math.max(1, Math.min(maxW, maxWByH));

  return Math.min(Math.max(desiredW, CROP_MIN_W), hardMaxW);
}

async function applyCrop() {
  if (!cropState.open || cropState.busy) return;
  if (!cropState.storedName || !cropImg || !cropStage) return;

  const b = cropState.imgBox;
  if (!b || b.w <= 1 || b.h <= 1) return;

  const natW = cropImg.naturalWidth;
  const natH = cropImg.naturalHeight;
  if (!natW || !natH) return;

  // В реальности DOM-замеры ширины/высоты (getBoundingClientRect) могут дать немного
  // разные коэффициенты по X и Y из-за округления. Чтобы не "ломать" пропорции
  // выбранной рамки (1:1, 2:3, 16:9 и т.п.), берём единый scale.
  const scaleX = natW / b.w;
  const scaleY = natH / b.h;
  const scale = (scaleX + scaleY) / 2;

  const xInImg = cropState.rect.x - b.x;
  const yInImg = cropState.rect.y - b.y;

  const req = {
    storedName: cropState.storedName,
    x: Math.round(xInImg * scale),
    y: Math.round(yInImg * scale),
    width: Math.round(cropState.rect.w * scale),
    height: Math.round(cropState.rect.h * scale)
  };

  try {
    setCropBusy(true);
    hint.textContent = 'Обрезаю...';

    const res = await fetch(toAbsoluteUrl('crop'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      hint.textContent = 'Ошибка кадрирования.';
      showResult(data);
      return;
    }

    showResult(data);

    // Crop overwrites files under the same storedName, so bump cache-buster.
    cacheBust.set(cropState.storedName, Date.now());

    // Обновляем таблицу/превью из истории. Плюс сохраняем выделение на этой же записи.
    await loadHistory(cropState.storedName);

    hint.textContent = 'Готово. Ресайзы сброшены — их нужно создать заново.';
    closeCropModal();
  } catch (e) {
    hint.textContent = 'Ошибка кадрирования.';
    showResult(String(e));
  } finally {
    setCropBusy(false);
  }
}

function wireCropUI() {
  if (!cropModal || !cropStage || !cropRectEl) return;

  // Aspect buttons
  if (cropAspectBtns && cropAspectBtns.length > 0) {
    for (const b of cropAspectBtns) {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const aw = Number(b.dataset.aw);
        const ah = Number(b.dataset.ah);
        setCropAspect(aw, ah);
      });
    }
  }

  // Закрытие по кнопкам
  if (cropCancelBtn) cropCancelBtn.addEventListener('click', closeCropModal);
  if (cropCloseBtn) cropCloseBtn.addEventListener('click', closeCropModal);
  if (cropApplyBtn) cropApplyBtn.addEventListener('click', applyCrop);

  // Клик по фону
  cropModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeCropModal();
    }
  });

  // Drag (move) по прямоугольнику
  cropRectEl.addEventListener('pointerdown', (e) => {
    if (!cropState.open || cropState.busy) return;

    const handle = e.target && e.target.dataset ? e.target.dataset.h : null;
    const p = getPointerPosInStage(e);

    const r = cropState.rect;

    if (handle) {
      cropState.action = {
        type: 'resize',
        handle,
        startRect: { ...r },
        startX: p.x,
        startY: p.y
      };
    } else {
      cropState.action = {
        type: 'move',
        startRect: { ...r },
        offsetX: p.x - r.x,
        offsetY: p.y - r.y
      };
    }

    cropRectEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  cropRectEl.addEventListener('pointermove', (e) => {
    if (!cropState.open || cropState.busy) return;
    if (!cropState.action) return;

    const p = getPointerPosInStage(e);
    const b = cropState.imgBox;
    if (!b) return;

    if (cropState.action.type === 'move') {
      const w = cropState.rect.w;
      const h = cropState.rect.h;
      const x = p.x - cropState.action.offsetX;
      const y = p.y - cropState.action.offsetY;
      cropState.rect = clampMoveRectToImgBox(x, y, w, h);
      showCropRect();
      return;
    }

    // resize
    const handle = cropState.action.handle;
    const sr = cropState.action.startRect;

    // anchor = противоположный угол
    let ax, ay;
    if (handle === 'br') {
      ax = sr.x;
      ay = sr.y;
    } else if (handle === 'tr') {
      ax = sr.x;
      ay = sr.y + sr.h;
    } else if (handle === 'bl') {
      ax = sr.x + sr.w;
      ay = sr.y;
    } else {
      // tl
      ax = sr.x + sr.w;
      ay = sr.y + sr.h;
    }

    // ограничим pointer в пределах изображения (чтобы не было отрицательных размеров)
    const px = Math.min(Math.max(p.x, b.x), b.x + b.w);
    const py = Math.min(Math.max(p.y, b.y), b.y + b.h);

    const dx = Math.abs(px - ax);
    const dy = Math.abs(py - ay);

    const wFromX = dx;
    const wFromY = dy * getCropAspect();

    let desiredW = Math.min(wFromX, wFromY);
    desiredW = clampResizeW(ax, ay, handle, desiredW);

    const newW = desiredW;
    const newH = newW / getCropAspect();

    let x, y;
    if (handle === 'br') {
      x = ax;
      y = ay;
    } else if (handle === 'tr') {
      x = ax;
      y = ay - newH;
    } else if (handle === 'bl') {
      x = ax - newW;
      y = ay;
    } else {
      x = ax - newW;
      y = ay - newH;
    }

    cropState.rect = clampMoveRectToImgBox(x, y, newW, newH);
    showCropRect();
  });

  const endPointer = (e) => {
    if (!cropState.open) return;
    if (!cropState.action) return;
    cropState.action = null;
    try { cropRectEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  cropRectEl.addEventListener('pointerup', endPointer);
  cropRectEl.addEventListener('pointercancel', endPointer);

  // Зум: колесо мыши по рабочему полю кадрирования
  if (cropStage) {
    cropStage.addEventListener('wheel', (e) => {
      if (!cropState.open || cropState.busy) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      cropZoomByFactor(factor);
    });

    // Панорамирование изображения мышью (перетаскивание по полю)
    cropStage.addEventListener('pointerdown', (e) => {
      if (!cropState.open || cropState.busy) return;
      const t = e.target;
      // если клик по рамке или её ручкам — отдаём управление логике рамки
      if (cropRectEl && (t === cropRectEl || cropRectEl.contains(t))) return;

      const pan = cropState.imgPan || { x: 0, y: 0 };
      cropState.imgPanAction = {
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startOffsetX: pan.x || 0,
        startOffsetY: pan.y || 0
      };

      try { cropStage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });

    cropStage.addEventListener('pointermove', (e) => {
      if (!cropState.open || cropState.busy) return;
      const act = cropState.imgPanAction;
      if (!act) return;

      const dx = e.clientX - act.startPointerX;
      const dy = e.clientY - act.startPointerY;

      cropState.imgPan = {
        x: act.startOffsetX + dx,
        y: act.startOffsetY + dy
      };

      applyCropImgTransform();

      const b = computeImgBoxInStage();
      if (b) {
        cropState.imgBox = b;
        const r = clampMoveRectToImgBox(
          cropState.rect.x,
          cropState.rect.y,
          cropState.rect.w,
          cropState.rect.h
        );
        cropState.rect = r;
        showCropRect();
      }
    });

    const endImgPan = (e) => {
      if (!cropState.imgPanAction) return;
      cropState.imgPanAction = null;
      try { cropStage.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    cropStage.addEventListener('pointerup', endImgPan);
    cropStage.addEventListener('pointercancel', endImgPan);
  }

  // Горячие клавиши для CROP: = / - / Ctrl+0 (сброс зума)
  document.addEventListener('keydown', (e) => {
    if (!cropState.open || cropState.busy) return;

    if ((e.key === '=' || e.key === '+') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      cropZoomByFactor(1.08);
      return;
    }

    if ((e.key === '-' || e.key === '_') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      cropZoomByFactor(0.93);
      return;
    }

    if ((e.key === '0' || e.code === 'Digit0') && e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      cropState.imgPan = { x: 0, y: 0 };
      cropState.imgPanAction = null;
      cropSetZoom(1);
      // переинициализируем рамку по вписанному изображению
      const b = computeImgBoxInStage();
      if (b) {
        cropState.imgBox = b;
        initCropRect();
      }
    }
  });

  // если окно/вьюпорт изменился — пересчитаем box и чуть поправим прямоугольник
  window.addEventListener('resize', () => {
    if (!cropState.open) return;
    const b = computeImgBoxInStage();
    if (!b) return;
    cropState.imgBox = b;
    initCropRect();
  });
}

// Клик по главному превью открывает интерфейс кадрирования
if (preview) {
  preview.addEventListener('click', () => {
    openCropModal();
  });
}

// Tool buttons
if (cropToolBtn) {
  cropToolBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCropModal();
  });
}

wireCropUI();
wireSplitUI();
wireSplit3UI();
wireOknoFixUI();
wireOknoScaleUI();

async function deleteComposite(relativePath, tr) {
  if (!relativePath) return;

  try {
    setBusy(true);
    const res = await fetch(toAbsoluteUrl('delete-composite'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relativePath })
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      showResult(data);
      return;
    }

    if (tr) tr.remove();
  } catch (e) {
    showResult(String(e));
  } finally {
    setBusy(false);
  }
}

async function loadComposites() {
  if (!compositesTbody) return [];

  try {
    const res = await fetch(toAbsoluteUrl('composites'), { cache: 'no-store' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = []; }

    if (!res.ok || !Array.isArray(data)) {
      return [];
    }

    compositesTbody.textContent = '';

    for (const it of data) {
      const tr = document.createElement('tr');

      const tdDt = document.createElement('td');
      tdDt.className = 'col-dt';
      tdDt.textContent = it && it.createdAt ? formatDateTime(new Date(it.createdAt)) : formatDateTime(new Date());

      const tdKind = document.createElement('td');
      tdKind.className = 'col-kind';
      const kind = (it && it.kind) ? String(it.kind) : '';
      let kindLabel = 'Split';
      if (kind === 'split3') kindLabel = 'Split3';
      else if (kind === 'oknofix') kindLabel = 'OknoFix';
      else if (kind === 'oknoscale') kindLabel = 'OknoScale';
      else if (kind === 'edit') kindLabel = 'Edit';
      tdKind.textContent = kindLabel;

      const tdImg = document.createElement('td');
      tdImg.className = 'col-comp';
      const rel = it && it.relativePath ? String(it.relativePath) : '';
      if (rel) {
        const href = rel;
        const link = makeImageLink(href, rel, kind || 'split');
        const fileName = rel.split('/').pop() || '';
        let op = 'split';
        if (kind === 'split3') op = 'split3';
        else if (kind === 'oknofix') op = 'oknofix';
        else if (kind === 'oknoscale') op = 'oknoscale';
        else if (kind === 'edit') op = 'edit';
        const dlName = buildOpDownloadName(fileName, fileName, op);
        appendLinkWithDownload(tdImg, link, href, dlName);
      } else {
        tdImg.textContent = '—';
        tdImg.classList.add('empty');
      }

      const tdDel = document.createElement('td');
      tdDel.className = 'col-del';
      if (rel) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'del-btn';
        delBtn.title = 'Удалить результат';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7A1 1 0 1 0 5.7 7.1L10.6 12l-4.9 4.9a1 1 0 1 0 1.4 1.4L12 13.4l4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/></svg>';
        delBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          deleteComposite(rel, tr);
        });
        tdDel.appendChild(delBtn);
      }

      tr.appendChild(tdDt);
      tr.appendChild(tdKind);
      tr.appendChild(tdImg);
      tr.appendChild(tdDel);

      compositesTbody.appendChild(tr);
    }

    return data;
  } catch {
    return [];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setToolButtonsEnabled(false);
  resetSizeButtons();
  loadHistory();
  loadComposites();
});

