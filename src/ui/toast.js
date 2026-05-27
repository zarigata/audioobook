// Toast notification system

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 * @param {number} duration — ms
 */
export function showToast(message, type = 'info', duration = 3500) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;

  const c = getContainer();
  c.appendChild(el);

  requestAnimationFrame(() => el.classList.add('toast-visible'));

  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.addEventListener('transitionend', () => el.remove());
    setTimeout(() => el.remove(), 400);
  }, duration);
}
