import * as i18n from './i18n.js';

const FLAGS = [
  { locale: 'en', flag: '\u{1F1FA}\u{1F1F8}', labelKey: 'ui.lang.english' },
  { locale: 'ja', flag: '\u{1F1EF}\u{1F1F5}', labelKey: 'ui.lang.japanese' },
  { locale: 'zh', flag: '\u{1F1F9}\u{1F1FC}', labelKey: 'ui.lang.chinese' },
];

function syncActive(container) {
  const active = i18n.getLocale();
  for (const btn of container.querySelectorAll('.lang-btn')) {
    btn.classList.toggle('active', btn.dataset.locale === active);
    btn.setAttribute('aria-pressed', String(btn.dataset.locale === active));
  }
}

function mount(container) {
  container.innerHTML = '';
  for (const { locale, flag, labelKey } of FLAGS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-btn';
    btn.dataset.locale = locale;
    btn.textContent = flag;
    btn.setAttribute('aria-label', i18n.get(labelKey));
    btn.dataset.tooltip = i18n.get(labelKey);
    btn.addEventListener('pointerenter', () => {
      i18n.setLocale(locale);
    });
    btn.addEventListener('focus', () => {
      i18n.setLocale(locale);
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      i18n.setLocale(locale);
    });
    container.appendChild(btn);
  }
  syncActive(container);
}

function mountAll() {
  const containers = document.querySelectorAll('.lang-selector');
  for (const c of containers) mount(c);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAll);
} else {
  mountAll();
}

document.addEventListener('languagechange', () => {
  for (const c of document.querySelectorAll('.lang-selector')) syncActive(c);
});
