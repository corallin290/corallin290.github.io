const LOCALES = ['en', 'ja', 'zh'];
const DEFAULT_LOCALE = 'en';
const STORAGE_KEY = 'site.locale';

const DICT = {
  en: {
    'welcome.heading': 'Welcome',
    'welcome.subtitle': "Choose how you'd like to explore:",
    'welcome.btn.terminal': 'Terminal Mode',
    'welcome.btn.interactive': 'Interactive Mode',
    'err.cmdNotFound': "{name}: command not found. Type 'help' for available commands.",
    'err.cat.usage': 'usage: cat <file>',
    'err.cat.noSuchFile': 'cat: {name}: No such file',
    'err.ls.noSuchDir': "ls: cannot access '{target}': No such directory",
    'err.cd.noSuchDir': 'cd: {target}: No such directory',
    'help.header': 'Available commands:',
    'cmd.help.description': 'List available commands',
    'cmd.ls.description': 'List directory contents',
    'cmd.cat.description': 'Print file contents',
    'cmd.cd.description': 'Change directory',
    'cmd.pwd.description': 'Print working directory',
    'cmd.clear.description': 'Clear the screen',
    'ui.tooltip.parentDir': 'Go to parent directory',
    'ui.lang.english': 'English',
    'ui.lang.japanese': '日本語',
    'ui.lang.chinese': '中文',
  },
  ja: {
    'welcome.heading': 'ようこそ',
    'welcome.subtitle': 'どのように探索するか選んでください：',
    'welcome.btn.terminal': 'ターミナルモード',
    'welcome.btn.interactive': 'インタラクティブモード',
    'err.cmdNotFound': "{name}: コマンドが見つかりません。'help' でコマンド一覧を確認できます。",
    'err.cat.usage': '使用法: cat <ファイル>',
    'err.cat.noSuchFile': 'cat: {name}: そのようなファイルはありません',
    'err.ls.noSuchDir': "ls: '{target}' にアクセスできません: そのようなディレクトリはありません",
    'err.cd.noSuchDir': 'cd: {target}: そのようなディレクトリはありません',
    'help.header': '利用可能なコマンド:',
    'cmd.help.description': 'コマンド一覧を表示',
    'cmd.ls.description': 'ディレクトリの内容を表示',
    'cmd.cat.description': 'ファイルの内容を出力',
    'cmd.cd.description': 'ディレクトリを変更',
    'cmd.pwd.description': '現在のディレクトリを表示',
    'cmd.clear.description': '画面をクリア',
    'ui.tooltip.parentDir': '親ディレクトリに移動',
    'ui.lang.english': 'English',
    'ui.lang.japanese': '日本語',
    'ui.lang.chinese': '中文',
  },
  zh: {
    'welcome.heading': '歡迎',
    'welcome.subtitle': '請選擇你想如何探索：',
    'welcome.btn.terminal': '終端模式',
    'welcome.btn.interactive': '互動模式',
    'err.cmdNotFound': "{name}：找不到指令。輸入 'help' 查看可用指令。",
    'err.cat.usage': '用法：cat <檔案>',
    'err.cat.noSuchFile': 'cat：{name}：找不到檔案',
    'err.ls.noSuchDir': "ls：無法存取 '{target}'：找不到目錄",
    'err.cd.noSuchDir': 'cd：{target}：找不到目錄',
    'help.header': '可用指令：',
    'cmd.help.description': '列出可用指令',
    'cmd.ls.description': '列出目錄內容',
    'cmd.cat.description': '輸出檔案內容',
    'cmd.cd.description': '變更目錄',
    'cmd.pwd.description': '顯示工作目錄',
    'cmd.clear.description': '清除畫面',
    'ui.tooltip.parentDir': '返回上層目錄',
    'ui.lang.english': 'English',
    'ui.lang.japanese': '日本語',
    'ui.lang.chinese': '中文',
  },
};

function loadLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES.includes(stored)) return stored;
  } catch {}
  return DEFAULT_LOCALE;
}

let current = loadLocale();

if (typeof document !== 'undefined') {
  document.documentElement.lang = current;
}

export function get(key, params) {
  const dict = DICT[current] || DICT[DEFAULT_LOCALE];
  let str = dict[key];
  if (str === undefined) str = DICT[DEFAULT_LOCALE][key];
  if (str === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.split(`{${k}}`).join(v);
    }
  }
  return str;
}

export function getLocale() {
  return current;
}

// Selector for elements whose visible content is locale-aware. Everything
// matched here glitches on setLocale — including locale-routed content that
// happens to have only an English source (e.g. a .md file with no localized
// variant), because the content *could* have changed.
const GLITCH_SELECTOR =
  '[data-i18n], .output-block[data-kind]:not([data-kind="buttons"]) .output-content';

function triggerGlitch() {
  if (typeof document === 'undefined') return;
  const els = document.querySelectorAll(GLITCH_SELECTOR);
  if (els.length === 0) return;

  for (const el of els) el.classList.remove('i18n-glitch');
  // One reflow invalidates layout for every element, so removing + re-adding
  // the class restarts the animation even on rapid back-to-back switches.
  void document.body.offsetWidth;

  for (const el of els) {
    el.classList.add('i18n-glitch');
    el.addEventListener('animationend', function onEnd(e) {
      if (e.animationName !== 'lang-glitch') return;
      el.classList.remove('i18n-glitch');
      el.removeEventListener('animationend', onEnd);
    });
  }
}

export function setLocale(locale) {
  if (!LOCALES.includes(locale) || locale === current) return;
  current = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  document.documentElement.lang = locale;
  triggerGlitch();
  document.dispatchEvent(new CustomEvent('languagechange', { detail: { locale } }));
}

export const locales = LOCALES;
