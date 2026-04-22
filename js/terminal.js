import * as fs from './filesystem.js';
import * as commands from './commands/registry.js';
import { render, renderInto, animateLines } from './renderer.js';
import * as i18n from './i18n.js';
import './lang-selector.js';

let cwd = '/';
const history = [];
let historyIndex = -1;

const ctx = {
  fs,
  cwd: () => cwd,
  setCwd: (dir) => { cwd = dir; },
  commands,
};

const output = document.getElementById('output');
const input = document.getElementById('input');
const promptEl = document.getElementById('prompt');

function updatePrompt() {
  const display = cwd === '/' ? '~' : '~' + cwd;
  promptEl.textContent = `visitor@corallins-website:${display}$ `;
}

function appendOutput(html, inputLine, meta) {
  const block = document.createElement('div');
  block.className = 'output-block';

  if (meta) {
    if (meta.kind) block.dataset.kind = meta.kind;
    if (meta.cmd) block.dataset.cmd = meta.cmd;
    if (meta.args) block.dataset.args = JSON.stringify(meta.args);
    if (meta.cwdSnap !== undefined) block.dataset.cwdSnap = meta.cwdSnap;
  }

  if (inputLine !== undefined) {
    const promptSpan = document.createElement('span');
    promptSpan.className = 'prompt-echo';
    promptSpan.textContent = promptEl.textContent + inputLine;
    block.appendChild(promptSpan);
  }

  if (html) {
    const content = document.createElement('div');
    content.className = 'output-content';
    content.innerHTML = html;
    block.appendChild(content);
  }

  output.appendChild(block);
  animateLines(block);
  window.scrollTo(0, document.body.scrollHeight);
}

async function executeStep(step, echoLine) {
  const { name, args } = step;
  const cmd = commands.getCommand(name);
  if (!cmd) {
    const text = i18n.get('err.cmdNotFound', { name });
    appendOutput(render(text), echoLine, { cmd: '__notfound__', args: [name], kind: 'text' });
    return { ok: false };
  }

  const cwdSnap = cwd;
  const result = await cmd.execute(args, ctx);

  if (result.clear) {
    output.innerHTML = '';
    updatePrompt();
    return { ok: true, cleared: true };
  }

  const html = result.text ? render(result.text, result.isMarkdown) : '';
  const meta = result.text
    ? { cmd: name, args, kind: result.isMarkdown ? 'markdown' : 'text', cwdSnap }
    : undefined;
  appendOutput(html, echoLine, meta);
  return { ok: result.ok !== false };
}

async function execute(line) {
  const steps = commands.parseSequence(line);
  if (steps.length === 0) return;

  // Only the first step echoes the raw input line; chained steps execute
  // silently so the transcript reads as one entry, matching bash's behavior
  // where the echo is the typed line, not each expanded segment.
  for (let i = 0; i < steps.length; i++) {
    const result = await executeStep(steps[i], i === 0 ? line : undefined);
    if (result.cleared) return;
    if (!result.ok) break;
  }
  updatePrompt();
}

input.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const line = input.value;
    input.value = '';

    if (line.trim()) {
      history.push(line);
      historyIndex = history.length;
    }

    await execute(line);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      input.value = history[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < history.length - 1) {
      historyIndex++;
      input.value = history[historyIndex];
    } else {
      historyIndex = history.length;
      input.value = '';
    }
  }
});

// Focus input when clicking anywhere on the page, but not when interacting
// with the language selector (those clicks should stay with the buttons).
document.addEventListener('click', (e) => {
  if (e.target.closest('a') || e.target.closest('.lang-selector')) return;
  input.focus();
});

// Re-translate every stored output block in place when the user switches
// language. The prompt echo is preserved (it's a record of what was typed);
// only the .output-content gets swapped.
async function rerenderBlock(block) {
  const content = block.querySelector('.output-content');
  if (!content) return;

  const kind = block.dataset.kind;

  const cmdName = block.dataset.cmd;
  const args = block.dataset.args ? JSON.parse(block.dataset.args) : [];

  if (cmdName === '__notfound__') {
    renderInto(content, i18n.get('err.cmdNotFound', { name: args[0] || '' }), false);
    return;
  }

  const cmd = commands.getCommand(cmdName);
  if (!cmd) return;

  // Pin cwd to the snapshot captured at execution time and stub out setCwd,
  // so re-running a path-dependent command (cat, ls, cd) produces the same
  // file/dir target it did originally — and a re-run of a failed cd doesn't
  // actually mutate the current cwd.
  const snap = block.dataset.cwdSnap ?? cwd;
  const fakeCtx = {
    fs,
    cwd: () => snap,
    setCwd: () => {},
    commands,
  };
  const result = await cmd.execute(args, fakeCtx);
  if (result.clear || !result.text) return;
  renderInto(content, result.text, result.isMarkdown);
}

document.addEventListener('languagechange', async () => {
  const blocks = output.querySelectorAll('.output-block[data-kind]');
  for (const block of blocks) {
    await rerenderBlock(block);
  }
});

export async function init() {
  await fs.init();
  updatePrompt();
  input.focus();
}
