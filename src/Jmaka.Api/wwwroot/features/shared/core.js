// Jmaka frontend version: 0.5.3
let APP_VERSION = '0.5.3';

const fileInput = document.getElementById('fileInput');
const saveBtn = document.getElementById('saveBtn');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const hint = document.getElementById('hint');

// Debug output is hidden for regular users.
// Enable it locally with: ?debug=1 (persists in localStorage), or by setting localStorage jmaka_debug=1.
const DEBUG_KEY = 'jmaka_debug';
const DEBUG_ENABLED = (() => {
  try {
    const qs = new URLSearchParams(window.location.search);
    const q = qs.get('debug');
    if (q === '1' || q === 'true') {
      localStorage.setItem(DEBUG_KEY, '1');
      return true;
    }
    if (q === '0' || q === 'false') {
      localStorage.removeItem(DEBUG_KEY);
      return false;
    }
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
})();
const filesTbody = document.getElementById('filesTbody');
const compositesTbody = document.getElementById('compositesTbody');
const sizeButtons = document.getElementById('sizeButtons');
const sizeBtns = sizeButtons ? Array.from(sizeButtons.querySelectorAll('button.size-btn')) : [];

const LANGUAGE_KEY = 'jmaka_language';
const UI_TEXTS = {
  ru: {
    loading: 'Загрузка...',
    loadError: 'Ошибка загрузки.',
    videoUploadHint: 'Загрузите видео и перетащите границы на таймлайне.',
    videoUploading: 'Загружаю видео...',
    videoUploaded: 'Видео загружено. Выберите отрезки на таймлайне и нажмите Сделать.',
    videoProcessing: 'Обрабатываю видео...',
    videoDone: 'Готово. Результат появился в Processed.',
    videoQueue: 'В очереди...',
    videoNormalize: 'Нормализую формат для редактора...',
    videoNormalizeElapsed: 'Нормализую формат для редактора... прошло',
    etaLeft: 'осталось',
    videoUploadErrorPrefix: 'Ошибка загрузки видео.',
    videoProcessErrorPrefix: 'Ошибка обработки видео.',
    videoNormalizeStatusError: 'Не удалось получить статус нормализации',
    videoNormalizeTimeout: 'Превышено время ожидания нормализации видео',
    deleteConfirm: 'Удалить запись и все связанные файлы безвозвратно?',
    splitCreated: 'Split создан.',
    splitChooseTwo: 'Выберите две картинки.',
    splitError: 'Ошибка split.',
    splitWorking: 'Склеиваю...',
    splitChooseFrom1280: 'Выберите две картинки из готового размера 1280.',
    oknoFixCreated: 'OknoFix создан.',
    oknoFixError: 'Ошибка OknoFix.',
    oknoScaleCreated: 'OknoScale создан.',
    oknoScaleError: 'Ошибка OknoScale.',
    editCreated: 'Edit создан.',
    saving: 'Сохраняю...',
    saveError: 'Ошибка сохранения.',
    saveDone: 'Готово.',
    languageLabel: 'Выбор языка'
  },
  'en-US': {
    loading: 'Loading...',
    loadError: 'Loading error.',
    videoUploadHint: 'Upload a video and drag the segment boundaries on the timeline.',
    videoUploading: 'Uploading video...',
    videoUploaded: 'Video uploaded. Select segments on the timeline and click Process.',
    videoProcessing: 'Processing video...',
    videoDone: 'Done. The result appeared in Processed.',
    videoQueue: 'Queued...',
    videoNormalize: 'Normalizing format for editor...',
    videoNormalizeElapsed: 'Normalizing format for editor... elapsed',
    etaLeft: 'left',
    videoUploadErrorPrefix: 'Video upload error.',
    videoProcessErrorPrefix: 'Video processing error.',
    videoNormalizeStatusError: 'Failed to get normalization status',
    videoNormalizeTimeout: 'Video normalization timed out',
    deleteConfirm: 'Delete this entry and all related files permanently?',
    splitCreated: 'Split created.',
    splitChooseTwo: 'Choose two images.',
    splitError: 'Split error.',
    splitWorking: 'Merging...',
    splitChooseFrom1280: 'Choose two images from ready 1280 size.',
    oknoFixCreated: 'OknoFix created.',
    oknoFixError: 'OknoFix error.',
    oknoScaleCreated: 'OknoScale created.',
    oknoScaleError: 'OknoScale error.',
    editCreated: 'Edit created.',
    saving: 'Saving...',
    saveError: 'Save error.',
    saveDone: 'Done.',
    languageLabel: 'Language selector'
  },
  'es-ES': {
    loading: 'Cargando...',
    loadError: 'Error de carga.',
    videoUploadHint: 'Sube un vídeo y arrastra los límites de los segmentos en la línea de tiempo.',
    videoUploading: 'Subiendo vídeo...',
    videoUploaded: 'Vídeo subido. Selecciona segmentos en la línea de tiempo y pulsa Procesar.',
    videoProcessing: 'Procesando vídeo...',
    videoDone: 'Listo. El resultado apareció en Processed.',
    videoQueue: 'En cola...',
    videoNormalize: 'Normalizando formato para el editor...',
    videoNormalizeElapsed: 'Normalizando formato para el editor... transcurrido',
    etaLeft: 'restante',
    videoUploadErrorPrefix: 'Error de carga de vídeo.',
    videoProcessErrorPrefix: 'Error de procesamiento de vídeo.',
    videoNormalizeStatusError: 'No se pudo obtener el estado de normalización',
    videoNormalizeTimeout: 'Se agotó el tiempo de espera de normalización de vídeo',
    deleteConfirm: '¿Eliminar este registro y todos los archivos relacionados de forma permanente?',
    splitCreated: 'Split creado.',
    splitChooseTwo: 'Elige dos imágenes.',
    splitError: 'Error de Split.',
    splitWorking: 'Combinando...',
    splitChooseFrom1280: 'Elige dos imágenes del tamaño 1280.',
    oknoFixCreated: 'OknoFix creado.',
    oknoFixError: 'Error de OknoFix.',
    oknoScaleCreated: 'OknoScale creado.',
    oknoScaleError: 'Error de OknoScale.',
    editCreated: 'Edición creada.',
    saving: 'Guardando...',
    saveError: 'Error al guardar.',
    saveDone: 'Listo.',
    languageLabel: 'Selector de idioma'
  }
};

const PHRASE_TRANSLATIONS = {
  'en-US': {
    'Загрузить изображение': 'Upload image',
    'Нажмите на дискету, перетащите файлы или вставьте из буфера обмена — и они загрузятся.': 'Click the disk icon, drag files, or paste from clipboard — they will upload automatically.',
    'Справка': 'Help',
    'Удаление': 'Delete',
    'Удалить': 'Delete',
    'Отмена': 'Cancel',
    'Закрыть': 'Close',
    'Сделать': 'Process',
    'Склеить': 'Merge',
    'Обрезать': 'Crop',
    'Открыть в новой вкладке': 'Open in new tab',
    'Открыть оригинал': 'Open original',
    'Просмотр': 'Viewer',
    'Кадрирование': 'Crop',
    'Выберите две картинки из готового размера 1280.': 'Choose two images from ready 1280 size.',
    'Выберите три картинки.': 'Choose three images.',
    'Выберите строку в таблице файлов, затем откройте OknoFix.': 'Select a row in the files table, then open OknoFix.',
    'Выберите строку в таблице файлов, затем откройте OknoScale.': 'Select a row in the files table, then open OknoScale.',
    'Двигайте и масштабируйте картинку под окном. Ширину окна можно менять ручками слева/справа.': 'Move and scale the image under the window. You can resize the window width with side handles.',
    'Справка по Jmaka': 'Jmaka Help',
    'Краткое описание всех функций и горячих действий.': 'Short description of all features and quick actions.',
    'Практическая шпаргалка по функциям, статусам и быстрым действиям.': 'Practical cheat sheet for features, statuses and quick actions.',
    'Загрузка файлов': 'File upload',
    'Таблица файлов': 'Files table',
    'Инструменты': 'Tools',
    'Прочее': 'Other',
    'Дата - время': 'Date - time',
    'Оригинал': 'Original',
    'Тип': 'Type',
    'Результат': 'Result',
    'Таблицы файлов': 'Files tables',
    'Таблица файлов': 'Files table',
    'Таблица Split': 'Split table',
    'Готовые файлы': 'Ready files',
    'Размеры': 'Sizes',
    'Панель управления': 'Control panel',
    'Загрузка файла': 'File upload',
    'Можно включить обратно, очистив настройку в LocalStorage.': 'You can enable this again by clearing the LocalStorage setting.',
    'Больше не спрашивать (удалять сразу)': 'Do not ask again (delete immediately)',
    'Удалить запись и все связанные файлы безвозвратно?': 'Delete this entry and all related files permanently?',
    'Выберите слот, затем кликните по превью из списка загруженных изображений:': 'Select a slot, then click a preview from uploaded images:',
    'Выбор для картинки 1': 'Select for image 1',
    'Выбор для картинки 2': 'Select for image 2',
    'Выбор для картинки 3': 'Select for image 3',
    'Левая половина': 'Left half',
    'Правая половина': 'Right half',
    'Треть 1': 'Third 1',
    'Треть 2': 'Third 2',
    'Треть 3': 'Third 3',
    'Поле 16:9': '16:9 stage',
    'Поле 1280×720. Перетаскивайте и масштабируйте изображения, пропорции сохраняются.': '1280×720 stage. Drag and scale images while aspect ratio is preserved.',
    'Пропорции кадрирования': 'Crop ratio',
    'Перетаскивайте рамку и её углы. Выберите пропорции:': 'Drag the frame and its corners. Choose ratio:',
    'Результат': 'Result',
    'Выбор языка': 'Language selector',
    'Русский': 'Русский',
    'Обрабатываю видео...': 'Processing video...',

    'Split (2 изображения → 16:9)': 'Split (2 images → 16:9)',
    'Split3 (3 изображения → 16:9)': 'Split3 (3 images → 16:9)',
    'OknoFix (1 изображение → вертикальная карточка)': 'OknoFix (1 image → vertical card)',
    'OknoScale (1 изображение → вертикальная карточка)': 'OknoScale (1 image → vertical card)',
    'Загрузка файлов': 'File upload',
    'Кнопка-дискета — выбор до 15 файлов за раз.': 'Disk button: choose up to 15 files at once.',
    'Поддержка drag & drop: просто перетащите файлы на окно.': 'Drag & drop supported: just drop files into the window.',
    'Вставка из буфера обмена (Ctrl+V) для картинок.': 'Clipboard paste (Ctrl+V) for images.',
    'Таблица файлов': 'Files table',
    'Каждая строка — загруженное изображение (новые сверху).': 'Each row is an uploaded image (newest first).',
    'В ячейке «Оригинал» — мини-preview + маленькая кнопка-дискета для скачивания.': 'In “Original” cell: mini preview + small disk download button.',
    'В ячейке «Оригинал» — миниатюра + маленькая кнопка-дискета для скачивания.': 'In “Original” cell: thumbnail + small disk download button.',
    'Размеры 1280 / 1920 / 2440 создаются по клику по кнопкам сверху.': '1280 / 1920 / 2440 sizes are generated by clicking top buttons.',
    'Крестик справа удаляет запись и все связанные файлы.': 'Cross button on the right deletes the record and all related files.',
    'Инструменты': 'Tools',
    '— кадрирование исходника с выбором пропорций (1:1, 2:3, 16:9).': '— crop source image with aspect ratio choice (1:1, 2:3, 16:9).',
    '— две картинки → одна 1280×720, белая полоса 7px по центру.': '— two images → one 1280×720, white 7px center divider.',
    '— три картинки → одна 1280×720, две белые полосы 7px.': '— three images → one 1280×720, two white 7px dividers.',
    '— вертикальная карточка по строгому PNG-шаблону:': '— vertical card using strict PNG template:',
    'режим фиксированного окна (как на исходном PNG);': 'fixed window mode (same as source PNG);',
    'картинка подложки двигается мышью и масштабируется пропорционально;': 'background image can be moved and scaled proportionally;',
    'масштаб — через колесо мыши или кнопки «−»/«+» внизу справа.': 'zoom via mouse wheel or “−”/“+” buttons at bottom-right.',
    '— экспериментальный режим той же карточки с изменяемой шириной окна.': '— experimental mode of same card with resizable window width.',
    '— редактирование изображений с настройкой яркости, контраста, насыщенности, оттенка, экспозиции и вибрации.': '— image editing with brightness, contrast, saturation, hue, exposure and vibrance.',
    '— редактирование видео с инструментами:': '— video editing with tools:',
    '— обрезка начала/конца и вырезание сегментов из середины;': '— trim start/end and cut segments from middle;',
    '— кадрирование видео;': '— video crop;',
    '— поворот на 90°, 180° или 270°;': '— rotate by 90°, 180° or 270°;',
    '— отражение по горизонтали или вертикали;': '— flip horizontally or vertically;',
    '— изменение скорости (0.25x - 2.0x);': '— speed change (0.25x - 2.0x);',
    '— отключение звука;': '— mute audio;',
    '— сброс всех изменений.': '— reset all changes.',
    'Прочее': 'Other',
    'История Split / Split3 / OknoFix / OknoScale / Edit / Video Edit — в правой таблице.': 'History of Split / Split3 / OknoFix / OknoScale / Edit / Video Edit is in the right table.',
    'Каждый результат можно открыть, скачать или удалить.': 'Each result can be opened, downloaded or deleted.',
    'Старые записи и файлы автоматически очищаются по времени хранения.': 'Old records and files are auto-cleaned by retention period.',
    'Используйте таймлайн ниже для выбора сегментов видео': 'Use timeline below to select video segments',
    'Перетащите границы, чтобы задать отрезок.': 'Drag boundaries to set segment.',
    'Перетащите углы рамки для кадрирования видео': 'Drag frame corners to crop video',
    'Тримминг, кадрирование, поворот и настройка размера.': 'Trim, crop, rotate and size tuning.',
    'Правки применяются в реальном времени, сохранение — на сервере.': 'Edits are applied in real time, saving is done on server.',
    'Скорость:': 'Speed:',
    'Сбросить': 'Reset',
    'Сохранить': 'Save',
    '+ Сегмент': '+ Segment',
    '− Сегмент': '− Segment',
    '1 сегмент': '1 segment',
    '↻ 90° по ч.с.': '↻ 90° CW',
    '↺ 90° против ч.с.': '↺ 90° CCW',
    '↔ По горизонтали': '↔ Horizontal',
    '↕ По вертикали': '↕ Vertical',
    'Загрузить файл': 'Upload file',
    'Загрузка...': 'Loading...',
    'Ошибка загрузки.': 'Loading error.',
    'Выберите слот (#1/#2), затем кликните по превью. Дальше перетаскивайте/масштабируйте.': 'Choose slot (#1/#2), then click a preview. Then drag/scale.',
    'Выберите слот (#1/#2/#3), затем кликните по превью. Дальше перетаскивайте/масштабируйте.': 'Choose slot (#1/#2/#3), then click a preview. Then drag/scale.',
    'Нет загруженных изображений.': 'No uploaded images.',
    'Нет загруженных изображений в разделе Original.': 'No uploaded images in Original section.',
    'Не удалось загрузить список изображений.': 'Failed to load image list.',
    'Не удалось загрузить 1280-картинку для Split.': 'Failed to load 1280 image for Split.',
    'Не удалось загрузить картинку для Split3.': 'Failed to load image for Split3.',
    'Не удалось определить размер поля.': 'Failed to determine stage size.',
    'Генерирую OknoFix...': 'Generating OknoFix...',
    'Генерирую OknoScale...': 'Generating OknoScale...',
    'Удалено.': 'Deleted.',
    'Удаляю...': 'Deleting...',
    'Загружаю список...': 'Loading list...',
    'Загружаю файл...': 'Uploading file...',
    'Загружаю файл из буфера обмена...': 'Uploading file from clipboard...',
    'Загружаю файл из перетаскивания...': 'Uploading file from drag and drop...',
    'Файл загружен.': 'File uploaded.',
    'Не выбран оригинал.': 'Original not selected.',
    'Обрезаю...': 'Cropping...',
    'Ошибка кадрирования.': 'Crop error.',
    'Ошибка оптимизации.': 'Optimization error.',
    'Можно выбрать максимум 15 файлов за раз.': 'You can select up to 15 files at once.',
    'Можно загрузить максимум 15 файлов за раз.': 'You can upload up to 15 files at once.',
    'Удалить результат': 'Delete result',
    '🇷🇺 Русский': '🇷🇺 Русский',

    'Edit создан.': 'Edit created.',
    'OknoFix создан.': 'OknoFix created.',
    'OknoScale создан.': 'OknoScale created.',
    'Split создан.': 'Split created.',
    'Split3 создан.': 'Split3 created.',
    'Results пока пуст.': 'Results are empty for now.',
    'Results пуст. Нажмите Refresh, если обработка завершилась только что.': 'Results are empty. Click Refresh if processing just finished.',
    'Видео загружено. Выберите отрезки на таймлайне и нажмите Сделать.': 'Video uploaded. Select timeline segments and click Process.',
    'Все изменения сброшены. Начните заново.': 'All edits were reset. Start again.',
    'Выберите две картинки.': 'Choose two images.',
    'Выберите изображение из верхнего списка.': 'Select an image from the upper list.',
    'Выберите отрезки на таймлайне и нажмите Сделать.': 'Select timeline segments and click Process.',
    'Готово.': 'Done.',
    'Готово. Результат появился в Processed.': 'Done. Result appeared in Processed.',
    'Готово. Ресайзы сброшены — их нужно создать заново.': 'Done. Resizes were reset and must be generated again.',
    'Двигайте и масштабируйте картинку под окном.': 'Move and scale the image under the window.',
    'Загружаю видео...': 'Uploading video...',
    'Загрузите видео и перетащите границы на таймлайне.': 'Upload a video and drag timeline boundaries.',
    'Настройте параметры и сохраните.': 'Adjust settings and save.',
    'Не удалось получить статус задачи': 'Failed to get job status',
    'Не удалось создать файл.': 'Failed to create file.',
    'Нет загрузок.': 'No uploads.',
    'Окно и рамка фиксированы по шаблону. Двигайте и масштабируйте картинку под окном.': 'Window and frame are fixed by template. Move and scale image under the window.',
    'Окно фиксировано по высоте и центрировано, ширину можно менять симметрично от центра.': 'Window height is fixed and centered; width can be changed symmetrically from center.',
    'Ошибка OknoFix.': 'OknoFix error.',
    'Ошибка OknoScale.': 'OknoScale error.',
    'Ошибка split.': 'Split error.',
    'Ошибка split3.': 'Split3 error.',
    'Ошибка сохранения.': 'Save error.',
    'Ошибка удаления.': 'Delete error.',
    'Превышено время ожидания завершения задачи': 'Job completion timeout exceeded',
    'Просмотр результата. Для обработки выберите оригинал.': 'Viewing result. Select original for processing.',
    'Сервер не вернул jobId': 'Server did not return jobId',
    'Задача завершилась со статусом': 'Job completed with status',
    'В очереди...': 'Queued...',
    'Нормализую формат для редактора...': 'Normalizing format for editor...',
    'Нормализую формат для редактора... прошло': 'Normalizing format for editor... elapsed',
    'осталось': 'left',
    'Ошибка загрузки видео.': 'Video upload error.',
    'Ошибка обработки видео.': 'Video processing error.',
    'Не удалось получить статус нормализации': 'Failed to get normalization status',
    'Превышено время ожидания нормализации видео': 'Video normalization timed out',
    'Скачать': 'Download',
    'Склеиваю...': 'Merging...',
    'Сначала выберите строку в таблице файлов.': 'First select a row in the files table.',
    'Сохраняю...': 'Saving...',
    'сегмент': 'segment',
    'сегмента': 'segments',
    'сегментов': 'segments',
    '— небольшое веб-приложение для загрузки и обработки изображений.': '— a small web app for uploading and processing images.',
    'Просмотр изображения': 'Image viewer',
    'Выбор изображений': 'Image selection',
    'Превью (1280)': 'Preview (1280)',
    'OknoFix шаблон': 'OknoFix template',
    'OknoScale шаблон': 'OknoScale template',
    'Масштаб картинки подложки': 'Background image zoom',
    'Выбор изображения для редактирования': 'Select image for editing',
    'Поле 1280×720 с тремя панелями...': '1280×720 stage with three panels...',
    'Убрать аудио': 'Mute audio',
    'Сбросить все изменения': 'Reset all changes',
    'Добавить сегмент': 'Add segment',
    'Удалить активный сегмент': 'Remove active segment',
    'Без звука': 'Mute',
    'Звук выключен': 'Muted',
    '— рабочий инструмент для быстрой подготовки изображений и видео в одном окне.': '— a practical tool for quickly preparing images and video in one place.',
    'Изображения + видео': 'Images + video',
    'История + автоочистка': 'History + auto-cleanup',
    'Быстрый старт': 'Quick start',
    'Файлы и таблицы': 'Files and tables',
    'Инструменты изображений': 'Image tools',
    'Полезные мелочи': 'Useful tips',
    'Нажмите на кнопку-дискету, перетащите файлы или вставьте изображение из буфера обмена (Ctrl+V).': 'Click the disk button, drag files, or paste an image from clipboard (Ctrl+V).',
    'Выберите язык в правом верхнем углу: русский, английский или испанский.': 'Choose language in the top-right corner: Russian, English, or Spanish.',
    'Клик по строке в таблице делает её активной для всех инструментов.': 'Clicking a table row makes it active for all tools.',
    'Слева: Original / Crop / размеры 1280, 1920, 2440.': 'Left: Original / Crop / sizes 1280, 1920, 2440.',
    'Справа: история Split, Split3, OknoFix, OknoScale, Edit и Video Edit.': 'Right: history of Split, Split3, OknoFix, OknoScale, Edit, and Video Edit.',
    'Любой результат можно открыть, скачать или удалить.': 'Any result can be opened, downloaded, or deleted.',
    '— кадрирование исходника (1:1, 2:3, 16:9).': '— crop source image (1:1, 2:3, 16:9).',
    '— компоновка 2 или 3 изображений в 1280×720 с белыми разделителями.': '— combine 2 or 3 images into 1280×720 with white dividers.',
    '— вертикальные карточки с позиционированием и масштабом под шаблон.': '— vertical cards with positioning and scaling for template.',
    '— тонкая настройка цвета, света, деталей и эффектов с сохранением результата как нового файла.': '— fine adjustments of color, light, details, and effects, saving as a new file.',
    'Trim с несколькими сегментами, Crop, Rotate, Flip, Speed, Mute и Reset.': 'Trim with multiple segments, Crop, Rotate, Flip, Speed, Mute, and Reset.',
    'Overlay Upload: загрузка PNG/WebP/JPEG шаблона поверх видео.': 'Overlay Upload: add PNG/WebP/JPEG template over video.',
    'Vidcov режим и быстрый выбор лимита размера (Episod 10/20/30 MB).': 'Vidcov mode and quick size limit selection (Episod 10/20/30 MB).',
    'Статусы обработки показывают очередь, прогресс и оставшееся время.': 'Processing statuses show queue, progress, and remaining time.',
    'Старые записи и файлы очищаются автоматически по времени хранения.': 'Old records and files are auto-cleaned by retention period.',
    'Если обработка завершилась только что, нажмите Refresh в Video Edit или обновите список результатов.': 'If processing just finished, click Refresh in Video Edit or refresh results list.',
    'Кнопка удаления удаляет запись и связанные файлы безвозвратно.': 'Delete button permanently removes record and related files.',
    'Обновить': 'Refresh',
  },
  'es-ES': {
    'Загрузить изображение': 'Subir imagen',
    'Нажмите на дискету, перетащите файлы или вставьте из буфера обмена — и они загрузятся.': 'Haz clic en el icono de disco, arrastra archivos o pega desde el portapapeles: se cargarán automáticamente.',
    'Справка': 'Ayuda',
    'Удаление': 'Eliminar',
    'Удалить': 'Eliminar',
    'Отмена': 'Cancelar',
    'Закрыть': 'Cerrar',
    'Сделать': 'Procesar',
    'Склеить': 'Combinar',
    'Обрезать': 'Recortar',
    'Открыть в новой вкладке': 'Abrir en pestaña nueva',
    'Открыть оригинал': 'Abrir original',
    'Просмотр': 'Vista previa',
    'Кадрирование': 'Recorte',
    'Выберите две картинки из готового размера 1280.': 'Elige dos imágenes del tamaño 1280.',
    'Выберите три картинки.': 'Elige tres imágenes.',
    'Выберите строку в таблице файлов, затем откройте OknoFix.': 'Selecciona una fila en la tabla y luego abre OknoFix.',
    'Выберите строку в таблице файлов, затем откройте OknoScale.': 'Selecciona una fila en la tabla y luego abre OknoScale.',
    'Двигайте и масштабируйте картинку под окном. Ширину окна можно менять ручками слева/справа.': 'Mueve y escala la imagen bajo la ventana. Puedes cambiar el ancho con las asas laterales.',
    'Справка по Jmaka': 'Ayuda de Jmaka',
    'Краткое описание всех функций и горячих действий.': 'Descripción breve de todas las funciones y acciones rápidas.',
    'Практическая шпаргалка по функциям, статусам и быстрым действиям.': 'Guía práctica de funciones, estados y acciones rápidas.',
    'Загрузка файлов': 'Carga de archivos',
    'Таблица файлов': 'Tabla de archivos',
    'Инструменты': 'Herramientas',
    'Прочее': 'Otros',
    'Дата - время': 'Fecha - hora',
    'Оригинал': 'Original',
    'Тип': 'Tipo',
    'Результат': 'Resultado',
    'Таблицы файлов': 'Tablas de archivos',
    'Готовые файлы': 'Archivos listos',
    'Размеры': 'Tamaños',
    'Панель управления': 'Panel de control',
    'Загрузка файла': 'Carga de archivo',
    'Можно включить обратно, очистив настройку в LocalStorage.': 'Puedes volver a activarlo limpiando la configuración en LocalStorage.',
    'Больше не спрашивать (удалять сразу)': 'No volver a preguntar (eliminar inmediatamente)',
    'Удалить запись и все связанные файлы безвозвратно?': '¿Eliminar este registro y todos los archivos relacionados de forma permanente?',
    'Выберите слот, затем кликните по превью из списка загруженных изображений:': 'Selecciona una ranura y luego haz clic en una vista previa de las imágenes subidas:',
    'Выбор для картинки 1': 'Seleccionar para imagen 1',
    'Выбор для картинки 2': 'Seleccionar para imagen 2',
    'Выбор для картинки 3': 'Seleccionar para imagen 3',
    'Левая половина': 'Mitad izquierda',
    'Правая половина': 'Mitad derecha',
    'Треть 1': 'Tercio 1',
    'Треть 2': 'Tercio 2',
    'Треть 3': 'Tercio 3',
    'Поле 16:9': 'Área 16:9',
    'Поле 1280×720. Перетаскивайте и масштабируйте изображения, пропорции сохраняются.': 'Área 1280×720. Arrastra y escala las imágenes manteniendo la proporción.',
    'Пропорции кадрирования': 'Relación de recorte',
    'Перетаскивайте рамку и её углы. Выберите пропорции:': 'Arrastra el marco y sus esquinas. Elige la proporción:',
    'Выбор языка': 'Selector de idioma',
    'Обрабатываю видео...': 'Procesando vídeo...',

    'Split (2 изображения → 16:9)': 'Split (2 imágenes → 16:9)',
    'Split3 (3 изображения → 16:9)': 'Split3 (3 imágenes → 16:9)',
    'OknoFix (1 изображение → вертикальная карточка)': 'OknoFix (1 imagen → tarjeta vertical)',
    'OknoScale (1 изображение → вертикальная карточка)': 'OknoScale (1 imagen → tarjeta vertical)',
    'Загрузка файлов': 'Carga de archivos',
    'Кнопка-дискета — выбор до 15 файлов за раз.': 'Botón de disco: selecciona hasta 15 archivos a la vez.',
    'Поддержка drag & drop: просто перетащите файлы на окно.': 'Soporta arrastrar y soltar: arrastra archivos a la ventana.',
    'Вставка из буфера обмена (Ctrl+V) для картинок.': 'Pegado desde portapapeles (Ctrl+V) para imágenes.',
    'Таблица файлов': 'Tabla de archivos',
    'Каждая строка — загруженное изображение (новые сверху).': 'Cada fila es una imagen subida (las nuevas arriba).',
    'В ячейке «Оригинал» — мини-preview + маленькая кнопка-дискета для скачивания.': 'En la celda «Original»: mini vista previa + botón pequeño de descarga.',
    'В ячейке «Оригинал» — миниатюра + маленькая кнопка-дискета для скачивания.': 'En la celda «Original»: miniatura + botón pequeño de descarga.',
    'Размеры 1280 / 1920 / 2440 создаются по клику по кнопкам сверху.': 'Los tamaños 1280 / 1920 / 2440 se crean con los botones de arriba.',
    'Крестик справа удаляет запись и все связанные файлы.': 'La cruz a la derecha elimina el registro y todos los archivos vinculados.',
    'Инструменты': 'Herramientas',
    '— кадрирование исходника с выбором пропорций (1:1, 2:3, 16:9).': '— recorte de imagen original con proporciones (1:1, 2:3, 16:9).',
    '— две картинки → одна 1280×720, белая полоса 7px по центру.': '— dos imágenes → una 1280×720, línea blanca de 7px en el centro.',
    '— три картинки → одна 1280×720, две белые полосы 7px.': '— tres imágenes → una 1280×720, dos líneas blancas de 7px.',
    '— вертикальная карточка по строгому PNG-шаблону:': '— tarjeta vertical según plantilla PNG estricta:',
    'режим фиксированного окна (как на исходном PNG);': 'modo de ventana fija (como en PNG original);',
    'картинка подложки двигается мышью и масштабируется пропорционально;': 'la imagen de fondo se mueve con el ratón y escala proporcionalmente;',
    'масштаб — через колесо мыши или кнопки «−»/«+» внизу справа.': 'zoom con rueda del ratón o botones «−»/«+» abajo a la derecha.',
    '— экспериментальный режим той же карточки с изменяемой шириной окна.': '— modo experimental de la misma tarjeta con ancho de ventana ajustable.',
    '— редактирование изображений с настройкой яркости, контраста, насыщенности, оттенка, экспозиции и вибрации.': '— edición de imágenes con brillo, contraste, saturación, tono, exposición y vibración.',
    '— редактирование видео с инструментами:': '— edición de vídeo con herramientas:',
    '— обрезка начала/конца и вырезание сегментов из середины;': '— recorte de inicio/fin y corte de segmentos del medio;',
    '— кадрирование видео;': '— recorte de vídeo;',
    '— поворот на 90°, 180° или 270°;': '— rotación a 90°, 180° o 270°;',
    '— отражение по горизонтали или вертикали;': '— volteo horizontal o vertical;',
    '— изменение скорости (0.25x - 2.0x);': '— cambio de velocidad (0.25x - 2.0x);',
    '— отключение звука;': '— silenciar audio;',
    '— сброс всех изменений.': '— restablecer todos los cambios.',
    'Прочее': 'Otros',
    'История Split / Split3 / OknoFix / OknoScale / Edit / Video Edit — в правой таблице.': 'El historial de Split / Split3 / OknoFix / OknoScale / Edit / Video Edit está en la tabla derecha.',
    'Каждый результат можно открыть, скачать или удалить.': 'Cada resultado se puede abrir, descargar o eliminar.',
    'Старые записи и файлы автоматически очищаются по времени хранения.': 'Los registros y archivos antiguos se limpian automáticamente por tiempo de retención.',
    'Используйте таймлайн ниже для выбора сегментов видео': 'Usa la línea de tiempo para seleccionar segmentos de vídeo',
    'Перетащите границы, чтобы задать отрезок.': 'Arrastra los bordes para definir el segmento.',
    'Перетащите углы рамки для кадрирования видео': 'Arrastra las esquinas del marco para recortar vídeo',
    'Тримминг, кадрирование, поворот и настройка размера.': 'Recorte, recorte de área, rotación y ajuste de tamaño.',
    'Правки применяются в реальном времени, сохранение — на сервере.': 'Los cambios se aplican en tiempo real, el guardado se hace en el servidor.',
    'Скорость:': 'Velocidad:',
    'Сбросить': 'Restablecer',
    'Сохранить': 'Guardar',
    '+ Сегмент': '+ Segmento',
    '− Сегмент': '− Segmento',
    '1 сегмент': '1 segmento',
    '↻ 90° по ч.с.': '↻ 90° horario',
    '↺ 90° против ч.с.': '↺ 90° antihorario',
    '↔ По горизонтали': '↔ Horizontal',
    '↕ По вертикали': '↕ Vertical',
    'Загрузить файл': 'Subir archivo',
    'Загрузка...': 'Cargando...',
    'Ошибка загрузки.': 'Error de carga.',
    'Выберите слот (#1/#2), затем кликните по превью. Дальше перетаскивайте/масштабируйте.': 'Elige ranura (#1/#2), luego pulsa una vista previa. Después arrastra/escala.',
    'Выберите слот (#1/#2/#3), затем кликните по превью. Дальше перетаскивайте/масштабируйте.': 'Elige ranura (#1/#2/#3), luego pulsa una vista previa. Después arrastra/escala.',
    'Нет загруженных изображений.': 'No hay imágenes subidas.',
    'Нет загруженных изображений в разделе Original.': 'No hay imágenes subidas en la sección Original.',
    'Не удалось загрузить список изображений.': 'No se pudo cargar la lista de imágenes.',
    'Не удалось загрузить 1280-картинку для Split.': 'No se pudo cargar la imagen 1280 para Split.',
    'Не удалось загрузить картинку для Split3.': 'No se pudo cargar la imagen para Split3.',
    'Не удалось определить размер поля.': 'No se pudo determinar el tamaño del área.',
    'Генерирую OknoFix...': 'Generando OknoFix...',
    'Генерирую OknoScale...': 'Generando OknoScale...',
    'Удалено.': 'Eliminado.',
    'Удаляю...': 'Eliminando...',
    'Загружаю список...': 'Cargando lista...',
    'Загружаю файл...': 'Subiendo archivo...',
    'Загружаю файл из буфера обмена...': 'Subiendo archivo desde portapapeles...',
    'Загружаю файл из перетаскивания...': 'Subiendo archivo por arrastrar y soltar...',
    'Файл загружен.': 'Archivo subido.',
    'Не выбран оригинал.': 'No se seleccionó original.',
    'Обрезаю...': 'Recortando...',
    'Ошибка кадрирования.': 'Error de recorte.',
    'Ошибка оптимизации.': 'Error de optimización.',
    'Можно выбрать максимум 15 файлов за раз.': 'Puedes seleccionar máximo 15 archivos a la vez.',
    'Можно загрузить максимум 15 файлов за раз.': 'Puedes subir máximo 15 archivos a la vez.',
    'Удалить результат': 'Eliminar resultado',
    'Русский': 'Русский',
    'Таблица Split': 'Tabla Split',
    '🇷🇺 Русский': '🇷🇺 Русский',

    'Edit создан.': 'Edit creado.',
    'OknoFix создан.': 'OknoFix creado.',
    'OknoScale создан.': 'OknoScale creado.',
    'Split создан.': 'Split creado.',
    'Split3 создан.': 'Split3 creado.',
    'Results пока пуст.': 'Results aún está vacío.',
    'Results пуст. Нажмите Refresh, если обработка завершилась только что.': 'Results está vacío. Pulsa Refresh si el procesamiento terminó hace un momento.',
    'Видео загружено. Выберите отрезки на таймлайне и нажмите Сделать.': 'Vídeo subido. Selecciona segmentos en la línea de tiempo y pulsa Procesar.',
    'Все изменения сброшены. Начните заново.': 'Todos los cambios se restablecieron. Empieza de nuevo.',
    'Выберите две картинки.': 'Elige dos imágenes.',
    'Выберите изображение из верхнего списка.': 'Selecciona una imagen de la lista superior.',
    'Выберите отрезки на таймлайне и нажмите Сделать.': 'Selecciona segmentos en la línea de tiempo y pulsa Procesar.',
    'Готово.': 'Listo.',
    'Готово. Результат появился в Processed.': 'Listo. El resultado apareció en Processed.',
    'Готово. Ресайзы сброшены — их нужно создать заново.': 'Listo. Los tamaños se reiniciaron y deben crearse de nuevo.',
    'Двигайте и масштабируйте картинку под окном.': 'Mueve y escala la imagen bajo la ventana.',
    'Загружаю видео...': 'Subiendo vídeo...',
    'Загрузите видео и перетащите границы на таймлайне.': 'Sube un vídeo y arrastra los límites en la línea de tiempo.',
    'Настройте параметры и сохраните.': 'Ajusta los parámetros y guarda.',
    'Не удалось получить статус задачи': 'No se pudo obtener el estado de la tarea',
    'Не удалось создать файл.': 'No se pudo crear el archivo.',
    'Нет загрузок.': 'No hay cargas.',
    'Окно и рамка фиксированы по шаблону. Двигайте и масштабируйте картинку под окном.': 'La ventana y el marco son fijos por plantilla. Mueve y escala la imagen bajo la ventana.',
    'Окно фиксировано по высоте и центрировано, ширину можно менять симметрично от центра.': 'La altura de la ventana es fija y centrada; el ancho se puede cambiar simétricamente desde el centro.',
    'Ошибка OknoFix.': 'Error de OknoFix.',
    'Ошибка OknoScale.': 'Error de OknoScale.',
    'Ошибка split.': 'Error de Split.',
    'Ошибка split3.': 'Error de Split3.',
    'Ошибка сохранения.': 'Error al guardar.',
    'Ошибка удаления.': 'Error al eliminar.',
    'Превышено время ожидания завершения задачи': 'Se excedió el tiempo de espera de finalización de la tarea',
    'Просмотр результата. Для обработки выберите оригинал.': 'Viendo resultado. Selecciona el original para procesar.',
    'Сервер не вернул jobId': 'El servidor no devolvió jobId',
    'Задача завершилась со статусом': 'La tarea finalizó con estado',
    'В очереди...': 'En cola...',
    'Нормализую формат для редактора...': 'Normalizando formato para el editor...',
    'Нормализую формат для редактора... прошло': 'Normalizando formato para el editor... transcurrido',
    'осталось': 'restante',
    'Ошибка загрузки видео.': 'Error de carga de vídeo.',
    'Ошибка обработки видео.': 'Error de procesamiento de vídeo.',
    'Не удалось получить статус нормализации': 'No se pudo obtener el estado de normalización',
    'Превышено время ожидания нормализации видео': 'Se agotó el tiempo de espera de normalización de vídeo',
    'Скачать': 'Descargar',
    'Склеиваю...': 'Combinando...',
    'Сначала выберите строку в таблице файлов.': 'Primero selecciona una fila en la tabla de archivos.',
    'Сохраняю...': 'Guardando...',
    'сегмент': 'segmento',
    'сегмента': 'segmentos',
    'сегментов': 'segmentos',
    '— небольшое веб-приложение для загрузки и обработки изображений.': '— una pequeña aplicación web para cargar y procesar imágenes.',
    'Просмотр изображения': 'Visor de imagen',
    'Выбор изображений': 'Selección de imágenes',
    'Превью (1280)': 'Vista previa (1280)',
    'OknoFix шаблон': 'Plantilla OknoFix',
    'OknoScale шаблон': 'Plantilla OknoScale',
    'Масштаб картинки подложки': 'Zoom de imagen de fondo',
    'Выбор изображения для редактирования': 'Seleccionar imagen para editar',
    'Поле 1280×720 с тремя панелями...': 'Área 1280×720 con tres paneles...',
    'Убрать аудио': 'Silenciar audio',
    'Сбросить все изменения': 'Restablecer todos los cambios',
    'Добавить сегмент': 'Añadir segmento',
    'Удалить активный сегмент': 'Eliminar segmento activo',
    'Без звука': 'Silenciar',
    'Звук выключен': 'Silenciado',
    '— рабочий инструмент для быстрой подготовки изображений и видео в одном окне.': '— una herramienta práctica para preparar imágenes y vídeo rápidamente en un solo lugar.',
    'Изображения + видео': 'Imágenes + vídeo',
    'История + автоочистка': 'Historial + autolimpieza',
    'Быстрый старт': 'Inicio rápido',
    'Файлы и таблицы': 'Archivos y tablas',
    'Инструменты изображений': 'Herramientas de imagen',
    'Полезные мелочи': 'Consejos útiles',
    'Нажмите на кнопку-дискету, перетащите файлы или вставьте изображение из буфера обмена (Ctrl+V).': 'Pulsa el botón de disco, arrastra archivos o pega una imagen desde el portapapeles (Ctrl+V).',
    'Выберите язык в правом верхнем углу: русский, английский или испанский.': 'Elige idioma en la esquina superior derecha: ruso, inglés o español.',
    'Клик по строке в таблице делает её активной для всех инструментов.': 'Al pulsar una fila de la tabla, queda activa para todas las herramientas.',
    'Слева: Original / Crop / размеры 1280, 1920, 2440.': 'Izquierda: Original / Crop / tamaños 1280, 1920, 2440.',
    'Справа: история Split, Split3, OknoFix, OknoScale, Edit и Video Edit.': 'Derecha: historial de Split, Split3, OknoFix, OknoScale, Edit y Video Edit.',
    'Любой результат можно открыть, скачать или удалить.': 'Cualquier resultado se puede abrir, descargar o eliminar.',
    '— кадрирование исходника (1:1, 2:3, 16:9).': '— recorte de imagen original (1:1, 2:3, 16:9).',
    '— компоновка 2 или 3 изображений в 1280×720 с белыми разделителями.': '— composición de 2 o 3 imágenes en 1280×720 con separadores blancos.',
    '— вертикальные карточки с позиционированием и масштабом под шаблон.': '— tarjetas verticales con posicionamiento y escala según plantilla.',
    '— тонкая настройка цвета, света, деталей и эффектов с сохранением результата как нового файла.': '— ajuste fino de color, luz, detalle y efectos guardando el resultado como archivo nuevo.',
    'Trim с несколькими сегментами, Crop, Rotate, Flip, Speed, Mute и Reset.': 'Trim con múltiples segmentos, Crop, Rotate, Flip, Speed, Mute y Reset.',
    'Overlay Upload: загрузка PNG/WebP/JPEG шаблона поверх видео.': 'Overlay Upload: carga una plantilla PNG/WebP/JPEG sobre el vídeo.',
    'Vidcov режим и быстрый выбор лимита размера (Episod 10/20/30 MB).': 'Modo Vidcov y selección rápida de límite de tamaño (Episod 10/20/30 MB).',
    'Статусы обработки показывают очередь, прогресс и оставшееся время.': 'Los estados de procesamiento muestran cola, progreso y tiempo restante.',
    'Старые записи и файлы очищаются автоматически по времени хранения.': 'Los registros y archivos antiguos se limpian automáticamente por retención.',
    'Если обработка завершилась только что, нажмите Refresh в Video Edit или обновите список результатов.': 'Si el procesamiento terminó hace un momento, pulsa Refresh en Video Edit o actualiza la lista de resultados.',
    'Кнопка удаления удаляет запись и связанные файлы безвозвратно.': 'El botón eliminar borra permanentemente el registro y los archivos relacionados.',
    'Обновить': 'Actualizar',
  }
};

function normalizeLang(lang) {
  if (!lang) return 'ru';
  if (lang === 'en' || lang === 'en-US') return 'en-US';
  if (lang === 'es' || lang === 'es-ES') return 'es-ES';
  return 'ru';
}

function getCurrentLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored) return normalizeLang(stored);
  } catch {}
  return 'ru';
}

