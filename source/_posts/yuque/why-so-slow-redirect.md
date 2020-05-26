
---

title: Redirect 为什么这么慢

urlname: why-so-slow-redirect

date: 2020-04-01 23:28:57 +0800

tags: []

---
我们有个非常经典的面试题，叫做《从用户按下回车到看到页面的过程中，都发生了什么》。<br />
很多人都知道浏览器拿到 URL 后要解析域名，建立 TCP 连接、SSL 握手、等待后端响应等。当其中有个非常容易被忽略的环节： `Redirect`。<br />
只是一张比较常见的 `Performance Model` 的分析图，紧跟着 `navigationStart` 的第一步其实就是 `redirect`。<br />
更加精准的说，我们一般从监控层面统计到的 `redirect` 耗时是 `fetchStart - navigationStart` 的耗时。（后面会解释为什么不是 `redirectEnd-redirectStart` ）。<br />
![image.png](/images/assets/1585754773901-e9ed7c39-8d5f-46a3-938b-233b54b4c798.png)<br />

<a name="QaAlr"></a>
## 什么是 redirect
`redirect` 一般是指** HTTP 重定向**，例如常见的  `302/301` 等。<br />
一个常见的例子例如当我们访问  `https://baidu.com` 时就会发现连接自动变成了 `https://www.baidu.com` ，实际上是服务端响应 `302` 让浏览器重定向到了 `https://www.baidu.com` 。<br />![image.png](/images/assets/1585754773913-c1e0c9f8-6998-4874-8793-715091f01dbf.png)<br />而这个阶段实际上是非常耗时的，相比于直接访问 `https://www.baidu.com` 来说，相当于空走了一个`发起请求 => 服务端响应` 的时间。<br />
我们可以通过 WebpageTest 来看一下这两者之间的区别。<br />
访问 https://baidu.com<br />![image.png](/images/assets/1585754773941-fd3745b7-0a4f-47a2-a521-bfaa61557aa3.png)<br />访问 https://www.baidu.com<br />![image.png](/images/assets/1585754773900-b14c0816-eac7-4d71-aa2c-a2062cbb93f2.png)<br />可以看到前者经过 302 相当于整整多了一个请求，看似不经意的的一次跳转让整个访问时间几乎翻倍。
<a name="mOjXk"></a>
## 哪些情况下有 redirect
存在 redirect 的情况有很多种，比较常见的场景有：<br />

- 登录鉴权后的跳转
- http => https 的升级重定向
- baidu.com => www.baidu.com 这种域名重定向，也常见于移动设备上 baidu.com => m.baidu.com
- 从 SEO 或者站外引流渠道来的流量，往往会从 Google/Facebook 等服务器 302 过来
- 投放短链的


<br />其中一些场景是我们可控可优化的，例如把 `baidu.com => www.baidu.com` 这种重定向使用 301 而不是 302，从 `http://alibaba.com => https://www.alibaba.com` 的过程一次重定向完成而不是 `http://alibaba.com => https://alibaba.com => https://www.alibaba.com` ，以及在运营投放中尽可能避免短链等。<br />
也有部分场景虽然在我们手中，但是没有什么优化空间的，例如登录鉴权本质上就需要请求一次后端后根据响应的结果进行跳转。<br />
同时也有部分是我们完全不可控制的，例如从 Google 重定向过来的耗时。<br />
比较典型的例如我们在 Gmail 中发送的连接<br />![image.png](/images/assets/1585754773923-cf3372c8-4a0c-4948-86fe-177437034c87.png)<br />无论发送的是原连接还是文字链接，在 Gmail 的网页版中打开都会先去 `www.google.com` 的服务器，然后 302 到我们的链接上，这个过程就会造成相当长的耗时。<br />![image.png](/images/assets/1585754773957-f74dfc4f-c901-4181-84b8-ed474cdcee44.png)
<a name="JaAEE"></a>
## 前端监控如何统计 redirect
**先放结论，前端监控无法精确统计 `redirect` 耗时，我们只能统计到 `fetchStart - navigationStart`的耗时。
原因是因为浏览器的安全策略规定了我们只能拿到同域的重定向信息，其中也包括性能信息。<br />
而看上面常见的 redirect 的场景，几乎没有场景属于同域重定向。（http://baidu.com 和 https://baidu.com 也不属于同域）。于是大部分情况下，`redirectStart` 和 `redirectEnd` 都是空值。<br />

> 其实按照新的标准，如果重定向的服务端返回了 Timing-Allow-Origin Header，我们在 Performance Timing API 中也能拿到 `redirect` 相关信息。然而截止到 2020.3 为止，gmail 的跳转仍然实现这个特性。
> <br />![](/images/assets/1585755165516-1e373148-c3f9-46f8-9b98-c47f11db0570.png)


<br />**为了方便讨论，我们把能够统计的这段不精准的 `redirect` 耗时命个名，叫 `beforeFetch` **。那么这段时间中还中还包括什么时间呢？
<a name="DMmAi"></a>
### 浏览器打开耗时
是的，如果用户从浏览器外（例如钉钉）打开一个连接，钉钉通知浏览器打开新标签页甚至是冷启动的时间都会被计算到 `beforeFetch` 中。<br />
经过测试，从钉钉点开链接冷启动 Chrome，在 15 寸的 MacBook 上会导致页面的 `redirect` 耗时增加 `700ms+` 。<br />
![Untitled (1).png](/images/assets/1585754773947-9c793634-36c9-4adb-ae07-78052996a908.png)<br />
而在 Chrome 打开的情况下点开一个链接，也会增加 `80ms` 。<br />
![Untitled.png](/images/assets/1585754773944-66306574-87d3-4b37-bdd5-a083cf238801.png)<br />

<a name="owaqU"></a>
### 标签页初始化时间
同样的，初始化标签页时间也被计算在内（其实上面的 80ms 就是一种），只是平时感知不明显，如果你开着 `Auto Devtools for popup` ，在打开新标签页的情况下 `beforeFetch` 的时间也会增加的非常明显。<br />

<a name="FXvio"></a>
## 如何优化

- 减少可控部分的重定向，应该使用 `301` 的地方不要使用 `302` ，尽量不投放短链或者需要不必要重定向的连接
- 固定的 302 逻辑（例如设备重定向到不同域名）可以前置到 CDN，减少耗时
- 如果是未来即将发生的 redirect，我们可以使用 preconnect 等提前建立 redirect 的目标连接，可以参见：[TCP 建连为什么这么慢](https://www.xcodebuild.com/2020/03/26/yuque/why-so-slow-connect/)
- `beforeFetch` 的时间在某些场景（例如邮件，推送等）场景确实会高很多，除了这些场景可能存在更多重定向外，也有可能是因为浏览器启动耗时也被统计进去了



<a name="RQRec"></a>
## 参考阅读

- [TCP 建连为什么这么慢](https://www.xcodebuild.com/2020/03/26/yuque/why-so-slow-connect/)
- [Timing-Allow-Origin](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Timing-Allow-Origin)

