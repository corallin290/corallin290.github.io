import * as i18n from './i18n.js';
import './lang-selector.js';

function applyTranslations() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = i18n.get(el.dataset.i18n);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyTranslations);
} else {
  applyTranslations();
}

document.addEventListener('languagechange', applyTranslations);
