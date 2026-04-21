export default {
  name: 'cat',
  description: 'Print file contents',
  usage: 'cat <file>',
  async execute(args, ctx) {
    if (!args[0]) {
      return { text: 'usage: cat <file>' };
    }

    const content = await ctx.fs.read(args[0], ctx.cwd());
    if (content === null) {
      return { text: `cat: ${args[0]}: No such file` };
    }

    return { text: content, isMarkdown: true };
  },
};