let currentLanguage = getCurrentLanguage();

const REVERSE_PHRASE_TRANSLATIONS = (() => {
  const out = {};
  Object.entries(PHRASE_TRANSLATIONS).forEach(([lang, dict]) => {
    const rev = {};
    Object.entries(dict).forEach(([ru, translated]) => {
      if (translated) rev[translated] = ru;
    });
    out[lang] = rev;
  });
  return out;
})();

function toRussianBaseText(source) {
  if (!source) return source;
  if (PHRASE_TRANSLATIONS['en-US'] && REVERSE_PHRASE_TRANSLATIONS['en-US'][source]) {
    return REVERSE_PHRASE_TRANSLATIONS['en-US'][source];
  }
  if (PHRASE_TRANSLATIONS['es-ES'] && REVERSE_PHRASE_TRANSLATIONS['es-ES'][source]) {
    return REVERSE_PHRASE_TRANSLATIONS['es-ES'][source];
  }
  return source;
}

// Precompiled regex patterns for whitespace handling in translations
const LEADING_WHITESPACE_REGEX = /^\s*/;
const TRAILING_WHITESPACE_REGEX = /\s*$/;

function translateText(sourceText, lang = currentLanguage) {
  const source = String(sourceText || '');
  if (!source) return source;
  const ruBase = toRussianBaseText(source);
  if (lang === 'ru') return ruBase;
  const dict = PHRASE_TRANSLATIONS[lang] || {};
  
  // Try exact match first
  let result = dict[ruBase] || dict[source];
  if (result) return result;
  
  // If no match and source has leading/trailing whitespace, try trimmed version.
  // This handles text nodes after HTML tags (e.g., "<strong>Crop</strong> — text")
  // where the text node has a leading space. We preserve the original whitespace
  // pattern in the translated output.
  const trimmed = source.trim();
  if (trimmed !== source) {
    // Extract whitespace once before looking up translation
    const leadingSpace = source.match(LEADING_WHITESPACE_REGEX)?.[0] || '';
    const trailingSpace = source.match(TRAILING_WHITESPACE_REGEX)?.[0] || '';
    const ruBaseTrimmed = toRussianBaseText(trimmed);
    const translatedTrimmed = dict[ruBaseTrimmed] || dict[trimmed];
    if (translatedTrimmed) {
      // Preserve leading/trailing whitespace from the original source
      return leadingSpace + translatedTrimmed + trailingSpace;
    }
  }
  
  return source;
}

