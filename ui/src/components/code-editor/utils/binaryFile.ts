const IMAGE_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif',
];

const PDF_EXTENSIONS = ['pdf'];

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg'];

const DOCX_EXTENSIONS = ['docx'];

const PPTX_EXTENSIONS = ['pptx'];

const XLSX_EXTENSIONS = ['xlsx', 'xls'];

const OFFICE_EXTENSIONS = [...DOCX_EXTENSIONS, ...PPTX_EXTENSIONS, 'doc', 'ppt', ...XLSX_EXTENSIONS, 'odt', 'ods', 'odp'];

const BINARY_EXTENSIONS = [
  // Images
  ...IMAGE_EXTENSIONS,
  // Archives
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz',
  // Executables
  'exe', 'dll', 'so', 'dylib', 'app', 'dmg', 'msi',
  // Media (audio + video)
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  // Documents
  ...PDF_EXTENSIONS,
  ...OFFICE_EXTENSIONS,
  // Fonts
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  // Database
  'db', 'sqlite', 'sqlite3',
  // Other binary
  'bin', 'dat', 'iso', 'img', 'class', 'jar', 'war', 'pyc', 'pyo',
];

const getExtension = (filename: string): string =>
  filename.split('.').pop()?.toLowerCase() ?? '';

export const isBinaryFile = (filename: string): boolean =>
  BINARY_EXTENSIONS.includes(getExtension(filename));

export const isImageFile = (filename: string): boolean =>
  IMAGE_EXTENSIONS.includes(getExtension(filename));

export const isPdfFile = (filename: string): boolean =>
  PDF_EXTENSIONS.includes(getExtension(filename));

export const isVideoFile = (filename: string): boolean =>
  VIDEO_EXTENSIONS.includes(getExtension(filename));

export const isAudioFile = (filename: string): boolean =>
  AUDIO_EXTENSIONS.includes(getExtension(filename));

export const isDocxFile = (filename: string): boolean =>
  DOCX_EXTENSIONS.includes(getExtension(filename));

export const isPptxFile = (filename: string): boolean =>
  PPTX_EXTENSIONS.includes(getExtension(filename));

export const isXlsxFile = (filename: string): boolean =>
  XLSX_EXTENSIONS.includes(getExtension(filename));

/** Binary files that the side panel can render instead of showing a dead-end message. */
export const isPreviewableBinaryFile = (filename: string): boolean =>
  isImageFile(filename)
  || isPdfFile(filename)
  || isVideoFile(filename)
  || isAudioFile(filename)
  || isDocxFile(filename)
  || isPptxFile(filename)
  || isXlsxFile(filename);
