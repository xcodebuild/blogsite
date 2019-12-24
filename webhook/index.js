const koa = require('koa');
const shell = require('shelljs');

const app = new koa();
 
app.use(ctx => {
  if (ctx.url.indexOf('2b90bba4-2b21-452c-908c-eb5f42533794') !== -1) {
    shell.exec('cd .. && npm run sync && npx hexo g');
    ctx.body = 'Hello Koa';
  }
});
 
app.listen(7000);
