
---

title: LightProxy 全能代理抓包工具

urlname: lightproxy

date: 2020-01-05 14:21:54 +0800

tags: []

---
> 原文地址：[https://github.com/alibaba/lightproxy/issues/19](https://github.com/alibaba/lightproxy/issues/19)

<a name="u8H7E"></a>
## ![image.png](/images/assets/1578205382432-2c9cc104-2fef-4ea8-b31e-951cbee73da4.png)

`LightProxy` 是 `IFE` 团队开发的一款基于 `Electron` 和 `whistle` 的开源桌面代理软件，致力于让前端开发人员能够精确的掌握自己的开发环境，通过 `HTTP` 代理使用规则转发、修改每一个请求和响应的内容。

![image.png](/images/assets/1578205761175-e5d216c9-dd52-4d73-98de-d8638791f017.png)
<a name="vz7QC"></a>
## 
<a name="NJPM5"></a>
## 为什么需要一个代理工具
**因为代理工具能够让你随心所欲的掌控自己当前的开发环境。**

**开发环境**是影响研发效能最大的一个因素之一，不可用的环境，无法完成的部署，不稳定的上游环境等等都**让一个非常简单的需求轻松消耗掉数天的时间**。

当开发环境陷入一种不健康的状态时，开发者就更容易破罐子破摔。宁可忍受每改一行代码重新手动 `build` 几分钟再开发也不愿意花时间让 watch 可用，然后发现自己越来越忙乱。

> ![image.png](/images/assets/1578206007497-b7935205-d8a8-4fc3-866d-0bc62c5a2814.png)
> 
> 希腊神话中有一个受到惩罚的人西西弗斯，他受罚的方式是：必须将一块巨石推上山顶，而每次到达山顶后巨石又滚回山下，如此永无止境地重复下去。在西方语境中，形容词“西西弗斯式的”（英语：sisyphean）形容“永无尽头而又徒劳无功的任务”。


当你的接口和页面突然不能工作时，代理工具可以快速 `mock` 一个。当你想测试一下线上页面改动可能会带来的后果，代理工具可以让你不经过复杂的发布过程快速在本地看到想要的效果。

<a name="CJSHA"></a>
## 什么是好的开发环境
既然我们在讨论开发环境对于研发效率的影响，那我们先来看一看什么是好的前端开发环境。

<a name="UmNIw"></a>
### 稳定
好的开发环境首先应该是稳定可用的，不应该在开发测试的过程中频繁挂掉或者频繁发生改变。<br />依赖于后端日常接口进行调试的前端对这点应该深有体会，自己的问题还没解决，环境就时常带来新的问题。

<a name="JgdYr"></a>
### 快速验证
修改代码能够在尽可能短的时间内得到验证也是一个基本诉求，这也是为什么大部分前端构建都会关注 `Hot reload` 和更高级的 `HMR` 。

有些场景下的修改一次简单的修改就要经过长时间的等待，例如依赖上游修改接口的返回内容，需要修改后端的页面结构然后重新部署，需要走一遍完整的发布流程来测试某个修改在真实的线上页面会产生的影响等等。

这种改一行等几十分钟的开发方式对效率的拖累是极其恐怖的。

![image.png](/images/assets/1578275488620-13ad673e-fa57-4715-b1d7-fd6adf8dbc5f.png)

<a name="r9l9z"></a>
### 和线上的一致性
很多项目的线上环境极为复杂，为了解决日常开发中的问题，也会有一个线下的 `DEMO` 页面，最后开发完再搬到线上。

这种方式相对来说较为稳定且能快速验证，但比较凸显的问题在于和线上并不一致。开发中会存在很多 `if-else` 的逻辑，例如最常见的：

```javascript
const API_BASE = utils.isDaily ? 'http://localhost:7001:': 'https://xxxx/';
```

这种情况也往往导致 `Bug` 非常难以被定位，最后逼着开发者退化到在线上环境低效的进行 debug。

<a name="3MNL0"></a>
### 确定性
开发者对于当前的环境应该是有确切认知的，而不是一直不停的怀疑自己的配置到底有没有生效，命中的是不是又是缓存等等。

有些情况下我们利用 `hosts` 切换工具来进行联调，但在切完 `hosts` 后却又不得不来回确认自己的切换是否生效，清楚 Chrome 的 DNS Cache，清楚 Socket 之类的。

这种非确定性不但提高了开发者心智负担，而且也会导致 Bug 难以定位。

<a name="6aYPs"></a>
## LightProxy 如何解决这些问题
那么 `LightProxy` 要如何解决上面的这些问题呢

`LightProxy` 通过基于 `whistle` 的代理能力，能够任意修改开发环境中的 `request` 和 `response` 。

<a name="WxTiC"></a>
### 举个例子
例如当我们需要在线上页面中加入一个 `DIV` ，如果没有代理我们需要依赖后端一套类似的预发环境，而有了 `LightProxy` 我们只需要使用：

```javascript
https://www.alibaba.com/ htmlPrepend://(<div>test</div>)
```

![image.png](/images/assets/1578276397871-fcf46678-c2a3-48bb-83cd-02bf2bd7e201.png)

就可以在一个线上的页面中插入一个 `div` 。

同样的，我们可以直接把页面中的一个 `JS` 转发到本地一个开发中的文件

```javascript
https://www.google.com/xx.js file:///User/xxx/xxx.js
```

当后端缺少 `CORS` 头时，我们可以直接给它先加上 `CORS` 头

```javascript
https://xxx.com/xx.json resCors:// # 给响应的请求增加 CORS header
```

也可以直接把某个文件变成一个内联的文字，只要用类似 `ES6` 字符串框起来

```javascript
https://xxx.com/xx.json `test text`
```

总体来说，`LightProxy` 能够让开发者完全掌控自己的开发环境，用极低的成本定制自己的开发环境，而不是总是在等待依赖方按照自己的需求提供相应的环境。

甚至于，你可以自己用 `NodeJS` 书写针对某个规则的响应：[使用 NodeJS 编写规则](https://alibaba.github.io/lightproxy/write-rule-with-nodejs.html#%E4%BD%BF%E7%94%A8)

<a name="DTTMJ"></a>
## 快速确认
为了能够快速确认代理是否按预期工作，我们在经过 `LightProxy` 代理的网络请求的 Response Header 增加了一些相关的信息，用于协助开发人员快速确认当前请求命中了什么规则，以及这个请求是怎么来的（由谁响应，匹配什么规则，实际真正访问的来源）。

![image.png](/images/assets/1578276694637-f5b52b24-5e76-43c4-9425-3f2787c7e8c5.png)

<a name="SASae"></a>
## 没有银弹
虽然说代理工具可以快速的解决各种开发环境上的坑，但也并不是银弹。

这种方案更加适合在开发阶段快速绕过各种拦路虎，但最终在多人协作中仍然需要有健康的环境来保障项目的协作流程流畅，不能因为有了代理工具后就完全无视开发环境的问题。

<a name="19TAe"></a>
## 开始 & 下载
说了这么多，开始使用 `LightProxy` 控制你的开发环境吧：[https://github.com/alibaba/lightproxy](https://github.com/alibaba/lightproxy)

<a name="B9W04"></a>
### 下载
[**macOS 版**](https://gw.alipayobjects.com/os/LightProxy/LightProxy.dmg)<br />[**Windows 版**](https://gw.alipayobjects.com/os/LightProxy/LightProxy-Setup.exe)

<a name="ddxHZ"></a>
## 问题反馈
欢迎加入钉钉群讨论和反馈问题，或者直接在 issue 反馈问题：[https://github.com/alibaba/lightproxy/issues](https://github.com/alibaba/lightproxy/issues)

> ps: Whistle 的作者也在群里，欢迎来撩

![image.png](/images/assets/1578277057662-2ff248c8-7f29-4ad3-88ff-8381e8a99095.png)

