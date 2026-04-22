import * as i18n from '../i18n.js';

export default {
  name: 'cd',
  get description() { return i18n.get('cmd.cd.description'); },
  usage: 'cd <dir>',
  execute(args, ctx) {
    const target = args[0];
    if (!target || target === '/') {
      ctx.setCwd('/');
      return { text: '' };
    }

    if (!ctx.fs.isDir(target, ctx.cwd())) {
      return { text: i18n.get('err.cd.noSuchDir', { target }), ok: false };
    }

    // Build new absolute path
    let parts;
    if (target.startsWith('/')) {
      parts = target.split('/').filter(Boolean);
    } else {
      parts = [...ctx.cwd().split('/').filter(Boolean), ...target.split('/').filter(Boolean)];
    }

    const resolved = [];
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') resolved.pop();
      else resolved.push(p);
    }

    ctx.setCwd('/' + resolved.join('/'));
    return { text: '' };
  },
};
