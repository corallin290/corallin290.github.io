import * as i18n from '../i18n.js';

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);

export default {
  name: 'tree',
  get description() { return i18n.get('cmd.tree.description'); },
  usage: 'tree [path]',
  execute(args, ctx) {
    const target = args[0] || ctx.cwd();
    if (!ctx.fs.isDir(target, ctx.cwd())) {
      return { text: i18n.get('err.tree.noSuchDir', { target }), ok: false };
    }

    const rootAbs = resolveAbs(target, ctx.cwd());
    // When invoked without an arg, show "." as the root label (matches
    // GNU tree). With an arg, echo whatever the user typed.
    const rootLabel = args[0] ? target : '.';

    const lines = [{ prefix: '', name: rootLabel, type: 'dir', absPath: rootAbs, isRoot: true }];

    function walk(absPath, indent) {
      const entries = ctx.fs.list(absPath, '/');
      if (!entries) return;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const isLast = i === entries.length - 1;
        const prefix = indent + (isLast ? '└── ' : '├── ');
        const childAbs = absPath === '/' ? '/' + e.name : absPath + '/' + e.name;
        lines.push({ prefix, name: e.name, type: e.type, absPath: childAbs });
        if (e.type === 'dir') {
          walk(childAbs, indent + (isLast ? '    ' : '│   '));
        }
      }
    }
    walk(rootAbs, '');

    // HTML used by terminal mode (and as the data-kind='tree' fallback):
    // each line is its own child of .output-content, so animateLines can
    // reveal them one at a time without resplitting. The prefix span is
    // monospace so box-drawing chars align across nesting depths.
    const html = lines.map((l) => {
      // Root row prints its label verbatim (matches GNU tree: `.` or the
      // path the user typed). Every other dir gets a trailing slash.
      const suffix = !l.isRoot && l.type === 'dir' ? '/' : '';
      return `<div class="tree-line">`
        + `<span class="tree-prefix">${escape(l.prefix)}</span>`
        + `${escape(l.name + suffix)}`
        + `</div>`;
    }).join('');

    return { text: html, isHtml: true, treeLines: lines };
  },
};

function resolveAbs(path, cwd) {
  let parts;
  if (path.startsWith('/')) {
    parts = path.split('/').filter(Boolean);
  } else {
    const cwdParts = cwd.split('/').filter(Boolean);
    parts = [...cwdParts, ...path.split('/').filter(Boolean)];
  }
  const resolved = [];
  for (const p of parts) {
    if (p === '.') continue;
    if (p === '..') resolved.pop();
    else resolved.push(p);
  }
  return '/' + resolved.join('/');
}