function t(keyOrText) {
  const key = String(keyOrText || '');
  return (UI_TEXTS[currentLanguage] && UI_TEXTS[currentLanguage][key])
    || (UI_TEXTS.ru && UI_TEXTS.ru[key])
    || translateText(key);
}

const I18N_ATTRS = ['aria-label', 'title', 'placeholder'];
const i18nTextSource = new WeakMap();
const i18nAttrSource = new WeakMap();
let i18nIsApplying = false;
let i18nObserverStarted = false;

function translateTextNode(node) {
  if (!node) return;
  const original = i18nTextSource.has(node) ? i18nTextSource.get(node) : node.textContent;
  if (!i18nTextSource.has(node)) i18nTextSource.set(node, original);
  const translated = translateText(original);
  if (node.textContent !== translated) node.textContent = translated;
}

function translateElementAttributes(el) {
  if (!el || !el.getAttribute) return;
  let src = i18nAttrSource.get(el);
  if (!src) {
    src = {};
    i18nAttrSource.set(el, src);
  }
  for (const attr of I18N_ATTRS) {
    const current = el.getAttribute(attr);
    if (current == null) continue;
    if (!(attr in src)) src[attr] = current;
    const translated = translateText(src[attr]);
    if (current !== translated) el.setAttribute(attr, translated);
  }
}

