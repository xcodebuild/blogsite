
---

title: 使用 Travis CI 自动构建开源 Electron 项目

urlname: build-open-source-electron-travis-ci

date: 2020-04-19 20:58:25 +0800

tags: []

---
<a name="NAaaf"></a>
## 背景
[LightProxy](https://github.com/alibaba/lightproxy) 是基于 Electron 开发的桌面代理软件，托管在 Github 上。我们开启了 Github 的强制 Review 功能，所有提交都需要通过 Pull Reuqest 的方式由一个 Reviewer 通过才能合并进主分支。<br />
然而虽然有这样的流程，但 Review 一个 PR 的成本仍然非常的高，对于 Reviewer 来说总是把分支 `pull` 下来走完完整的 `Electron` 构建流程再手动测试非常麻烦（尤其如果手头上的机器配置比较一般的情况下）。这导致很多 PR 我们只是简单 Review 代码后就把有问题的代码合并了。<br />
我们希望通过自动集成服务给 LightProxy 的每个 PR 都提供自动化的构建、单元测试，甚至自动把构建结果贴到 PR 中提供测试者直接下载测试。<br />
最后的效果大概为当用户提交 PR 后，会自动出发构建，得知测试结果是否通过。同时机器人会自动把构建结果上传到临时空间，并且通过评论的方式提供给开发者下载测试。例如下图：

![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1587302177272-d414cfa6-21a9-4c66-a5b5-1cd027b137af.png#align=left&display=inline&height=400&margin=%5Bobject%20Object%5D&name=image.png&originHeight=800&originWidth=1510&size=129412&status=done&style=none&width=755)
<a name="qHwFk"></a>
## Travis CI
[Travis CI](https://travis-ci.org/) 提供的是免费的自动集成服务，当我们在一个 PR 上提交了新的代码后，持续集成服务就会自动抓取代码，运行构建和自动化测试并且反馈结果。<br />
这样我们每次改动代码后，就能看到运行结果是否受到影响，而不是一次性攒了很多代码后尝试合并靠手工测试。<br />
网上介绍 `Travis CI` 以及如何搭配 `Github` 使用的文章有很多，可以参考：[持续集成服务 Travis CI 教程](http://www.ruanyifeng.com/blog/2017/12/travis_ci_tutorial.html)
<a name="dHi6L"></a>
### .travis.yml
Travis 通过 `.travis.yml` 文件进行配置，对于 LightProxy 这个项目来说主要就两点要求：<br />

- Node.js 版本 > 12
- 系统使用 macOS（因为需要构建 Mac App 必须是 macOS）



```yaml
osx_image: xcode11.3

dist: trusty
sudo: false

language: node_js
node_js: "12"

env:
  global:
    - ELECTRON_CACHE=$HOME/.cache/electron
    - ELECTRON_BUILDER_CACHE=$HOME/.cache/electron-builder

os:
  - osx

cache:
  directories:
  - node_modules
  - $HOME/.cache/electron
  - $HOME/.cache/electron-builder
  - $HOME/.npm/_prebuilds

script:
  - npm install -g yarn
  - npm run install-deps
  - npm run dist
```
这样构建部分就已经完成了，在 `Travis` 中打开 PR 的构建，用户就会在提交 PR 后看到自己的提交是否能通过构建。如果项目有单元测试的话，可以在 `scripts` 下继续增加 `npm run test` 等等。
<a name="x4DKO"></a>
### 文件上传
构建项目以及反馈结果不困难，比较麻烦的是如何把构建后的结果上传。由于这里是临时的构建版本，不是正式 `release` ，这里没有用 `github release`  API，而是用的 [https://sourceforge.net/](https://sourceforge.net/) 提供的免费文件托管服务。<br />
SourceForge 支持通过 `scp` 上传文件，首先我们需要生成一个 `ssh key` 。
```shell
ssh-keygen -t rsa -b 4096 -C "your_email" -f ci_deploy_key -N ''
```
然后在 [https://sourceforge.net/auth/shell_services](https://sourceforge.net/auth/shell_services) 添加公钥 `ci_deploy_key.pub` 的内容。<br />
我们需要从环境变量中判断当前是否在构建一个 PR（还有可能在构建一个分支），大部分的默认环境变量可以在这里找到：[https://docs.travis-ci.com/user/environment-variables/](https://docs.travis-ci.com/user/environment-variables/)。同样的，Travis 允许我们在后台设置一些环境变量，我们也可以通过这种方式把 SSH 的私钥（`ci_deploy_key`）传递过去。<br />
由于 `ci_deploy_key` 的内容是多行的，我们可以先用 `encodeURIComponent` 将其进行编码。然后在构件时通过脚本解码。
```javascript
const {
    TRAVIS_PULL_REQUEST,
    TRAVIS_COMMIT,
    SSH_KEY,
    HOME,
} = process.env;
const SSH_KEY_DECODE = decodeURIComponent(SSH_KEY);

// 判断是否在构建 PR
// 指定 ssh key
fs.writeFileSync(sshFile, sshKeyContent, 'utf-8');

shell.exec('chmod  400 ~/.ssh/id_rsa');
// scp 上传不同平台的安装包
```
代码可以参考 [https://github.com/alibaba/lightproxy/blob/develop/scripts/ci-release.js](https://github.com/alibaba/lightproxy/blob/develop/scripts/ci-release.js)
<a name="FL9uI"></a>
### 自动回复
完成了构建的上传后，我们可以用一个 `Github` 机器人自动在 PR 中回复构建后文件的 URL。<br />
Github 机器人其实就是一个单独申请的普通 Github 账号，我们可以在设置页获取到有 `repo` 操作的 `token` 。然后通过 Github API 评论 PR。
```shell
curl -s -H "Authorization: token 你的Token" -X POST -d '{"body": "评论内容"}' "https://api.github.com/repos/alibaba/lightproxy/issues/${TRAVIS_PULL_REQUEST}/comments"
```
这里的 `Token` 可以用和上面同样的方式获取。
<a name="AvaTY"></a>
### 其他测试构建逻辑
由于测试包一般是提供给开发者进行临时测试的，可能会有一些和平时不同的逻辑。我们可以在构建脚本中自动修改版本信息，甚至修改应用名（防止测试包覆盖原有配置）等。<br />
LightProxy 同时也在测试包中关闭了自动更新逻辑，方便测试者只测试指定 PR 的内容。
<a name="k1xCS"></a>
## 总结
借助于 Travis CI 的能力我们还能做更多的事情，例如在有 `release tag` 时自动合并到 `release` 分支，构建并且发布到 `release` 等等。目前考虑到下载速度的原因 `LightProxy` 还没有这样做。<br />
最后，欢迎来给 [https://github.com/alibaba/lightproxy](https://github.com/alibaba/lightproxy) 提交 PR/Issue，或者直接在 PR 下面测试相关的改进、Fix 等~
<a name="l6vBo"></a>
## 拓展阅读

- [https://github.com/alibaba/lightproxy](https://github.com/alibaba/lightproxy)
- [LightProxy 全能代理抓包工具](https://www.xcodebuild.com/2020/01/05/yuque/lightproxy/)
- [持续集成服务 Travis CI 教程](http://www.ruanyifeng.com/blog/2017/12/travis_ci_tutorial.html)
- [Travis CI - Environment Variables](https://docs.travis-ci.com/user/environment-variables/)

