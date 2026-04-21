import * as fs from './filesystem.js';
import * as commands from './commands/registry.js';
import { render, animateLines } from './renderer.js';

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

function appendOutput(html, inputLine) {
  const block = document.createElement('div');
  block.className = 'output-block';

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

async function execute(line) {
  const { name, args } = commands.parse(line);

  if (!name) return;

  const cmd = commands.getCommand(name);
  if (!cmd) {
    appendOutput(render(`${name}: command not found. Type 'help' for available commands.`), line);
    return;
  }

  const result = await cmd.execute(args, ctx);

  if (result.clear) {
    output.innerHTML = '';
    updatePrompt();
    return;
  }

  const html = result.text ? render(result.text, result.isMarkdown) : '';
  appendOutput(html, line);
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

// Focus input when clicking anywhere on the page
document.addEventListener('click', (e) => {
  if (!e.target.closest('a')) {
    input.focus();
  }
});

export async function init() {
  await fs.init();
  updatePrompt();
  input.focus();

  appendOutput(render("Welcome! Type 'help' to see available commands."), undefined);
}