function translateDomSubtree(root) {
  if (!root) return;
  i18nIsApplying = true;
  try {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      const element = root;
      if (element.tagName !== 'SCRIPT' && element.tagName !== 'STYLE') {
        translateElementAttributes(element);
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_SKIP;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_SKIP;
        const pTag = parent.tagName;
        if (pTag === 'SCRIPT' || pTag === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else if (node.nodeType === Node.ELEMENT_NODE) translateElementAttributes(node);
      node = walker.nextNode();
    }
  } finally {
    i18nIsApplying = false;
  }
}

function ensureI18nObserver() {
  if (i18nObserverStarted || !document.body || typeof MutationObserver === 'undefined') return;
  i18nObserverStarted = true;
  const observer = new MutationObserver((mutations) => {
    if (i18nIsApplying) return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const node = mutation.target;
        i18nTextSource.set(node, node.data);
        if (currentLanguage !== 'ru') {
          const translated = translateText(node.data);
          if (translated !== node.data) {
            i18nIsApplying = true;
            try { node.data = translated; } finally { i18nIsApplying = false; }
          }
        }
      }
      if (mutation.type === 'attributes' && mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
        const el = mutation.target;
        const attr = mutation.attributeName;
        if (attr && I18N_ATTRS.includes(attr)) {
          let src = i18nAttrSource.get(el);
          if (!src) { src = {}; i18nAttrSource.set(el, src); }
          src[attr] = el.getAttribute(attr) || '';
          if (currentLanguage !== 'ru') {
            const translated = translateText(src[attr]);
            if (translated !== src[attr]) {
              i18nIsApplying = true;
              try { el.setAttribute(attr, translated); } finally { i18nIsApplying = false; }
            }
          }
        }
      }
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            translateDomSubtree(node);
          }
        });
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: I18N_ATTRS
  });
}

