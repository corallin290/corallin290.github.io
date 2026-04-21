import * as fs from './filesystem.js';
import * as commands from './commands/registry.js';
import { render } from './renderer.js';

let cwd = '/';

const ctx = {
  fs,
  cwd: () => cwd,
  setCwd: (dir) => { cwd = dir; },
  commands,
};

const output = document.getElementById('output');
const fileButtons = document.getElementById('file-buttons');
const utilButtons = document.getElementById('util-buttons');

function appendOutput(html, inputLine) {
  const block = document.createElement('div');
  block.className = 'output-block';

  if (inputLine !== undefined) {
    const promptSpan = document.createElement('span');
    promptSpan.className = 'prompt-echo';
    promptSpan.textContent = `$ ${inputLine}`;
    block.appendChild(promptSpan);
  }

  if (html) {
    const content = document.createElement('div');
    content.className = 'output-content';
    content.innerHTML = html;
    block.appendChild(content);
  }

  output.appendChild(block);
  window.scrollTo(0, document.body.scrollHeight);
}

async function runCommand(name, args, showInput) {
  const cmd = commands.getCommand(name);
  if (!cmd) return;

  const inputLine = showInput ? [name, ...args].join(' ') : undefined;
  const result = await cmd.execute(args, ctx);

  if (result.clear) {
    output.innerHTML = '';
    await runLs();
    return;
  }

  const html = result.text ? render(result.text, result.isMarkdown) : '';
  appendOutput(html, inputLine);

  if (result.items) {
    renderFileButtons(result.items);
  }
}

function renderFileButtons(items) {
  fileButtons.innerHTML = '';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = item.type === 'dir' ? 'file-btn dir-btn' : 'file-btn';
    btn.textContent = item.type === 'dir' ? item.name + '/' : item.name;

    btn.addEventListener('click', async () => {
      if (item.type === 'dir') {
        await runCommand('cd', [item.name], true);
        await runLs();
      } else {
        await runCommand('cat', [item.name], true);
      }
    });

    fileButtons.appendChild(btn);
  }
}

function renderUtilButtons() {
  utilButtons.innerHTML = '';

  const utils = [
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
  renderUtilButtons();
  await runLs();
}
