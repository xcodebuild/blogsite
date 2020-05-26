var Hexo = require('hexo');

var hexo = new Hexo(process.cwd(), {});

hexo.init().then(function () {

    hexo.extend.filter.register('after_post_render', function(data){
      data.content = data.content.replace(/\"(\/images\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      data.content = data.content.replace(/\"(\/css\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      data.content = data.content.replace(/\"(\/lib\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      data.content = data.content.replace(/\"(\/js\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      return data;
    });

    hexo.call('generate', {}).then(function(){
        return hexo.exit();
    }).catch(function(err){
        return hexo.exit(err);
    });
});
