import * as fs from './filesystem.js';
import * as commands from './commands/registry.js';
import { render, animateLines } from './renderer.js';

let cwd = '/';

const ctx = {
  fs,
  cwd: () => cwd,
  setCwd: (dir) => { cwd = dir; },
  commands,
};

const output = document.getElementById('output');
const utilButtons = document.getElementById('util-buttons');
const promptEl = document.getElementById('prompt');

function updatePrompt() {
  const display = cwd === '/' ? '~' : '~' + cwd;
  promptEl.textContent = `visitor@corallins-website:${display}$ `;
}

function makeFileButton(item) {
  const btn = document.createElement('button');
  btn.className = item.type === 'dir' ? 'file-btn dir-btn' : 'file-btn';
  btn.textContent = item.type === 'dir' ? item.name + '/' : item.name;

  btn.addEventListener('click', async () => {
    if (item.type === 'dir') {
      await runCommand('cd', [item.name], true);
    } else {
      await runCommand('cat', [item.name], true);
    }
  });

  return btn;
}

function disableActiveFileButtons() {
  const active = output.querySelectorAll('.file-btn:not(:disabled)');
  for (const btn of active) {
    btn.disabled = true;
  }
}

function appendOutput({ html, inputLine, items }) {
  const block = document.createElement('div');
  block.className = 'output-block';

  if (inputLine !== undefined) {
    const promptSpan = document.createElement('span');
    promptSpan.className = 'prompt-echo';
    promptSpan.textContent = `${promptEl.textContent}${inputLine}`;
    block.appendChild(promptSpan);
  }

  const content = document.createElement('div');
  content.className = 'output-content';

  if (items) {
    // Render inline file buttons instead of text
    for (const item of items) {
      content.appendChild(makeFileButton(item));
    }
  } else if (html) {
    content.innerHTML = html;
  }

  if (content.children.length > 0 || content.innerHTML) {
    block.appendChild(content);
  }

  output.appendChild(block);
  animateLines(block);
  window.scrollTo(0, document.body.scrollHeight);
}

async function runCommand(name, args, showInput) {
  const cmd = commands.getCommand(name);
  if (!cmd) return;

  disableActiveFileButtons();

  const inputLine = showInput ? [name, ...args].join(' ') : undefined;
  const result = await cmd.execute(args, ctx);

  if (result.clear) {
    output.innerHTML = '';
    updatePrompt();
    return;
  }

  const html = result.text ? render(result.text, result.isMarkdown) : '';
  appendOutput({ html, inputLine, items: result.items });
  updatePrompt();
}

function renderUtilButtons() {
  utilButtons.innerHTML = '';

  const utils = [
    { label: 'ls', action: () => runLs() },
    { label: 'cd ..', action: async () => { await runCommand('cd', ['..'], true); await runLs(); } },
    { label: 'pwd', action: () => runCommand('pwd', [], true) },
    { label: 'help', action: () => runCommand('help', [], true) },
    { label: 'clear', action: () => runCommand('clear', [], true) },
  ];

  for (const u of utils) {
    const btn = document.createElement('button');
    btn.className = 'util-btn';
    btn.textContent = u.label;
    btn.addEventListener('click', u.action);
    utilButtons.appendChild(btn);
  }
}

async function runLs() {
  await runCommand('ls', [], true);
}

export async function init() {
  await fs.init();
  updatePrompt();
  renderUtilButtons();
}
