export default {
  name: 'cd',
  description: 'Change directory',
  usage: 'cd <dir>',
  execute(args, ctx) {
    const target = args[0];
    if (!target || target === '/') {
      ctx.setCwd('/');
      return { text: '' };
    }

    if (!ctx.fs.isDir(target, ctx.cwd())) {
      return { text: `cd: ${target}: No such directory` };
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
