const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ['.pdf', '.epub', '.txt', '.docx', '.html', '.htm', '.rtf', '.md'];

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

export function detectFormat(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (ACCEPTED_EXTENSIONS.includes(ext)) return ext;
  const mapped = MIME_MAP[file.type];
  if (mapped) return mapped;
  if (file.type === 'text/plain' || file.type === '') {
    if (ext === '.md') return '.md';
    if (ext === '.rtf') return '.rtf';
    return '.txt';
  }
  return null;
}

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
    <p class="upload-formats">PDF · EPUB · TXT · DOCX · HTML · RTF · MD — até 100 MB</p>
    <input type="file" accept=".pdf,.epub,.txt,.docx,.html,.htm,.rtf,.md" hidden />
  `;

  const fileInput = dropZone.querySelector('input[type="file"]');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, dropZone, onFileSelected);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFile(file, dropZone, onFileSelected);
    fileInput.value = '';
  });

  container.appendChild(dropZone);
}

function handleFile(file, dropZone, onFileSelected) {
  if (file.size > MAX_FILE_SIZE) {
    showError(dropZone, `Arquivo muito grande (${formatSize(file.size)}). O limite é 100 MB.`);
    return;
  }
  if (file.size === 0) {
    showError(dropZone, 'O arquivo está vazio.');
    return;
  }
  const format = detectFormat(file);
  if (!format) {
    showError(dropZone, `Formato não suportado: "${file.name.split('.').pop()}". Use PDF, EPUB, TXT, DOCX, HTML, RTF ou MD.`);
    return;
  }
  showSelected(dropZone, file, format);
  onFileSelected(file, format);
}

function showSelected(dropZone, file, format) {
  dropZone.classList.add('has-file');
  dropZone.innerHTML = `
    <div class="upload-icon">${getFormatIcon(format)}</div>
    <p class="upload-title">${escapeHtml(file.name)}</p>
    <p class="upload-subtitle">${formatSize(file.size)} · ${format.toUpperCase().slice(1)}</p>
    <p class="upload-formats">Clique para trocar de arquivo</p>
    <input type="file" accept=".pdf,.epub,.txt,.docx,.html,.htm,.rtf,.md" hidden />
  `;
  const fileInput = dropZone.querySelector('input[type="file"]');
  fileInput.addEventListener('change', () => {
    const newFile = fileInput.files[0];
    if (newFile) handleFile(newFile, dropZone, null);
    fileInput.value = '';
  });
}

function showError(dropZone, message) {
  const existing = dropZone.querySelector('.upload-error');
  if (existing) existing.remove();
  const err = document.createElement('p');
  err.className = 'upload-error';
  err.textContent = message;
  dropZone.appendChild(err);
  setTimeout(() => err.remove(), 5000);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFormatIcon(format) {
  return { '.pdf': '📕', '.epub': '📗', '.txt': '📄', '.docx': '📘', '.html': '🌐', '.htm': '🌐', '.rtf': '📝', '.md': '📝' }[format] || '📄';
}

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
