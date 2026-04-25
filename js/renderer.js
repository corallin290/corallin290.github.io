// marked is loaded as a global via CDN <script> tag

// Each line "types out" at a fixed character rate. The CSS mask animation
// has pre-roll (line hidden before reveal starts) and post-roll (fully
// visible after reveal ends) because the fade band sits outside the
// container at the animation endpoints. REVEAL_PORTION is the fraction of
// the animation's duration that is actually revealing — it must match the
// CSS mask-size and gradient stops (300% mask, black 40%-transparent 60%
// gradient → reveal from X=90% to X=10% → 80% of duration).
const CHARS_PER_SECOND = 55;
const REVEAL_PORTION = 0.8;
const PRE_ROLL = (1 - REVEAL_PORTION) / 2;  // 10%
const POST_ROLL = (1 - REVEAL_PORTION) / 2; // 10%
// Opt-in cap on the total reveal time of a single output block. When speed-up
// mode is on and the block's chained reveals at CHARS_PER_SECOND would exceed
// this, the effective rate is scaled up for that block so long outputs (e.g.
// cat of a large file) finish within a predictable time instead of ~40s.
const MAX_BLOCK_REVEAL_SECONDS = 3;

let speedUpEnabled = false;
export function setSpeedUp(on) { speedUpEnabled = !!on; }
export function isSpeedUp() { return speedUpEnabled; }

// Resolves once document fonts (Spectral) have loaded. Measurement before
// this is unreliable: fallback-serif glyph widths produce different wrap
// points, so splitIntoVisualLines would freeze the split at the wrong
// boundaries and need to redo it on the loadingdone event.
export const fontsReady =
  typeof document !== 'undefined' && document.fonts
    ? document.fonts.ready.catch(() => {})
    : Promise.resolve();

// Pre-split child snapshots per element, used to restore the original DOM
// so the split can be re-run at a new container width (see observeResplit).
// WeakMap so entries are reclaimed when elements drop out of the DOM.
const originalChildrenByEl = new WeakMap();

/**
 * Apply the fade-line sweep animation to an arbitrary element. Shifts
 * delay so the visible reveal starts immediately (t=0). Returns the
 * animation's total duration in seconds.
 */
export function applyFadeLine(el, chars) {
  const duration = chars > 0 ? chars / CHARS_PER_SECOND / REVEAL_PORTION : 0;
  el.classList.add('fade-line');
  el.style.setProperty('--fade-delay', `${-PRE_ROLL * duration}s`);
  el.style.setProperty('--fade-duration', `${duration}s`);
  return duration;
}