window.JMAKA_I18N = {
  t,
  getLanguage: () => currentLanguage,
  translateText,
  setLanguage: (lang) => {
    currentLanguage = normalizeLang(lang);
    try { localStorage.setItem(LANGUAGE_KEY, currentLanguage); } catch {}
    applyLanguage();
    try { window.dispatchEvent(new CustomEvent('jmaka:language-changed', { detail: { language: currentLanguage } })); } catch {}
  }
};

function applyLanguage() {
  ensureI18nObserver();
  const switcher = document.getElementById('languageSwitcher');
  if (switcher) switcher.setAttribute('aria-label', t('languageLabel'));
  document.querySelectorAll('#languageSwitcher .lang-btn').forEach((btn) => {
    const isActive = btn.dataset.lang === currentLanguage;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  document.documentElement.lang = currentLanguage === 'ru' ? 'ru' : (currentLanguage === 'es-ES' ? 'es' : 'en');
  translateDomSubtree(document.body);
}

function initLanguageButtons() {
  const switcher = document.getElementById('languageSwitcher');
  if (!switcher) return;
  switcher.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('.lang-btn') : null;
    if (!btn) return;
    const lang = btn.dataset.lang;
    if (!lang || lang === currentLanguage) return;
    window.JMAKA_I18N.setLanguage(lang);
    queueMicrotask(() => applyLanguage());
    setTimeout(() => applyLanguage(), 0);
  });
}

