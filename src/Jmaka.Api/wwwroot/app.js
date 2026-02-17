// Jmaka frontend version: 0.3.2
const APP_VERSION = '0.3.2';

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
    'Поддержка drag &amp; drop: просто перетащите файлы на окно.': 'Drag & drop supported: just drop files into the window.',
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
    'Скачать': 'Download',
    'Склеиваю...': 'Merging...',
    'Сначала выберите строку в таблице файлов.': 'First select a row in the files table.',
    'Сохраняю...': 'Saving...',
    'сегмент': 'segment',
    'сегмента': 'segments',
    'сегментов': 'segments',
    '— небольшое веб-приложение для загрузки и обработки изображений.': '— a small web app for uploading and processing images.',
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
    'Поддержка drag &amp; drop: просто перетащите файлы на окно.': 'Soporta arrastrar y soltar: arrastra archivos a la ventana.',
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
    'Скачать': 'Descargar',
    'Склеиваю...': 'Combinando...',
    'Сначала выберите строку в таблице файлов.': 'Primero selecciona una fila en la tabla de archivos.',
    'Сохраняю...': 'Guardando...',
    'сегмент': 'segmento',
    'сегмента': 'segmentos',
    'сегментов': 'segmentos',
    '— небольшое веб-приложение для загрузки и обработки изображений.': '— una pequeña aplicación web para cargar y procesar imágenes.',
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

