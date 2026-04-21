export default {
  name: 'pwd',
  description: 'Print working directory',
  usage: 'pwd',
  execute(args, ctx) {
    return { text: ctx.cwd() };
  },
};