// viewer modal elements
// RU: Элементы модального окна просмотра полноразмерной картинки.
// EN: DOM elements for the image viewer modal used when clicking previews.
const viewerModal = document.getElementById('viewerModal');
const viewerCloseBtn = document.getElementById('viewerClose');
const viewerImg = document.getElementById('viewerImg');
const viewerLabel = document.getElementById('viewerLabel');
const viewerOpen = document.getElementById('viewerOpen');

function getBasePath() {
  const path = window.location.pathname || '/';
  if (path.endsWith('/')) return path;

  const lastSegment = path.split('/').pop();
  if (lastSegment && !lastSegment.includes('.')) {
    return `${path}/`;
  }

  const lastSlash = path.lastIndexOf('/');
  if (lastSlash >= 0) return path.slice(0, lastSlash + 1) || '/';
  return '/';
}

function toAbsoluteUrl(url) {
  if (!url) return url;
  const raw = String(url);
  if (/^[a-z]+:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  if (raw.startsWith('/')) return raw;
  return `${getBasePath()}${raw}`;
}

function buildApiUrlCandidates(relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  if (!clean) return [];
  const candidates = [];
  const primary = toAbsoluteUrl(clean);
  if (primary) candidates.push(primary);

  const root = `/${clean}`;
  if (!candidates.includes(root)) candidates.push(root);

  const base = getBasePath();
  if (base && base !== '/') {
    const baseClean = base.endsWith('/') ? base : `${base}/`;
    const baseUrl = `${baseClean}${clean}`;
    if (!candidates.includes(baseUrl)) candidates.push(baseUrl);
  }

  return candidates;
}

async function fetchWithFallback(relativePath, options) {
  const candidates = buildApiUrlCandidates(relativePath);
  let lastRes = null;
  for (const url of candidates) {
    const res = await fetch(url, options);
    if (res.status !== 404) return res;
    lastRes = res;
  }
  return lastRes || fetch(toAbsoluteUrl(relativePath), options);
}

function isLikelyImageUrl(url) {
  if (!url) return false;
  // Strip query/hash (we often add ?v=... for cache-busting)
  const raw = String(url);
  const base = raw.split('?')[0].split('#')[0].toLowerCase();
  return base.endsWith('.jpg')
    || base.endsWith('.jpeg')
    || base.endsWith('.png')
    || base.endsWith('.webp')
    || base.endsWith('.gif')
    || base.endsWith('.bmp');
}

function openViewer(href, label) {
  if (!href) return;
  if (!viewerModal || !viewerImg) {
    window.open(href, '_blank', 'noreferrer');
    return;
  }

  viewerModal.hidden = false;
  viewerImg.src = href;
  viewerImg.alt = label || 'image';

  if (viewerLabel) {
    viewerLabel.textContent = label || href;
  }
  if (viewerOpen) {
    viewerOpen.href = href;
    viewerOpen.hidden = false;
  }
}

function closeViewer() {
  if (!viewerModal) return;
  viewerModal.hidden = true;
  if (viewerImg) {
    viewerImg.removeAttribute('src');
    viewerImg.alt = '';
  }
  if (viewerLabel) viewerLabel.textContent = '';
  if (viewerOpen) {
    viewerOpen.href = '#';
    viewerOpen.hidden = true;
  }
}

if (viewerModal) {
  viewerModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeViewer();
    }
  });
}
if (viewerCloseBtn) viewerCloseBtn.addEventListener('click', closeViewer);