function translateText(sourceText, lang = currentLanguage) {
  const source = String(sourceText || '');
  if (!source) return source;
  const ruBase = toRussianBaseText(source);
  if (lang === 'ru') return ruBase;
  const dict = PHRASE_TRANSLATIONS[lang] || {};
  return dict[ruBase] || dict[source] || source;
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
const trashToolBtn = document.getElementById('trashToolBtn');
const trashFixToolBtn = document.getElementById('trashFixToolBtn');
const trashModal = document.getElementById('trashModal');
const trashCloseBtn = document.getElementById('trashClose');
const trashCancelBtn = document.getElementById('trashCancel');
const trashApplyBtn = document.getElementById('trashApply');
const trashStage = document.getElementById('trashStage');
const trashCard = document.getElementById('trashCard');
const trashImgViewport = document.getElementById('trashImgViewport');
const trashImg = document.getElementById('trashImg');
// Ручки изменения ширины окна больше не используются (окно фиксировано) для OknoFix
const trashHandleLeft = null;
const trashHandleRight = null;
const trashHint = document.getElementById('trashHint');
const trashZoomInBtn = document.getElementById('trashZoomIn');
const trashZoomOutBtn = document.getElementById('trashZoomOut');

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

// -------- Split3 tool (3 panels) --------

function getSplit3PanelRect(which) {
  const el = which === 'a' ? split3ThirdA : (which === 'b' ? split3ThirdB : split3ThirdC);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function split3GetPointerPosInPanel(which, e) {
  const r = getSplit3PanelRect(which);
  if (!r) return { x: 0, y: 0 };
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function split3BringToFront(which) {
  if (!split3ItemA || !split3ItemB || !split3ItemC) return;
  const z = { a: 1, b: 1, c: 1 };
  z[which] = 3;
  // keep deterministic stacking for others
  if (which === 'a') { z.b = 2; z.c = 1; }
  if (which === 'b') { z.a = 1; z.c = 2; }
  if (which === 'c') { z.a = 2; z.b = 1; }
  split3ItemA.style.zIndex = String(z.a);
  split3ItemB.style.zIndex = String(z.b);
  split3ItemC.style.zIndex = String(z.c);
}

function split3GetPanelSize(which) {
  const r = getSplit3PanelRect(which);
  if (!r) return { w: 0, h: 0 };
  return { w: r.width, h: r.height };
}

const split3State = {
  open: false,
  history: [],
  action: null,
  pickTarget: 'a',
  a: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 },
  b: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 },
  c: { storedName: null, url: null, natW: 0, natH: 0, x: 0, y: 0, w: 0, h: 0 }
};

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
    const st = which === 'a' ? split3State.a : (which === 'b' ? split3State.b : split3State.c);
    if (!st.url || !st.natW || !st.natH) continue;

    const { w: panelW, h: panelH } = split3GetPanelSize(which);
    if (!panelW || !panelH) continue;

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
    split3LayoutDefaults();
  };

  img.onerror = () => {
    if (split3Hint) split3Hint.textContent = 'Не удалось загрузить картинку для Split3.';
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

  if (split3Hint) split3Hint.textContent = 'Загружаю список...';

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
      ? 'Выберите слот (#1/#2/#3), затем кликните по превью. Дальше перетаскивайте/масштабируйте.'
      : 'Нет загруженных изображений.';
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
    if (split3Hint) split3Hint.textContent = 'Выберите три картинки.';
    return;
  }

  const panelA = split3GetPanelSize('a');
  const panelB = split3GetPanelSize('b');
  const panelC = split3GetPanelSize('c');

  if (!panelA.w || !panelA.h || !panelB.w || !panelB.h || !panelC.w || !panelC.h) {
    if (split3Hint) split3Hint.textContent = 'Не удалось определить размер поля.';
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
    if (split3Hint) split3Hint.textContent = 'Склеиваю...';

    const res = await fetch(toAbsoluteUrl('split3'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      if (split3Hint) split3Hint.textContent = 'Ошибка split3.';
      showResult(data);
      return;
    }

    showResult(data);

    // Split3 output is independent, but sources may change; still bump cache for involved sources.
    cacheBust.set(a.storedName, Date.now());
    cacheBust.set(b.storedName, Date.now());
    cacheBust.set(c.storedName, Date.now());
    await loadComposites();

    hint.textContent = 'Split3 создан.';
    closeSplit3Modal();
  } catch (e) {
    if (split3Hint) split3Hint.textContent = 'Ошибка split3.';
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
    split3LayoutDefaults();
  });
}

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
  const imageToolBtns = [cropToolBtn, splitToolBtn, split3ToolBtn, trashFixToolBtn, trashToolBtn, imageEditToolBtn]
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
wireTrashUI();
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
  if (trashToolBtn) {
    trashToolBtn.addEventListener('click', (e) => {
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

function getPointerPosInTrashStage(e) {
  if (!trashStage) return { x: 0, y: 0 };
  const r = trashStage.getBoundingClientRect();
  return {
    x: e.clientX - r.left,
    y: e.clientY - r.top
  };
}

const TRASH_ASPECT = 16 / 9; // окно 1920x1080
const TRASH_TEMPLATE_W = 1920;
const TRASH_TEMPLATE_H = 1080;
const TRASH_WINDOW_PX = { x: 593, y: 79, w: 735, h: 922 };

function getTrashWindowRectInCard() {
  if (!trashCard) return { x: 0, y: 0, w: 0, h: 0 };
  const cardRect = trashCard.getBoundingClientRect();
  if (!cardRect.width || !cardRect.height) return { x: 0, y: 0, w: 0, h: 0 };
  // Для OknoFix окно задаётся по шаблону PNG (фиксированный режим).
  // Вся карточка служит подложкой, а прозрачное окно берётся из TRASH_WINDOW_PX.
  const sx = cardRect.width / TRASH_TEMPLATE_W;
  const sy = cardRect.height / TRASH_TEMPLATE_H;
  const k = (sx + sy) / 2;

  return {
    x: TRASH_WINDOW_PX.x * k,
    y: TRASH_WINDOW_PX.y * k,
    w: TRASH_WINDOW_PX.w * k,
    h: TRASH_WINDOW_PX.h * k
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

function layoutTrashWindowInitial() {
  if (!trashStage || !trashCard) return;
  const stageRect = trashStage.getBoundingClientRect();
  if (!stageRect.width || !stageRect.height) return;

  const maxW = stageRect.width * 0.8;
  const maxH = stageRect.height * 0.8;
  // вписываем окно 16:9 в центр с небольшими отступами
  let w = maxW;
  let h = w / TRASH_ASPECT;
  if (h > maxH) {
    h = maxH;
    w = h * TRASH_ASPECT;
  }

  const y = (stageRect.height - h) / 2;

  oknoFixState.window.y = y;
  oknoFixState.window.h = h;
  oknoFixState.window.w = w;

  updateTrashWindowLayout();
}

function updateTrashWindowLayout() {
  if (!trashStage || !trashCard) return;
  const stageRect = trashStage.getBoundingClientRect();
  if (!stageRect.width) return;
  const h = oknoFixState.window.h;
  const w = oknoFixState.window.w;
  const left = (stageRect.width - w) / 2;
  const top = oknoFixState.window.y;

  trashCard.style.width = `${w}px`;
  trashCard.style.height = `${h}px`;
  trashCard.style.left = `${left}px`;
  trashCard.style.top = `${top}px`;
}

function openOknoFixModal(mode) {
  if (!trashModal || !trashStage || !trashCard || !trashImgViewport || !trashImg) return;

  if (!lastUpload || !lastUpload.storedName || !lastUpload.originalRelativePath) {
    if (trashHint) {
      trashHint.textContent = 'Сначала выберите строку в таблице файлов.';
    }
    return;
  }

  oknoFixState.open = true;
  oknoFixState.mode = mode === 'fix' ? 'fix' : 'experimental';
  oknoFixState.storedName = lastUpload.storedName;
  // Для OknoFix в рабочем поле тоже всегда показываем исходник upload-original/<storedName>.
  const rel = `upload-original/${lastUpload.storedName}`;
  oknoFixState.url = withCacheBust(rel, lastUpload.storedName);

  trashModal.hidden = false;
  if (trashApplyBtn) trashApplyBtn.disabled = true;

  if (trashHint) {
    trashHint.textContent = 'Двигайте и масштабируйте картинку под окном.';
  }

  layoutTrashWindowInitial();

  trashImg.onload = () => {
    oknoFixState.natW = trashImg.naturalWidth || 0;
    oknoFixState.natH = trashImg.naturalHeight || 0;
    layoutTrashImageCover();
    if (trashApplyBtn) trashApplyBtn.disabled = false;
  };

  trashImg.src = oknoFixState.url;
  trashImg.alt = lastUpload.originalName || lastUpload.storedName || '';
}

function layoutTrashImageCover() {
  if (!trashCard || !trashImg || !oknoFixState.natW || !oknoFixState.natH) return;
  const win = getTrashWindowRectInCard();
  const winW = win.w;
  const winH = win.h;
  if (!winW || !winH) return;

  // Вставляем пропорционально по высоте: высота окна = высота картинки.
  const scale = winH / oknoFixState.natH;
  const w = oknoFixState.natW * scale;
  const h = winH; // === trashState.natH * scale

  const centerX = win.x + winW / 2;
  const centerY = win.y + winH / 2;
  const x0 = centerX - w / 2;
  const y0 = centerY - h / 2;

  const clamped = clampImageToWindow({ x: x0, y: y0, w, h }, win);
  oknoFixState.img = clamped;

  trashImg.style.width = `${clamped.w}px`;
  trashImg.style.height = `${clamped.h}px`;
  trashImg.style.left = `${clamped.x}px`;
  trashImg.style.top = `${clamped.y}px`;
}

function closeTrashModal() {
  if (!trashModal) return;
  trashModal.hidden = true;
  oknoFixState.open = false;
  oknoFixState.action = null;
  if (trashImg) {
    trashImg.removeAttribute('src');
    trashImg.alt = '';
  }
}

function wireTrashUI() {
  if (!trashModal || !trashStage || !trashCard) return;

  // Только OknoFix (фиксированный шаблон) живёт в этой модалке.
  if (trashFixToolBtn) {
    trashFixToolBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openOknoFixModal('fix');
    });
  }

  const trashZoomByFactor = (factor) => {
    if (!oknoFixState.open || !trashCard || !trashImg || !oknoFixState.img) return;
    const rect = trashCard.getBoundingClientRect();
    const win = getTrashWindowRectInCard();
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
    trashImg.style.width = `${img1.w}px`;
    trashImg.style.height = `${img1.h}px`;
    trashImg.style.left = `${img1.x}px`;
    trashImg.style.top = `${img1.y}px`;
  };

  // Ctrl+0 — сброс масштаба фона до "по высоте окна"
  document.addEventListener('keydown', (e) => {
    if (!oknoFixState.open) return;
    if ((e.key === '0' || e.code === 'Digit0') && e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      layoutTrashImageCover();
    }
  });

  const close = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeTrashModal();
  };

  if (trashCloseBtn) trashCloseBtn.addEventListener('click', close);
  if (trashCancelBtn) trashCancelBtn.addEventListener('click', close);

  if (trashZoomInBtn) {
    trashZoomInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      trashZoomByFactor(1.12);
    });
  }

  if (trashZoomOutBtn) {
    trashZoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      trashZoomByFactor(0.9);
    });
  }

  trashModal.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) {
      closeTrashModal();
    }
  });

  // Ручки изменения ширины окна больше не используются, окно фиксировано.

  // Перемещение/масштабирование изображения под окном (панорамирование + zoom)
  if (trashImgViewport) {
    trashImgViewport.addEventListener('wheel', (e) => {
      if (!oknoFixState.open) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      trashZoomByFactor(factor);
    });

    trashImgViewport.addEventListener('pointerdown', (e) => {
      if (!oknoFixState.open) return;
      // не перехватываем, если клик по ручке окна
      if (e.target === trashHandleLeft || e.target === trashHandleRight) return;
      if (!trashCard) return;

      const rect = trashCard.getBoundingClientRect();
      const win = getTrashWindowRectInCard();
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

      try { trashImgViewport.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });

    trashImgViewport.addEventListener('pointermove', (e) => {
    if (!oknoFixState.open || !oknoFixState.action) return;

      const action = oknoFixState.action;

      if (action.type === 'img-move') {
        const dx = e.clientX - action.startPointerX;
        const dy = e.clientY - action.startPointerY;

        const win = getTrashWindowRectInCard();
        const img0 = oknoFixState.img;
        const tentative = {
          x: action.startX + dx,
          y: action.startY + dy,
          w: img0.w,
          h: img0.h
        };

        const img1 = clampImageToWindow(tentative, win);
        oknoFixState.img = img1;
        trashImg.style.left = `${img1.x}px`;
        trashImg.style.top = `${img1.y}px`;
        return;
      }

      if (action.type === 'img-scale') {
        if (!trashCard) return;
        const rect = trashCard.getBoundingClientRect();
        const win = getTrashWindowRectInCard();
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
        trashImg.style.width = `${img1.w}px`;
        trashImg.style.height = `${img1.h}px`;
        trashImg.style.left = `${img1.x}px`;
        trashImg.style.top = `${img1.y}px`;
        return;
      }
    });

    const endImgMove = (e) => {
      if (!oknoFixState.action || (oknoFixState.action.type !== 'img-move' && oknoFixState.action.type !== 'img-scale')) return;
      oknoFixState.action = null;
      try { trashImgViewport.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    trashImgViewport.addEventListener('pointerup', endImgMove);
    trashImgViewport.addEventListener('pointercancel', endImgMove);
  }

  if (trashApplyBtn) {
    trashApplyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!oknoFixState.open || !oknoFixState.storedName) return;
      if (!trashCard) return;

      const win = getTrashWindowRectInCard();
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
        if (trashHint) trashHint.textContent = 'Генерирую OknoFix...';

        const res = await fetch(toAbsoluteUrl('oknofix'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req)
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = text; }

        if (!res.ok) {
          if (trashHint) trashHint.textContent = t('oknoFixError');
          showResult(data);
          return;
        }

        showResult(data);
        await loadComposites();
        if (trashHint) trashHint.textContent = t('oknoFixCreated');
        closeTrashModal();
      } catch (err) {
        if (trashHint) trashHint.textContent = t('oknoFixError');
        showResult(String(err));
      } finally {
        setBusy(false);
      }
    });
  }

  window.addEventListener('resize', () => {
    if (!oknoFixState.open) return;
    layoutTrashWindowInitial();
    layoutTrashImageCover();
  });
}

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
    color: { vibrance: 10, saturation: 5, temperature: 0, tint: 0, hue: 0 },
    light: { brightness: 5, exposure: 3, contrast: 8, black: 0, white: 0, highlights: -5, shadows: 8 },
    details: { sharpen: 5, clarity: 8, smooth: 0, blur: 0, grain: 0 },
    scene: { vignette: 0, glamour: 0, bloom: 0, dehaze: 5 }
  },
  BW: {
    color: { vibrance: 0, saturation: -100, temperature: 0, tint: 0, hue: 0 },
    light: { brightness: 0, exposure: 0, contrast: 12, black: 4, white: 4, highlights: -5, shadows: 6 },
    details: { sharpen: 4, clarity: 6, smooth: 0, blur: 0, grain: 5 },
    scene: { vignette: 10, glamour: 0, bloom: 0, dehaze: 0 }
  },
  Pop: {
    color: { vibrance: 18, saturation: 12, temperature: 0, tint: 0, hue: 0 },
    light: { brightness: 3, exposure: 2, contrast: 14, black: 0, white: 6, highlights: 0, shadows: 4 },
    details: { sharpen: 8, clarity: 12, smooth: 0, blur: 0, grain: 0 },
    scene: { vignette: 6, glamour: 0, bloom: 4, dehaze: 6 }
  }
};

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
  const preset = presetValues[presetKey];
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
