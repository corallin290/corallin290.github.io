import * as fs from './filesystem.js';
import * as commands from './commands/registry.js';
import { render, renderInto, animateLines, applyFadeLine, fontsReady, observeResplit } from './renderer.js';
import * as i18n from './i18n.js';
import './lang-selector.js';
import './speed-toggle.js';

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

observeResplit(output);

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
      await runCommandSequence(
        [{ name: 'cd', args: [item.name] }, { name: 'ls', args: [] }],
        { displayCommand: `cd ${item.name} && ls` },
      );
    } else {
      await runCommandSequence(
        [{ name: 'cat', args: [item.name] }, { name: 'ls', args: [] }],
        { displayCommand: `cat ${item.name} && ls` },
      );
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
  btn.dataset.tooltipKey = 'ui.tooltip.parentDir';
  btn.dataset.tooltip = i18n.get('ui.tooltip.parentDir');
  btn.addEventListener('click', async () => {
    await runCommandSequence(
      [{ name: 'cd', args: ['..'] }, { name: 'ls', args: [] }],
      { displayCommand: 'cd .. && ls' },
    );
  });
  return btn;
}

async function appendOutput({ html, items, commandName, meta }) {
  const block = document.createElement('div');
  block.className = 'output-block';

  if (meta) {
    if (meta.kind) block.dataset.kind = meta.kind;
    if (meta.cmd) block.dataset.cmd = meta.cmd;
    if (meta.args) block.dataset.args = JSON.stringify(meta.args);
    if (meta.cwdSnap !== undefined) block.dataset.cwdSnap = meta.cwdSnap;
  }

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
  await fontsReady;
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
  await sleep(200);

  promptEl.classList.add('blinking');
  await sleep(600);
  promptEl.classList.remove('blinking');
  await sleep(100);

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

async function runCommandSequence(steps, { displayCommand } = {}) {
  if (commandInFlight) return;
  commandInFlight = true;
  try {
    disableActiveFileButtons();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const promptText = currentPromptText();
      const isFirst = i === 0;

      if (isFirst) {
        // User-initiated: animate the live prompt-area into its committed state.
        // When a displayCommand is supplied, show the full compound (e.g.
        // `cat foo && ls`) as the prompt text so chained steps don't need
        // their own echo — matching bash, which prints one prompt per line.
        const commandText = displayCommand ?? [step.name, ...step.args].join(' ');
        await animateLivePromptCommit(promptText, commandText);
      } else if (!displayCommand) {
        // Chained step without a compound displayCommand: the live prompt-area
        // is already hidden, so drop a committed echo into the output directly.
        const commandText = [step.name, ...step.args].join(' ');
        output.appendChild(createEchoDiv(promptText, commandText));
        window.scrollTo(0, document.body.scrollHeight);
      }

      const cmd = commands.getCommand(step.name);
      if (!cmd) continue;

      const cwdSnap = cwd;
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
      // Silent chained steps (under a compound displayCommand) rendered no
      // echo, so there's nothing to settle — skip the pause.
      if (isFirst || !displayCommand) {
        await sleep(250);
      }

      const html = result.text ? render(result.text, result.isMarkdown, result.isHtml) : '';
      const kind = result.items ? 'buttons' : (result.isMarkdown ? 'markdown' : 'text');
      const meta = (result.text || result.items)
        ? { cmd: step.name, args: step.args, kind, cwdSnap }
        : null;
      const outputDuration = await appendOutput({ html, items: result.items, commandName: step.name, meta });
      await sleep(outputDuration * 1000);

      // Short-circuit on failure so a chained sequence (e.g. `cd x && ls`)
      // skips the rest when an earlier step errors out.
      if (result.ok === false) break;
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
    btn.dataset.cmdName = u.name;
    const cmd = commands.getCommand(u.name);
    if (cmd) btn.dataset.tooltip = cmd.description;
    btn.addEventListener('click', u.action);
    utilButtons.appendChild(btn);
  }
}

// ── Tooltips ──
// Single shared tooltip element, positioned relative to the viewport so it
// can clamp/flip when an anchor sits near a window edge. Reachable through
// three input modalities:
//   • Mouse/trackpad — pointerover/pointerout, gated on pointerType so that
//     touch-synthesised pointer events don't flash the tooltip in the frame
//     before the tap's click fires.
//   • Keyboard — focusin/focusout, Escape to dismiss (WAI-ARIA tooltip).
//   • Touch/pen — long-press (~500ms) peeks the tooltip and suppresses the
//     would-be click; a short tap runs the underlying action as usual.
let tooltipEl = null;
let currentTarget = null;

function ensureTooltip() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip';
  tooltipEl.id = 'tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function showTooltip(target) {
  const text = target.dataset.tooltip;
  if (!text) return;
  const el = ensureTooltip();
  el.textContent = text;
  // Make visible (but still opacity 0) so we can measure.
  el.style.left = '0px';
  el.style.top = '0px';
  el.classList.add('visible');

  const gap = 6;
  const margin = 8;
  const anchor = target.getBoundingClientRect();
  const tip = el.getBoundingClientRect();

  // Horizontal: center over anchor, then clamp to viewport.
  let left = anchor.left + anchor.width / 2 - tip.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin));

  // Vertical: prefer above; flip below if that would clip the top edge.
  let top = anchor.top - tip.height - gap;
  if (top < margin) top = anchor.bottom + gap;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;

  if (currentTarget && currentTarget !== target) {
    currentTarget.removeAttribute('aria-describedby');
  }
  target.setAttribute('aria-describedby', 'tooltip');
  currentTarget = target;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.classList.remove('visible');
  if (currentTarget) {
    currentTarget.removeAttribute('aria-describedby');
    currentTarget = null;
  }
  touchTooltipShown = false;
}

