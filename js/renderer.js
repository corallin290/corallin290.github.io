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

export function render(text, isMarkdown) {
  if (isMarkdown && typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  const el = document.createElement('pre');
  el.textContent = text;
  return el.outerHTML;
}

/**
 * Splits an element containing only text into per-visual-line wrappers by
 * wrapping each word in a span, measuring their offsetTop, and regrouping
 * them into line wrappers. Returns the array of line wrapper elements, or
 * [el] if splitting isn't applicable (nested non-text children, empty, or
 * already a single line).
 */
function splitIntoVisualLines(el) {
  if (!el.textContent || !el.textContent.trim()) return [el];

  const originalChildren = Array.from(el.childNodes);

  // Build a flat list of "units": word spans (measurable), whitespace text
  // (unmeasurable filler), and intact inline elements like <code>/<strong>
  // (measurable as one atom). This lets us handle paragraphs with nested
  // inline markup without trying to split inside those elements.
  const units = [];
  for (const child of originalChildren) {
    if (child.nodeType === Node.TEXT_NODE) {
      const parts = child.textContent.split(/(\s+)/).filter((p) => p.length > 0);
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          units.push({ kind: 'ws', text: part });
        } else {
          const span = document.createElement('span');
          span.textContent = part;
          units.push({ kind: 'measurable', el: span });
        }
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      units.push({ kind: 'measurable', el: child });
    }
  }

  // Place units back into el for measurement.
  el.textContent = '';
  for (const u of units) {
    if (u.kind === 'ws') el.appendChild(document.createTextNode(u.text));
    else el.appendChild(u.el);
  }

  const measurable = units.filter((u) => u.kind === 'measurable');
  if (measurable.length === 0) return [el];

  // Group measurables by visual line. Two elements are on the same line if
  // their vertical y-ranges overlap at all — this handles elements with
  // different heights (e.g., inline <code> with smaller font + padding).
  const groups = [];
  let current = null;
  for (const u of measurable) {
    const rect = u.el.getBoundingClientRect();
    if (!current || rect.top >= current.bottom || rect.bottom <= current.top) {
      current = { top: rect.top, bottom: rect.bottom, units: [u] };
      groups.push(current);
    } else {
      current.units.push(u);
      current.top = Math.min(current.top, rect.top);
      current.bottom = Math.max(current.bottom, rect.bottom);
    }
  }

  if (groups.length <= 1) return [el];

  // Build one mdline wrapper per visual line. Walk the original unit order
  // and place each unit into its line wrapper. Whitespace at line
  // boundaries is dropped (otherwise trailing/leading spaces linger).
  const unitToLineIdx = new Map();
  groups.forEach((g, idx) => g.units.forEach((u) => unitToLineIdx.set(u, idx)));

  const lineEls = groups.map(() => {
    const line = document.createElement('span');
    line.className = 'mdline';
    return line;
  });

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.kind === 'measurable') {
      lineEls[unitToLineIdx.get(u)].appendChild(u.el);
    } else {
      // Find the next measurable unit; if it's on the same line as the
      // previous measurable, keep this whitespace.
      let prevIdx = null;
      let nextIdx = null;
      for (let j = i - 1; j >= 0; j--) {
        if (units[j].kind === 'measurable') { prevIdx = unitToLineIdx.get(units[j]); break; }
      }
      for (let j = i + 1; j < units.length; j++) {
        if (units[j].kind === 'measurable') { nextIdx = unitToLineIdx.get(units[j]); break; }
      }
      if (prevIdx !== null && prevIdx === nextIdx) {
        lineEls[prevIdx].appendChild(document.createTextNode(u.text));
      }
    }
  }

  el.textContent = '';
  for (const line of lineEls) el.appendChild(line);
  return lineEls;
}

/**
 * Walks an output block and applies staggered fade-in animation to each
 * visual "line". For markdown content, wrapping paragraphs are split into
 * per-visual-line spans. For plain <pre> text, each newline-separated line
 * gets wrapped in its own div. The prompt echo is also treated as a line.
 */
const ECHO_FADE_SECONDS = 0.4;

export function animateLines(block) {
  const entries = []; // { el, chars }

  // The prompt echo uses a plain opacity fade (via CSS) instead of the
  // left-to-right mask sweep, so it doesn't read like a prompt being typed
  // out. Following entries are delayed so they start after the echo fades in.
  const echo = block.querySelector('.prompt-echo');
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
  let prevDelay = 0;
  let prevDuration = 0;

  for (let i = 0; i < entries.length; i++) {
    const { el, chars } = entries[i];
    const duration = chars > 0 ? chars / CHARS_PER_SECOND / REVEAL_PORTION : 0;

    let delay;
    if (i === 0) {
      // First line's reveal starts after the echo fade-in (if present),
      // shifted back by its pre-roll so the reveal lands at echoOffset.
      delay = echoOffset - PRE_ROLL * duration;
    } else {
      delay = prevDelay + (1 - POST_ROLL) * prevDuration - PRE_ROLL * duration;
    }

    el.classList.add('fade-line');
    el.style.setProperty('--fade-delay', `${delay}s`);
    el.style.setProperty('--fade-duration', `${duration}s`);

    prevDelay = delay;
    prevDuration = duration;
  }

  // Return the wall-clock time (seconds from now) at which everything
  // (echo + last line's reveal) has finished animating.
  const lastRevealEnd = entries.length > 0 ? prevDelay + (1 - POST_ROLL) * prevDuration : 0;
  return Math.max(echoOffset, lastRevealEnd);
}
