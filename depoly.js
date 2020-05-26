const Hexo = require('hexo');
const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs');

/**
 * dir: path to the directory to explore
 * action(file, stat): called on each file or until an error occurs. file: path to the file. stat: stat of the file (retrived by fs.stat)
 * done(err): called one time when the process is complete. err is undifined is everything was ok. the error that stopped the process otherwise
 */
var walk = function(dir, action, done) {

    // this flag will indicate if an error occured (in this case we don't want to go on walking the tree)
    var dead = false;

    // this flag will store the number of pending async operations
    var pending = 0;

    var fail = function(err) {
        if(!dead) {
            dead = true;
            done(err);
        }
    };

    var checkSuccess = function() {
        if(!dead && pending == 0) {
            done();
        }
    };

    var performAction = function(file, stat) {
        if(!dead) {
            try {
                action(file, stat);
            }
            catch(error) {
                fail(error);
            }
        }
    };

    // this function will recursively explore one directory in the context defined by the variables above
    var dive = function(dir) {
        pending++; // async operation starting after this line
        fs.readdir(dir, function(err, list) {
            if(!dead) { // if we are already dead, we don't do anything
                if (err) {
                    fail(err); // if an error occured, let's fail
                }
                else { // iterate over the files
                    list.forEach(function(file) {
                        if(!dead) { // if we are already dead, we don't do anything
                            var path = dir + "/" + file;
                            pending++; // async operation starting after this line
                            fs.stat(path, function(err, stat) {
                                if(!dead) { // if we are already dead, we don't do anything
                                    if (err) {
                                        fail(err); // if an error occured, let's fail
                                    }
                                    else {
                                        if (stat && stat.isDirectory()) {
                                            dive(path); // it's a directory, let's explore recursively
                                        }
                                        else {
                                            performAction(path, stat); // it's not a directory, just perform the action
                                        }
                                        pending--; checkSuccess(); // async operation complete
                                    }
                                }
                            });
                        }
                    });
                    pending--; checkSuccess(); // async operation complete
                }
            }
        });
    };

    // start exploration
    dive(dir);
};

const hexo = new Hexo(process.cwd(), {});

hexo.init().then(function () {

    hexo.extend.filter.register('after_post_render', function(data){
      data.content = data.content.replace(/\"(\/images\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      data.content = data.content.replace(/\"(\/css\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      data.content = data.content.replace(/\"(\/lib\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      data.content = data.content.replace(/\"(\/js\/.*)\"/g, '"https://cdn.jsdelivr.net/gh/xcodebuild/blogsite@master/source$1"');
      return data;
    });

    hexo.call('generate', {}).then(function(){
        console.log('depoly');

        let client = new OSS({
            region: process.env.OSS_REGION,
            accessKeyId: process.env.OSS_ACCESSKEY_ID,
            accessKeySecret: process.env.OSS_ACCESSKEY_SECRET,
            bucket: process.env.OSS_BUCKET,
        });

        const allTask = [];

        return new Promise(r => {
            walk(path.join(__dirname, './public'), (file) => {
                console.log(file);
                allTask.push(client.put(file.replace(__dirname + '/public/', ''), file));
            }, r);
        }).then(() => {
            return Promise.all(allTask);
        });
    }).then(() => {
        return hexo.exit();
    }).catch(function(err){
        return hexo.exit(err);
    });
});