// Intercept clicks on preview/size links in the table and show in-app viewer
// RU: Перехватываем клики по превью/ссылкам размеров в левой таблице и открываем встроенный просмотрщик.
// EN: Intercept clicks on preview/size links in the left table and open the built‑in viewer instead of new tabs.
if (filesTbody) {
  filesTbody.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    // Only intercept for image links.
    if (!isLikelyImageUrl(href)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Try to provide a short label
    const label = a.textContent && a.textContent.trim() ? a.textContent.trim() : href;
    openViewer(href, label);
  });
}

// Intercept clicks in composites table (right column) and open in viewer as well
// RU: То же самое для правой таблицы (Split / Split3 / OknoFix / OknoScale).
// EN: Do the same for the right table with Split/Split3/OknoFix/OknoScale results.
if (compositesTbody) {
  compositesTbody.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    if (!isLikelyImageUrl(href)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const label = a.textContent && a.textContent.trim() ? a.textContent.trim() : href;
    openViewer(href, label);
  });
}

// delete modal elements
// RU: Модальное окно подтверждения удаления строки истории.
// EN: Confirmation modal shown before deleting a history row and all related files.
const deleteModal = document.getElementById('deleteModal');
const deleteCloseBtn = document.getElementById('deleteClose');
const deleteCancelBtn = document.getElementById('deleteCancel');
const deleteConfirmBtn = document.getElementById('deleteConfirm');
const deleteSkipConfirmEl = document.getElementById('deleteSkipConfirm');

// help modal
// RU: Модальное окно со справкой по возможностям приложения и горячим действиям.
// EN: Help modal that briefly describes features and hot actions.
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const helpCloseBtn = document.getElementById('helpClose');

const DELETE_SKIP_KEY = 'jmaka_delete_skip_confirm';

function getDeleteSkipConfirm() {
  try { return localStorage.getItem(DELETE_SKIP_KEY) === '1'; } catch { return false; }
}

function setDeleteSkipConfirm(v) {
  try { localStorage.setItem(DELETE_SKIP_KEY, v ? '1' : '0'); } catch { /* ignore */ }
}

let pendingDeleteResolve = null;

function closeDeleteModal(ok) {
  if (!deleteModal) return;
  deleteModal.hidden = true;
  const r = pendingDeleteResolve;
  pendingDeleteResolve = null;

  if (ok && deleteSkipConfirmEl && deleteSkipConfirmEl.checked) {
    setDeleteSkipConfirm(true);
  }

  if (deleteSkipConfirmEl) {
    deleteSkipConfirmEl.checked = false;
  }

  if (r) r(!!ok);
}

function confirmDeleteAsync(storedName) {
  if (getDeleteSkipConfirm()) {
    return Promise.resolve(true);
  }

  if (!deleteModal) {
    // fallback
    return Promise.resolve(confirm(t('deleteConfirm')));
  }

  deleteModal.hidden = false;

  return new Promise((resolve) => {
    pendingDeleteResolve = resolve;
  });
}

if (deleteModal) {
  // backdrop click
  deleteModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeDeleteModal(false);
    }
  });
}
if (deleteCloseBtn) deleteCloseBtn.addEventListener('click', () => closeDeleteModal(false));
if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', () => closeDeleteModal(false));
if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', () => closeDeleteModal(true));
initLanguageButtons();
applyLanguage();

// help modal wiring
if (helpBtn && helpModal) {
  const openHelp = () => {
    helpModal.hidden = false;
  };
  const closeHelp = () => {
    helpModal.hidden = true;
  };

  helpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openHelp();
  });

  if (helpCloseBtn) {
    helpCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeHelp();
    });
  }

  helpModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeHelp();
    }
  });
}

// crop modal elements
// RU: Элементы окна кадрирования (Crop) и кнопки выбора соотношения сторон.
// EN: Elements of the Crop dialog and aspect‑ratio buttons.
const cropModal = document.getElementById('cropModal');
const cropStage = document.getElementById('cropStage');
const cropImg = document.getElementById('cropImg');
const cropRectEl = document.getElementById('cropRect');
const cropApplyBtn = document.getElementById('cropApply');
const cropCancelBtn = document.getElementById('cropCancel');
const cropCloseBtn = document.getElementById('cropClose');
const cropSourceLabel = document.getElementById('cropSourceLabel');
const cropOpenOriginal = document.getElementById('cropOpenOriginal');
const cropAspectBtns = cropModal ? Array.from(cropModal.querySelectorAll('button.aspect-btn')) : [];

// tool buttons (Crop/Split)
// RU: Панель инструментов для активной строки (Split, Split3, OknoFix, OknoScale, Crop).
// EN: Tool buttons row bound to the currently selected upload (Split, Split3, OknoFix, OknoScale, Crop).
const toolButtons = document.querySelector('.tool-buttons');
const cropToolBtn = document.getElementById('cropToolBtn');
const splitToolBtn = document.getElementById('splitToolBtn');
const imageEditToolBtn = document.getElementById('imageEditToolBtn');
const videoEditToolBtn = document.getElementById('videoEditToolBtn');

// split modal elements
// RU: Окно Split: две половины 16:9, галерея миниатюр 1280 и элементы управления.
// EN: Split modal: two 16:9 halves, 1280‑width thumbnail gallery and controls.
const splitModal = document.getElementById('splitModal');
const splitCloseBtn = document.getElementById('splitClose');
const splitCancelBtn = document.getElementById('splitCancel');
const splitApplyBtn = document.getElementById('splitApply');
const splitPickTargetA = document.getElementById('splitPickTargetA');
const splitPickTargetB = document.getElementById('splitPickTargetB');
const splitTargetImgA = document.getElementById('splitTargetImgA');
const splitTargetImgB = document.getElementById('splitTargetImgB');
const splitGallery = document.getElementById('splitGallery');
const splitStage = document.getElementById('splitStage');
const splitHalfLeft = document.getElementById('splitHalfLeft');
const splitHalfRight = document.getElementById('splitHalfRight');
const splitItemA = document.getElementById('splitItemA');
const splitItemB = document.getElementById('splitItemB');
const splitHint = document.getElementById('splitHint');

