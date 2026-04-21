export default {
  name: 'ls',
  description: 'List directory contents',
  usage: 'ls [path]',
  async execute(args, ctx) {
    const target = args[0] || ctx.cwd();
    const entries = ctx.fs.list(target, ctx.cwd());

    if (!entries) {
      return { text: `ls: cannot access '${target}': No such directory` };
    }

    const names = entries.map((e) => (e.type === 'dir' ? e.name + '/' : e.name));
    return {
      text: names.join('  '),
      items: entries,
    };
  },
};
