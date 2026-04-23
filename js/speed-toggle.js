import * as i18n from './i18n.js';
import { setSpeedUp, isSpeedUp } from './renderer.js';

const STORAGE_KEY = 'site.speedUp';
const SYMBOL = '速';

function loadInitial() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

setSpeedUp(loadInitial());

function syncButton(btn) {
  const on = isSpeedUp();
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', String(on));
  btn.dataset.tooltip = i18n.get('ui.tooltip.speedUp');
  btn.setAttribute('aria-label', i18n.get('ui.tooltip.speedUp'));
}

function makeButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lang-btn speed-btn';
  btn.textContent = SYMBOL;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = !isSpeedUp();
    setSpeedUp(next);
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch {}
    for (const b of document.querySelectorAll('.speed-btn')) syncButton(b);
  });
  syncButton(btn);
  return btn;
}

function mountAll() {
  for (const c of document.querySelectorAll('.lang-selector')) {
    if (c.querySelector('.speed-btn')) continue;
    c.prepend(makeButton());
  }
}

// The lang-selector mounts itself on DOMContentLoaded (or immediately if the
// DOM is already parsed) and re-renders its children from scratch inside its
// own mount(). Run after it so our prepended button isn't wiped out; on
// re-mounts (languagechange triggers syncActive, not a remount) we re-prepend
// any missing speed button.
function whenReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

whenReady(() => {
  queueMicrotask(mountAll);
});

document.addEventListener('languagechange', () => {
  for (const b of document.querySelectorAll('.speed-btn')) syncButton(b);
});