export function render(text, isMarkdown, isHtml) {
  if (isMarkdown && typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  if (isHtml) return text;
  const el = document.createElement('pre');
  el.textContent = text;
  return el.outerHTML;
}

// Swap a content element's innerHTML in place. Used by the language-switch
// path; the caller decides whether to re-run the reveal animation (e.g. to
// continue an in-flight reveal across the swap).
export function renderInto(contentEl, text, isMarkdown, isHtml) {
  contentEl.innerHTML = render(text, isMarkdown, isHtml);
}

/**
 * Splits an element into per-visual-line <span class="mdline"> wrappers.
 * Uses Range.getClientRects/extractContents so wrap points come from the
 * browser's actual layout rather than being recomputed. Inline markup
 * (<strong>, <em>, <code>) that crosses a wrap is preserved by
 * extractContents splitting the element at the range boundary.
 * Returns [el] unchanged if the element is empty or fits on one line.
 */
function splitIntoVisualLines(el) {
  if (!el.textContent || !el.textContent.trim()) return [el];

  // Skip layout modes where children's vertical positions are driven by
  // the container (flex/grid), not by wrapped text flow. Char-top probing
  // inside such a container would misread inter-cell baseline offsets as
  // line wraps and destroy the layout. Callers that want per-line animation
  // of text inside a flex/grid container should pass the inner text-flow
  // element (e.g. a specific grid cell) instead of the container itself.
  const display = getComputedStyle(el).display;
  if (display === 'flex' || display === 'inline-flex'
      || display === 'grid' || display === 'inline-grid') {
    return [el];
  }

  // Stash pre-split children so resplit() can restore and re-run on
  // container-width or font changes.
  if (!originalChildrenByEl.has(el)) {
    originalChildrenByEl.set(
      el,
      Array.from(el.childNodes).map((n) => n.cloneNode(true)),
    );
  }

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  if (textNodes.length === 0) return [el];

  // Probe each character's top and start a new line when it jumps by more
  // than half a glyph height from the previous line's reference top. This
  // handles two cases that a strict top-equality or full-overlap test each
  // mishandle:
  //   - Siblings inside a flex row (e.g. help's .help-cmd vs description
  //     spans) can sit on the same visual row with a small baseline offset
  //     — top-equality would split them erroneously.
  //   - Adjacent wrapped lines have glyph rects whose ascender/descender
  //     bleed can make their y-ranges touch — a y-range-overlap test would
  //     fail to split them.
  // Half a glyph height is comfortably above realistic baseline jitter and
  // comfortably below a full line-height gap.
  const boundaries = [];
  const probe = document.createRange();
  let lineTop = null;

  for (const tn of textNodes) {
    const len = tn.nodeValue.length;
    for (let i = 0; i < len; i++) {
      probe.setStart(tn, i);
      probe.setEnd(tn, i + 1);
      const rects = probe.getClientRects();
      if (rects.length === 0) continue;
      const rect = rects[rects.length - 1];
      const tol = Math.max(4, rect.height * 0.5);
      if (lineTop === null) {
        lineTop = rect.top;
      } else if (Math.abs(rect.top - lineTop) > tol) {
        boundaries.push({ node: tn, offset: i });
        lineTop = rect.top;
      }
    }
  }

  if (boundaries.length === 0) return [el];

  const firstTN = textNodes[0];
  const lastTN = textNodes[textNodes.length - 1];
  const lineBounds = [];
  let prev = { node: firstTN, offset: 0 };
  for (const b of boundaries) {
    lineBounds.push({
      startNode: prev.node, startOffset: prev.offset,
      endNode: b.node, endOffset: b.offset,
    });
    prev = b;
  }
  lineBounds.push({
    startNode: prev.node, startOffset: prev.offset,
    endNode: lastTN, endOffset: lastTN.nodeValue.length,
  });

  // Extract END → START so extractContents mutations (which split text
  // nodes and elements at range boundaries) don't invalidate the
  // (node, offset) references we stored for earlier lines.
  const fragments = new Array(lineBounds.length);
  for (let i = lineBounds.length - 1; i >= 0; i--) {
    const b = lineBounds[i];
    const r = document.createRange();
    r.setStart(b.startNode, b.startOffset);
    r.setEnd(b.endNode, b.endOffset);
    fragments[i] = r.extractContents();
  }

  el.textContent = '';
  const lineEls = [];
  for (const frag of fragments) {
    const mdline = document.createElement('span');
    mdline.className = 'mdline';
    mdline.appendChild(frag);
    el.appendChild(mdline);
    lineEls.push(mdline);
  }
  return lineEls;
}

// Restore the pre-split children snapshot and re-run splitIntoVisualLines.
// Called by the ResizeObserver and document.fonts loadingdone handlers so
// wrap points track the current container width and font metrics.
export function resplit(el) {
  const original = originalChildrenByEl.get(el);
  if (!original) return [el];
  // Don't tear down mid-animation. The reveal is driven by per-mdline
  // .fade-line classes with chained delays; replacing the children here
  // produces fresh spans with no class or delay, so the still-hidden later
  // lines would pop in instantly and the already-running earlier line's
  // sweep would vanish. The animationend handler strips .fade-line when a
  // line is done, so a subtree with any .fade-line still present means the
  // reveal chain is live — leave it alone.
  if (el.classList.contains('fade-line') || el.querySelector('.fade-line')) {
    return Array.from(el.children);
  }
  el.textContent = '';
  for (const n of original) el.appendChild(n.cloneNode(true));
  return splitIntoVisualLines(el);
}

let resizeObserver = null;
let lastObservedWidth = 0;

function resplitAll(rootEl) {
  for (const el of rootEl.querySelectorAll('p, h1, h2, h3, li, .help-desc')) {
    if (originalChildrenByEl.has(el)) resplit(el);
  }
}

export function observeResplit(rootEl) {
  if (resizeObserver) return;
  lastObservedWidth = rootEl.getBoundingClientRect().width;
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = entry.contentBoxSize
        ? entry.contentBoxSize[0].inlineSize
        : entry.contentRect.width;
      if (Math.abs(w - lastObservedWidth) < 1) continue;
      lastObservedWidth = w;
      resplitAll(rootEl);
    }
  });
  resizeObserver.observe(rootEl);

  if (document.fonts) {
    document.fonts.addEventListener('loadingdone', () => resplitAll(rootEl));
  }
}

/**
 * Walks an output block and applies staggered fade-in animation to each
 * visual "line". For markdown content, wrapping paragraphs are split into
 * per-visual-line spans. For plain <pre> text, each newline-separated line
 * gets wrapped in its own div. The prompt echo is also treated as a line.
 */
const ECHO_FADE_SECONDS = 0.4;

