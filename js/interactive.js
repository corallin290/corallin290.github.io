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

function currentPromptText() {
  const display = cwd === '/' ? '~' : '~' + cwd;
  return `visitor@corallins-website:${display}$ `;
}

function updatePrompt() {
  promptEl.textContent = currentPromptText();
}

function makeFileButton(item) {
  const btn = document.createElement('button');
  btn.className = item.type === 'dir' ? 'file-btn dir-btn' : 'file-btn';
  btn.textContent = item.type === 'dir' ? item.name + '/' : item.name;

  btn.addEventListener('click', async () => {
    if (item.type === 'dir') {
      await runCommand('cd', [item.name]);
    } else {
      await runCommand('cat', [item.name]);
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

function makeParentDirButton() {
  const btn = document.createElement('button');
  btn.className = 'file-btn dir-btn';
  btn.textContent = '..';
  btn.dataset.tooltip = 'Go to parent directory';
  btn.addEventListener('click', async () => {
    await runCommand('cd', ['..']);
  });
  return btn;
}

function appendOutput({ html, items, commandName }) {
  const block = document.createElement('div');
  block.className = 'output-block';

  const content = document.createElement('div');
  content.className = 'output-content';

  if (items) {
    if (commandName === 'ls' && cwd !== '/') {
      content.appendChild(makeParentDirButton());
    }
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

// Snapshot of the committed prompt-area state — styled to match the live
// prompt-area's transitioned appearance exactly, so swapping one for the
// other at commit time is visually seamless.
function createEchoDiv(promptText, commandText) {
  const div = document.createElement('div');
  div.className = 'prompt-area-committed';

  const promptSpan = document.createElement('span');
  promptSpan.className = 'prompt-committed';
  promptSpan.textContent = promptText;
  div.appendChild(promptSpan);

  if (commandText) {
    const cmdSpan = document.createElement('span');
    cmdSpan.className = 'command-committed';
    cmdSpan.textContent = commandText;
    div.appendChild(cmdSpan);
  }

  return div;
}

// Animate the live prompt-area transitioning into its committed state: the
// prompt dims, util-buttons fade out, and the selected command fades in
// where the buttons were. After the transition, append an echo snapshot to
// #output and reset the live prompt-area to its pre-intro state.
async function animateLivePromptCommit(promptText, commandText) {
  // Phase 1: dim the prompt and fade the util-buttons out in place.
  promptEl.classList.add('dimmed');
  utilButtons.classList.add('hidden');

  // Let the util-buttons fade complete (0.15s) before removing them from
  // layout. Inserting the command span while the buttons still occupy
  // space would shove the buttons sideways mid-fade.
  await sleep(150);
  utilButtons.style.display = 'none';

  // Phase 2: now that buttons are out of flow, slot the command span into
  // the position they occupied (right after the prompt) and fade it in.
  const cmdSpan = document.createElement('span');
  cmdSpan.className = 'prompt-command';
  cmdSpan.textContent = commandText;
  promptArea.appendChild(cmdSpan);

  await new Promise((r) => requestAnimationFrame(r));
  cmdSpan.classList.add('visible');

  // Wait for the cmdSpan's 0.5s fade-in to fully complete — otherwise the
  // instant-full-opacity echoDiv that replaces the live prompt-area at
  // commit time would read as a brightness snap.
  await sleep(500);

  // Commit: snapshot into #output, then snap-hide the live prompt-area via
  // display:none so its transitioned contents don't briefly duplicate the
  // echoDiv's (the echo sits where the prompt-area was; the prompt-area
  // would otherwise fade out visibly below it). .hidden is pre-set so the
  // next intro triggers an opacity fade-in. util-buttons stays .hidden so
  // it re-fades-in at the tail end of runPromptIntro.
  output.appendChild(createEchoDiv(promptText, commandText));
  promptArea.style.display = 'none';
  cmdSpan.remove();
  promptEl.classList.remove('dimmed');
  promptArea.classList.add('hidden');

  window.scrollTo(0, document.body.scrollHeight);
}

async function runPromptIntro() {
  // Prompt-area is hidden; prep the base $ state before unhiding so the
  // full prompt text doesn't flash visible.
  promptEl.classList.add('base');
  promptEl.textContent = '$';
  // Restore util-buttons and prompt-area layout (both were display:none
  // during the commit). util-buttons stays .hidden so it can fade in at
  // the tail end of the intro.
  utilButtons.style.display = '';
  promptArea.style.display = '';
  // Wait a frame so the browser has a painted "from" state at opacity 0
  // before we trigger the opacity transition.
  await new Promise((r) => requestAnimationFrame(r));
  promptArea.classList.remove('hidden');
  await sleep(450);

  promptEl.classList.add('blinking');
  await sleep(800);
  promptEl.classList.remove('blinking');
  await sleep(400);

  // Swap to the full prompt and fade it in left-to-right.
  promptEl.classList.remove('base');
  promptEl.style.visibility = 'hidden';
  updatePrompt();
  const duration = applyFadeLine(promptEl, promptEl.textContent.length);
  await new Promise((r) => requestAnimationFrame(r));
  promptEl.style.visibility = '';
  await sleep(duration * 800);

  promptEl.classList.remove('fade-line');
  promptEl.style.removeProperty('--fade-delay');
  promptEl.style.removeProperty('--fade-duration');

  utilButtons.classList.remove('hidden');
}

async function runCommandSequence(steps) {
  if (commandInFlight) return;
  commandInFlight = true;
  try {
    disableActiveFileButtons();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const promptText = currentPromptText();
      const commandText = [step.name, ...step.args].join(' ');
      const isFirst = i === 0;

      if (isFirst) {
        // User-initiated: animate the live prompt-area into its committed state.
        await animateLivePromptCommit(promptText, commandText);
      } else {
        // Chained step: the live prompt-area is already hidden, so just
        // drop a committed echo into the output directly.
        output.appendChild(createEchoDiv(promptText, commandText));
        window.scrollTo(0, document.body.scrollHeight);
      }

      const cmd = commands.getCommand(step.name);
      if (!cmd) continue;

      const result = await cmd.execute(step.args, ctx);

      if (result.clear) {
        output.innerHTML = '';
        promptArea.style.display = '';
        utilButtons.style.display = '';
        utilButtons.classList.remove('hidden');
        promptArea.classList.remove('hidden');
        updatePrompt();
        return;
      }

      // Small pause so the committed echo settles before output slides in.
      await sleep(250);

      const html = result.text ? render(result.text, result.isMarkdown) : '';
      const outputDuration = appendOutput({ html, items: result.items, commandName: step.name });
      await sleep(outputDuration * 1000);
    }

    await runPromptIntro();
  } finally {
    commandInFlight = false;
  }
}

async function runCommand(name, args) {
  return runCommandSequence([{ name, args }]);
}

function renderUtilButtons() {
  utilButtons.innerHTML = '';

  const utils = [
    { label: 'ls', name: 'ls', action: () => runCommand('ls', []) },
    { label: 'pwd', name: 'pwd', action: () => runCommand('pwd', []) },
    { label: 'help', name: 'help', action: () => runCommand('help', []) },
    { label: 'clear', name: 'clear', action: () => runCommand('clear', []) },
  ];

  for (const u of utils) {
    const btn = document.createElement('button');
    btn.className = 'util-btn';
    btn.textContent = u.label;
    const cmd = commands.getCommand(u.name);
    if (cmd) btn.dataset.tooltip = cmd.description;
    btn.addEventListener('click', u.action);
    utilButtons.appendChild(btn);
  }
}

export async function init() {
  await fs.init();
  updatePrompt();
  renderUtilButtons();
}
