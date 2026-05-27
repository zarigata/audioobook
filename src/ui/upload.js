// File upload with drag-and-drop — Portuguese UI, format detection, 100MB limit

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const ACCEPTED_EXTENSIONS = [
  '.pdf', '.epub', '.txt', '.docx', '.html', '.htm', '.rtf', '.md',
];

const MIME_MAP = {
  'application/pdf': '.pdf',
  'application/epub+zip': '.epub',
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/html': '.html',
  'application/rtf': '.rtf',
  'text/markdown': '.md',
  'text/rtf': '.rtf',
};

/**
 * Detect file extension from name or MIME type
 */
export function detectFormat(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (ACCEPTED_EXTENSIONS.includes(ext)) return ext;

  // Fallback to MIME type
  const mapped = MIME_MAP[file.type];
  if (mapped) return mapped;

  // Common ambiguous types
  if (file.type === 'text/plain' || file.type === '') {
    if (ext === '.md') return '.md';
    if (ext === '.rtf') return '.rtf';
    return '.txt'; // default text
  }

  return null;
}

/**
 * Create the upload component and mount into container
 * @param {HTMLElement} container - #upload-area element
 * @param {(file: File, format: string) => void} onFileSelected - callback
 */
export function createUploadUI(container, onFileSelected) {
  container.innerHTML = '';
  container.style.display = '';

  const dropZone = document.createElement('div');
  dropZone.className = 'upload-dropzone';
  dropZone.setAttribute('role', 'button');
  dropZone.setAttribute('tabindex', '0');
  dropZone.setAttribute('aria-label', 'Área para enviar arquivo');

  dropZone.innerHTML = `
    <div class="upload-icon">📄</div>
    <p class="upload-title">Arraste seu arquivo aqui</p>
    <p class="upload-subtitle">ou clique para selecionar</p>
    <p class="upload-formats">PDF, EPUB, TXT, DOCX, HTML, RTF, MD — até 100MB</p>
    <input type="file" accept=".pdf,.epub,.txt,.docx,.html,.htm,.rtf,.md" hidden />
  `;

  const fileInput = dropZone.querySelector('input[type="file"]');
  let isDragging = false;

  // Click to open file picker
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Drag events
  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    isDragging = true;
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // Only remove if leaving the dropzone itself
    if (!dropZone.contains(e.relatedTarget)) {
      isDragging = false;
      dropZone.classList.remove('drag-over');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    isDragging = false;
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, dropZone, onFileSelected);
  });

  // File input change
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFile(file, dropZone, onFileSelected);
    fileInput.value = ''; // Reset so same file can be re-selected
  });

  container.appendChild(dropZone);
}

/**
 * Validate and process selected file
 */
function handleFile(file, dropZone, onFileSelected) {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    showError(dropZone, `Arquivo muito grande (${formatSize(file.size)}). O limite é 100MB.`);
    return;
  }

  if (file.size === 0) {
    showError(dropZone, 'O arquivo está vazio.');
    return;
  }

  // Format check
  const format = detectFormat(file);
  if (!format) {
    showError(dropZone, `Formato não suportado: "${file.name.split('.').pop()}". Use PDF, EPUB, TXT, DOCX, HTML, RTF ou MD.`);
    return;
  }

  // Show selected state
  showSelected(dropZone, file, format);

  // Notify parent
  onFileSelected(file, format);
}

/**
 * Show file selected state in dropzone
 */
function showSelected(dropZone, file, format) {
  const icon = getFormatIcon(format);
  dropZone.classList.add('has-file');
  dropZone.innerHTML = `
    <div class="upload-icon">${icon}</div>
    <p class="upload-title">${escapeHtml(file.name)}</p>
    <p class="upload-subtitle">${formatSize(file.size)} — ${format.toUpperCase().slice(1)}</p>
    <p class="upload-formats">Clique para trocar de arquivo</p>
    <input type="file" accept=".pdf,.epub,.txt,.docx,.html,.htm,.rtf,.md" hidden />
  `;

  // Re-bind file input
  const fileInput = dropZone.querySelector('input[type="file"]');
  fileInput.addEventListener('change', () => {
    const newFile = fileInput.files[0];
    if (newFile) handleFile(newFile, dropZone, dropZone._onFileSelected);
    fileInput.value = '';
  });
  dropZone._onFileSelected = dropZone._onFileSelected;
}

/**
 * Show error message
 */
function showError(dropZone, message) {
  const existing = dropZone.querySelector('.upload-error');
  if (existing) existing.remove();

  const err = document.createElement('p');
  err.className = 'upload-error';
  err.textContent = message;
  dropZone.appendChild(err);

  setTimeout(() => err.remove(), 5000);
}

/**
 * Format bytes to human-readable
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFormatIcon(format) {
  const icons = {
    '.pdf': '📕', '.epub': '📗', '.txt': '📄',
    '.docx': '📘', '.html': '🌐', '.htm': '🌐',
    '.rtf': '📝', '.md': '📝',
  };
  return icons[format] || '📄';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
