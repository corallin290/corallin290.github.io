import * as fs from './filesystem.js';
import * as commands from './commands/registry.js';
import { render, renderInto, animateLines, applyFadeLine, fontsReady } from './renderer.js';
import * as i18n from './i18n.js';
import './lang-selector.js';
import './speed-toggle.js';

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
const inputLineEl = document.getElementById('input-line');

function updatePrompt() {
  const display = cwd === '/' ? '~' : '~' + cwd;
  promptEl.textContent = `visitor@corallins-website:${display}$ `;
}

async function appendOutput(html, inputLine, meta) {
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
  // Wait for fonts so splitIntoVisualLines measures wrap points against the
  // final Spectral metrics. Measuring against the fallback serif freezes the
  // split at wrong boundaries and the per-line delays then chain incorrectly,
  // visible on first page load as out-of-order reveals.
  await fontsReady;
  const duration = animateLines(block);
  if (duration > 0) {
    // Stamp so a mid-reveal language switch can continue the animation across
    // the content swap (see rerenderBlock) instead of leaving this sleep
    // stalled while the swapped content sits fully visible.
    block.dataset.revealStart = String(performance.now());
    block.dataset.revealDuration = String(duration);
  }
  window.scrollTo(0, document.body.scrollHeight);
  // Block the caller until the reveal finishes so chained steps animate one
  // after another, and so the new prompt can be "written" on screen as the
  // visible last line instead of appearing above output that's still sweeping.
  await new Promise((r) => setTimeout(r, duration * 1000));
}

async function executeStep(step, echoLine) {
  const { name, args } = step;
  const cmd = commands.getCommand(name);
  if (!cmd) {
    const text = i18n.get('err.cmdNotFound', { name });
    await appendOutput(render(text), echoLine, { cmd: '__notfound__', args: [name], kind: 'text' });
    return { ok: false };
  }

  const cwdSnap = cwd;
  const result = await cmd.execute(args, ctx);

  if (result.clear) {
    output.innerHTML = '';
    updatePrompt();
    return { ok: true, cleared: true };
  }

  const html = result.text ? render(result.text, result.isMarkdown, result.isHtml) : '';
  const meta = result.text
    ? { cmd: name, args, kind: result.isMarkdown ? 'markdown' : 'text', cwdSnap }
    : undefined;
  await appendOutput(html, echoLine, meta);
  return { ok: result.ok !== false };
}

async function execute(line) {
  const steps = commands.parseSequence(line);
  if (steps.length === 0) return;

  // Hide the prompt + input while output animates, then fade them back in
  // with the fade-line sweep so the new prompt reads as the last line of
  // the block instead of sitting below an in-progress reveal.
  inputLineEl.style.visibility = 'hidden';

  // Only the first step echoes the raw input line; chained steps execute
  // silently so the transcript reads as one entry, matching bash's behavior
  // where the echo is the typed line, not each expanded segment.
  for (let i = 0; i < steps.length; i++) {
    const result = await executeStep(steps[i], i === 0 ? line : undefined);
    if (result.cleared) break;
    if (!result.ok) break;
  }

  updatePrompt();
  inputLineEl.style.visibility = '';
  applyFadeLine(promptEl, promptEl.textContent.length);
  promptEl.addEventListener('animationend', () => {
    promptEl.classList.remove('fade-line');
    promptEl.style.removeProperty('--fade-delay');
    promptEl.style.removeProperty('--fade-duration');
    input.focus();
  }, { once: true });
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

  const cmdName = block.dataset.cmd;
  const args = block.dataset.args ? JSON.parse(block.dataset.args) : [];

  if (cmdName === '__notfound__') {
    renderInto(content, i18n.get('err.cmdNotFound', { name: args[0] || '' }), false);
    continueRevealIfRunning(block);
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
  renderInto(content, result.text, result.isMarkdown, result.isHtml);
  continueRevealIfRunning(block);
}

// If the block's original reveal is still in flight, continue it on the
// swapped content so it ends at the same wall-clock instant. Otherwise the
// per-step sleep would stall a chained `&& tree` for the full (now-stale)
// original duration after the swap left the new content fully visible.
function continueRevealIfRunning(block) {
  const startMs = parseFloat(block.dataset.revealStart);
  const durationS = parseFloat(block.dataset.revealDuration);
  if (!Number.isFinite(startMs) || !Number.isFinite(durationS)) return;
  const elapsedS = (performance.now() - startMs) / 1000;
  if (elapsedS >= durationS) return;
  animateLines(block, {
    targetDuration: durationS,
    startOffset: elapsedS,
    skipEcho: true,
  });
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
