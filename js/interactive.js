import * as fs from './filesystem.js';
import * as commands from './commands/registry.js';
import { render, animateLines, applyFadeLine } from './renderer.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const promptArea = document.getElementById('prompt-area');

let commandInFlight = false;

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
    promptSpan.textContent = inputLine;
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
  const duration = animateLines(block);
  window.scrollTo(0, document.body.scrollHeight);
  return duration;
}

async function runPromptIntro() {
  // Prompt was dimmed while output animated; swap it out for the base $.
  // Utils stay hidden (they were faded out on click).
  promptEl.classList.remove('dimmed');
  promptEl.classList.add('base');
  promptEl.textContent = '$';
  await sleep(450);

  promptEl.classList.add('blinking');
  await sleep(800);
  promptEl.classList.remove('blinking');
  await sleep(400);

  // Swap to the full prompt and fade it in left-to-right. Hide with
  // visibility until the next frame so the new prompt text never flashes
  // at full opacity before the mask animation takes effect.
  promptEl.classList.remove('base');
  promptEl.style.visibility = 'hidden';
  updatePrompt();
  const duration = applyFadeLine(promptEl, promptEl.textContent.length);
  await new Promise((r) => requestAnimationFrame(r));
  promptEl.style.visibility = '';
  await sleep(duration * 800);

  // Clean up fade-line artifacts so future updatePrompt calls render cleanly.
  promptEl.classList.remove('fade-line');
  promptEl.style.removeProperty('--fade-delay');
  promptEl.style.removeProperty('--fade-duration');

  utilButtons.classList.remove('hidden');
}

function currentPromptText() {
  const display = cwd === '/' ? '~' : '~' + cwd;
  return `visitor@corallins-website:${display}$ `;
}

async function executeStep(name, args, { silent, showInput }) {
  const cmd = commands.getCommand(name);
  if (!cmd) return;

  disableActiveFileButtons();
  promptEl.classList.add('dimmed');
  utilButtons.classList.add('hidden');

  const inputLine = showInput ? [name, ...args].join(' ') : undefined;
  const result = await cmd.execute(args, ctx);

  if (result.clear) {
    output.innerHTML = '';
    updatePrompt();
    promptEl.classList.remove('dimmed');
    utilButtons.classList.remove('hidden');
    return;
  }

  const html = result.text ? render(result.text, result.isMarkdown) : '';
  const outputDuration = appendOutput({ html, inputLine, items: result.items });

  await sleep(outputDuration * 1000);

  if (!silent) {
    await runPromptIntro();
  }
}

async function runCommandSequence(steps) {
  if (commandInFlight) return;
  commandInFlight = true;
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const silent = i < steps.length - 1;
      await executeStep(step.name, step.args, { silent, showInput: true });
    }
  } finally {
    commandInFlight = false;
  }
}

async function runCommand(name, args, showInput) {
  return runCommandSequence([{ name, args }]);
}

function renderUtilButtons() {
  utilButtons.innerHTML = '';

  const utils = [
    { label: 'ls', action: () => runLs() },
    { label: 'cd ..', action: () => runCommandSequence([
      { name: 'cd', args: ['..'] },
      { name: 'ls', args: [] },
    ]) },
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