// split3 modal elements
// RU: Окно Split3: три колонки 16:9 и соответствующие галереи/слоты.
// EN: Split3 modal: three 16:9 columns with their own slots and gallery.
const split3ToolBtn = document.getElementById('split3ToolBtn');
const split3Modal = document.getElementById('split3Modal');
const split3CloseBtn = document.getElementById('split3Close');
const split3CancelBtn = document.getElementById('split3Cancel');
const split3ApplyBtn = document.getElementById('split3Apply');
const split3PickTargetA = document.getElementById('split3PickTargetA');
const split3PickTargetB = document.getElementById('split3PickTargetB');
const split3PickTargetC = document.getElementById('split3PickTargetC');
const split3TargetImgA = document.getElementById('split3TargetImgA');
const split3TargetImgB = document.getElementById('split3TargetImgB');
const split3TargetImgC = document.getElementById('split3TargetImgC');
const split3Gallery = document.getElementById('split3Gallery');
const split3Stage = document.getElementById('split3Stage');
const split3ThirdA = document.getElementById('split3ThirdA');
const split3ThirdB = document.getElementById('split3ThirdB');
const split3ThirdC = document.getElementById('split3ThirdC');
const split3ItemA = document.getElementById('split3ItemA');
const split3ItemB = document.getElementById('split3ItemB');
const split3ItemC = document.getElementById('split3ItemC');
const split3Hint = document.getElementById('split3Hint');

// OknoFix elements
// RU: Элементы модалки OknoFix (жёсткий PNG‑шаблон вертикальной карточки).
// EN: Elements of the OknoFix modal that uses a fixed PNG card template.
const oknoScaleToolBtn = document.getElementById('oknoScaleToolBtn');
const oknoFixToolBtn = document.getElementById('oknoFixToolBtn');
const oknoFixModal = document.getElementById('oknoFixModal');
const oknoFixCloseBtn = document.getElementById('oknoFixClose');
const oknoFixCancelBtn = document.getElementById('oknoFixCancel');
const oknoFixApplyBtn = document.getElementById('oknoFixApply');
const oknoFixStage = document.getElementById('oknoFixStage');
const oknoFixCard = document.getElementById('oknoFixCard');
const oknoFixImgViewport = document.getElementById('oknoFixImgViewport');
const oknoFixImg = document.getElementById('oknoFixImg');
// Ручки изменения ширины окна больше не используются (окно фиксировано) для OknoFix
const oknoFixHandleLeft = null;
const oknoFixHandleRight = null;
const oknoFixHint = document.getElementById('oknoFixHint');
const oknoFixZoomInBtn = document.getElementById('oknoFixZoomIn');
const oknoFixZoomOutBtn = document.getElementById('oknoFixZoomOut');

// OknoScale elements (отдельная модалка)
// RU: Элементы модалки OknoScale с изменяемой шириной окна.
// EN: Elements of the OknoScale modal with adjustable window width.
const oknoScaleModal = document.getElementById('oknoScaleModal');
const oknoScaleCloseBtn = document.getElementById('oknoScaleClose');
const oknoScaleCancelBtn = document.getElementById('oknoScaleCancel');
const oknoScaleApplyBtn = document.getElementById('oknoScaleApply');
const oknoScaleStage = document.getElementById('oknoScaleStage');
const oknoScaleCard = document.getElementById('oknoScaleCard');
const oknoScaleImgViewport = document.getElementById('oknoScaleImgViewport');
const oknoScaleImg = document.getElementById('oknoScaleImg');
const oknoScaleHandleLeft = document.getElementById('oknoScaleHandleLeft');
const oknoScaleHandleRight = document.getElementById('oknoScaleHandleRight');
const oknoScaleHint = document.getElementById('oknoScaleHint');
const oknoScaleZoomInBtn = document.getElementById('oknoScaleZoomIn');
const oknoScaleZoomOutBtn = document.getElementById('oknoScaleZoomOut');

// Image Edit modal elements
const imageEditModal = document.getElementById('imageEditModal');
const imageEditCloseBtn = document.getElementById('imageEditClose');
const imageEditCancelBtn = document.getElementById('imageEditCancel');
const imageEditApplyBtn = document.getElementById('imageEditApply');
const imageEditCanvas = document.getElementById('imageEditCanvas');
const imageEditOriginal = document.getElementById('imageEditOriginal');
const imageEditCompareBtn = document.getElementById('imageEditCompare');
const imageEditHint = document.getElementById('imageEditHint');
const imageEditTopList = document.getElementById('imageEditTopList');
const imageEditRefreshTop = document.getElementById('imageEditRefreshTop');
const editBrightness = document.getElementById('editBrightness');
const editContrast = document.getElementById('editContrast');
const editSaturation = document.getElementById('editSaturation');
const editHue = document.getElementById('editHue');
const editExposure = document.getElementById('editExposure');
const editVibrance = document.getElementById('editVibrance');
const imageEditPresetBtns = imageEditModal ? imageEditModal.querySelectorAll('.preset-btn') : [];
const imageEditSliderRows = imageEditModal ? imageEditModal.querySelectorAll('.slider-row') : [];
const imageEditPanelHeaders = imageEditModal ? imageEditModal.querySelectorAll('.edit-panel-header') : [];


function syncCropAspectButtons() {
  if (!cropAspectBtns || cropAspectBtns.length === 0) return;
  for (const b of cropAspectBtns) {
    const aw = Number(b.dataset.aw);
    const ah = Number(b.dataset.ah);
    const label = (aw > 0 && ah > 0) ? `${aw}:${ah}` : '';
    b.classList.toggle('is-active', label === (cropState && cropState.aspectLabel));
  }
}

function setCropAspect(aw, ah) {
  if (!aw || !ah || aw <= 0 || ah <= 0) return;
  cropState.aspect = aw / ah;
  cropState.aspectLabel = `${aw}:${ah}`;
  syncCropAspectButtons();

  // If modal is open and we already computed the image box, re-init the rect for the new aspect.
  if (cropState.open && cropState.imgBox) {
    initCropRect();
  }
}

const TARGET_WIDTHS = [1280, 1920, 2440];

let selectedFile = null;
let lastUpload = null; // { storedName, originalRelativePath, previewRelativePath, imageWidth, imageHeight }

// storedName -> { tr, cells: Map(width->td), created: Set(width) }
const uploads = new Map();

// After crop we overwrite files under the same URLs (preview/<storedName>, upload/<storedName>, resized/<w>/<storedName>).
// Browsers/proxies may cache these aggressively, so we add a per-file cache-buster version.
// storedName -> version (number)
const cacheBust = new Map();

// RU: Добавляет к URL кеш‑бастер ?v=..., чтобы браузер не показывал старую версию файла после crop/resize.
// EN: Appends a ?v=... cache‑buster so the browser does not serve stale images after crop/resize.
function withCacheBust(relativeUrl, storedName) {
  if (!relativeUrl) return relativeUrl;
  const resolved = toAbsoluteUrl(relativeUrl);
  if (!storedName) return resolved;
  const v = cacheBust.get(storedName);
  if (!v) return resolved;
  const sep = resolved.includes('?') ? '&' : '?';
  return `${resolved}${sep}v=${v}`;
}

function detectEdgeHandle(localX, localY, w, h, edgePx) {
  const edge = edgePx || 12;
  if (!w || !h) return { handle: null, cursor: 'move' };

  const nearLeft = localX >= 0 && localX <= edge;
  const nearRight = localX >= (w - edge) && localX <= w;
  const nearTop = localY >= 0 && localY <= edge;
  const nearBottom = localY >= (h - edge) && localY <= h;

  let handle = null;
  if (nearLeft && nearTop) handle = 'tl';
  else if (nearRight && nearTop) handle = 'tr';
  else if (nearLeft && nearBottom) handle = 'bl';
  else if (nearRight && nearBottom) handle = 'br';
  else if (nearTop) handle = 't';
  else if (nearBottom) handle = 'b';
  else if (nearLeft) handle = 'l';
  else if (nearRight) handle = 'r';

  let cursor = 'move';
  if (handle === 'tl' || handle === 'br') cursor = 'nwse-resize';
  else if (handle === 'tr' || handle === 'bl') cursor = 'nesw-resize';
  else if (handle === 'l' || handle === 'r') cursor = 'ew-resize';
  else if (handle === 't' || handle === 'b') cursor = 'ns-resize';

  return { handle, cursor };
}

function cursorForHandle(handle) {
  const h = String(handle || '');
  if (h === 'tl' || h === 'br') return 'nwse-resize';
  if (h === 'tr' || h === 'bl') return 'nesw-resize';
  if (h === 'l' || h === 'r') return 'ew-resize';
  if (h === 't' || h === 'b') return 'ns-resize';
  return 'move';
}