// `targetDuration` (seconds) overrides the rate so the chained reveals fit
// exactly that wall-clock span, bypassing the speed-up cap. `startOffset`
// (seconds) shifts every entry's delay backward, treating the animation as
// having begun that long ago — used to continue an in-flight reveal across a
// content swap so the new content lands at the original wall-clock end.
// `skipEcho` ignores any .prompt-echo when computing offsets (rerender path).
export function animateLines(block, { targetDuration, startOffset = 0, skipEcho = false } = {}) {
  const entries = []; // { el, chars }

  // The prompt echo uses a plain opacity fade (via CSS) instead of the
  // left-to-right mask sweep, so it doesn't read like a prompt being typed
  // out. Following entries are delayed so they start after the echo fades in.
  const echo = skipEcho ? null : block.querySelector('.prompt-echo');
  const echoOffset = echo ? ECHO_FADE_SECONDS : 0;

  const content = block.querySelector('.output-content');
  if (content) {
    const only = content.children.length === 1 ? content.children[0] : null;
    if (only && only.tagName === 'PRE') {
      const text = only.textContent;
      only.textContent = '';
      for (const lineText of text.split('\n')) {
        const lineEl = document.createElement('div');
        lineEl.textContent = lineText || '\u00a0';
        only.appendChild(lineEl);
        entries.push({ el: lineEl, chars: lineText.length });
      }
    } else {
      for (const child of content.children) {
        // Lists: dig in so each <li> is its own line
        if (child.tagName === 'UL' || child.tagName === 'OL') {
          for (const li of child.children) {
            for (const line of splitIntoVisualLines(li)) {
              entries.push({ el: line, chars: line.textContent.length });
            }
          }
        } else if (child.classList.contains('help-grid')) {
          // Grid holds flat (.help-cmd, .help-desc) pairs. The splitter can't
          // run on the grid container (layout-driven children), so split each
          // .help-desc individually — it's plain inline text in its cell.
          const cells = child.children;
          for (let i = 0; i < cells.length; i += 2) {
            const cmd = cells[i];
            const desc = cells[i + 1];
            entries.push({ el: cmd, chars: cmd.textContent.length });
            for (const line of splitIntoVisualLines(desc)) {
              entries.push({ el: line, chars: line.textContent.length });
            }
          }
        } else {
          for (const line of splitIntoVisualLines(child)) {
            entries.push({ el: line, chars: line.textContent.length });
          }
        }
      }
    }
  }

  // Duration such that the reveal portion = chars / CHARS_PER_SECOND.
  // Delays chain so each line's reveal begins exactly when the previous
  // line's reveal ends, with their pre-roll/post-roll overlapping.
  //
  // Total reveal time across all chained entries equals
  //   totalChars / CHARS_PER_SECOND
  // (pre-roll/post-roll of adjacent lines cancel). If that would exceed
  // MAX_BLOCK_REVEAL_SECONDS, scale the rate up for this block only.
  let totalChars = 0;
  for (const e of entries) totalChars += e.chars;
  let rate;
  if (targetDuration != null && targetDuration > 0 && totalChars > 0) {
    rate = totalChars / targetDuration;
  } else {
    const naturalTotal = totalChars / CHARS_PER_SECOND;
    rate = speedUpEnabled && naturalTotal > MAX_BLOCK_REVEAL_SECONDS
      ? totalChars / MAX_BLOCK_REVEAL_SECONDS
      : CHARS_PER_SECOND;
  }

  let prevDelay = 0;
  let prevDuration = 0;

  for (let i = 0; i < entries.length; i++) {
    const { el, chars } = entries[i];
    const duration = chars > 0 ? chars / rate / REVEAL_PORTION : 0;

    let delay;
    if (i === 0) {
      // First line's reveal starts after the echo fade-in (if present),
      // shifted back by its pre-roll so the reveal lands at echoOffset.
      delay = echoOffset - PRE_ROLL * duration;
    } else {
      delay = prevDelay + (1 - POST_ROLL) * prevDuration - PRE_ROLL * duration;
    }

    el.classList.add('fade-line');
    el.style.setProperty('--fade-delay', `${delay - startOffset}s`);
    el.style.setProperty('--fade-duration', `${duration}s`);

    // Clear the fade-line class once done — otherwise the mask-image that
    // drives the reveal sweep lingers indefinitely and masks out anything
    // painted outside the element's box (e.g., a tooltip ::after positioned
    // above the element). Descendants' pseudo-elements inherit this mask.
    el.addEventListener('animationend', () => {
      el.classList.remove('fade-line');
      el.style.removeProperty('--fade-delay');
      el.style.removeProperty('--fade-duration');
    }, { once: true });

    prevDelay = delay;
    prevDuration = duration;
  }

  // Return the wall-clock time (seconds from now) at which everything
  // (echo + last line's reveal) has finished animating.
  const lastRevealEnd = entries.length > 0 ? prevDelay + (1 - POST_ROLL) * prevDuration : 0;
  return Math.max(echoOffset, lastRevealEnd);
}