// Hover capability can change mid-session (e.g. a mouse is plugged into a
// touchscreen laptop). Clear any stale tooltip when the environment flips.
window.matchMedia('(hover: hover) and (pointer: fine)')
  .addEventListener('change', hideTooltip);

// ── Mouse path ──
// Delegated: works for buttons created at any time without per-button wiring.
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const target = e.target.closest('[data-tooltip]');
  if (target) showTooltip(target);
});
document.addEventListener('pointerout', (e) => {
  if (e.pointerType !== 'mouse') return;
  const target = e.target.closest('[data-tooltip]');
  if (target && !target.contains(e.relatedTarget)) hideTooltip();
});

// ── Keyboard path ──
document.addEventListener('focusin', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (target) showTooltip(target);
});
document.addEventListener('focusout', (e) => {
  const target = e.target.closest('[data-tooltip]');
  if (!target) return;
  // If focus is moving to another tooltipped element, the subsequent focusin
  // will reposition; skipping the hide here avoids a fade-out/fade-in flicker.
  const next = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tooltip]');
  if (!next) hideTooltip();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentTarget) hideTooltip();
});

// ── Touch path (long-press) ──
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;
let pressTimer = null;
let pressStart = null;
let touchTooltipShown = false;

function clearPressTimer() {
  if (pressTimer !== null) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  pressStart = null;
}

// After a successful long-press, the touch gesture still synthesises a click
// on release. Swallow exactly one click in the capture phase so neither the
// button's registered handler nor any delegated click listener fires.
function suppressNextClick() {
  document.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, { capture: true, once: true });
}

document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
  // Any new tap dismisses a sticky touch tooltip before doing anything else.
  if (touchTooltipShown) hideTooltip();

  const target = e.target.closest('[data-tooltip]');
  if (!target) return;

  pressStart = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    pressStart = null;
    showTooltip(target);
    touchTooltipShown = true;
    suppressNextClick();
  }, LONG_PRESS_MS);
});
document.addEventListener('pointermove', (e) => {
  if (!pressStart) return;
  const dx = e.clientX - pressStart.x;
  const dy = e.clientY - pressStart.y;
  if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPressTimer();
});
document.addEventListener('pointerup', clearPressTimer);
document.addEventListener('pointercancel', clearPressTimer);

// ── Language change ──
// Refresh tooltips on every button that sources its text from i18n, and
// re-run stored output-producing commands so their .output-content picks up
// the new-locale strings (file contents via filesystem fallback, error
// messages via i18n.get in the command modules).
function refreshTooltips() {
  // Util buttons read from their referenced command's description getter.
  for (const btn of utilButtons.querySelectorAll('[data-cmd-name]')) {
    const cmd = commands.getCommand(btn.dataset.cmdName);
    if (cmd) btn.dataset.tooltip = cmd.description;
  }
  // Parent-dir buttons (and any future key-based tooltip) resolve via i18n.
  for (const btn of document.querySelectorAll('[data-tooltip-key]')) {
    btn.dataset.tooltip = i18n.get(btn.dataset.tooltipKey);
  }
}

async function rerenderBlock(block) {
  const content = block.querySelector('.output-content');
  if (!content) return;

  const kind = block.dataset.kind;
  // Buttons blocks are file/dir listings — filenames don't translate, and
  // their embedded parent-dir tooltip is refreshed via refreshTooltips.
  if (kind === 'buttons') return;

  const cmdName = block.dataset.cmd;
  const args = block.dataset.args ? JSON.parse(block.dataset.args) : [];

  const cmd = commands.getCommand(cmdName);
  if (!cmd) return;

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
}

document.addEventListener('languagechange', async () => {
  hideTooltip();
  refreshTooltips();
  const blocks = output.querySelectorAll('.output-block[data-kind]');
  for (const block of blocks) {
    await rerenderBlock(block);
  }
});

export async function init() {
  await fs.init();
  updatePrompt();
  renderUtilButtons();
}
