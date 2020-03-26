
---

title: 建立连接为什么这么慢

urlname: why-so-slow-connect

date: 2020-03-26 11:09:32 +0800

tags: []

---

<br />我们都知道 `HTTP` 是基于 `TCP` 的，而 `TCP` 是面向连接的。当我们向服务器请求一个页面时，首先需要建立 `TCP` 连接，才能开始真正开始传输内容。<br />
<br />这个时间平时不容易被人察觉，因为开发场景下我们往往不需要重新建立连接。但是在有些场景（尤其是新用户场景、landing page 等）却会对页面的性能造成很大的影响。<br />
<br />图中 TCP 的部分为我们常说的建连时间（这里包含了 SSL 握手时间，下文的建连时间也指的是这段时间），前面的 DNS 时间往往和建连时间同时出现，后面会讲到这一点。<br />
<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1584964408688-4c021c34-501c-408c-a704-1f30656ccbb1.png#align=left&display=inline&height=383&name=image.png&originHeight=879&originWidth=1473&size=106021&status=done&style=none&width=641)
<a name="7I6OJ"></a>
## 建连应该耗时多久
<a name="ppSgn"></a>
### RTT
在介绍建连的耗时之前，我们先介绍一下 `RTT(Round-Trip Time)` 的概念。RTT，即往返时延。指的是从发送端发送数据开始，到发送端收到来自接收端的确认（ACK）的时间。一般来说这个时间是由物理距离，网络传输路径等决定的。<br />
<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1584964922127-65173f15-e1ec-4fb1-ade1-74b65cfc8e8e.png#align=left&display=inline&height=292&name=image.png&originHeight=584&originWidth=720&size=197676&status=done&style=none&width=360)<br />

<a name="IaUYe"></a>
### RTT 一般是多久
最简单的方式就是 Ping 一下，我们在 Ping 的时候看到的 `time=xxms`  一般**接近于一个 RTT**<br />**
```bash
PING 115.239.211.112 (115.239.211.112): 56 data bytes
64 bytes from 115.239.211.112: icmp_seq=0 ttl=55 time=4.411 ms
```

<br />实际上就是一来一回（下面是 `tcpdump` 抓到的 `ping` ）：
```bash
11:59:42.631275 IP 30.38.61.21 > 115.239.211.112: ICMP echo request, id 11482, seq 0, length 64
11:59:42.635593 IP 115.239.211.112 > 30.38.61.21: ICMP echo reply, id 11482, seq 0, length 64
```


<a name="ORwmh"></a>
### 建连需要多少个 RTT
TCP 一种面向连接的通讯协议，在两个目标间发送 TCP 数据之前，TCP 需要通过三次握手建立起连接。而这个连接的过程其实是在交换一些初始数据，其中最重要的是 Sequence Number。<br />
<br />很多地方尝试用各种看起来形象的比喻来形容三次握手，但是实际上握手的过程非常简单，为了避免造成错误的理解，我们就平铺直叙，后面会解释为什么一定要经过三次握手才能建立起连接。三次握手的过程如下：<br />

1. 客户端向服务端发送 SYN，传输 seq = X
1. 服务端向客户端发送 ACK X+1，表示收到，客户端可以从 X+1 作为 seq 发送消息。同时发送 SYN，seq = Y，把自己设置成 established 状态（可接收数据）
1. 客户端向服务端发送 ACK Y+1，表示收到，服务端可以从 Y+1 作为 seq 发送消息，，把自己设置成 established 状态（可接收数据）


<br />**到了第三步客户端发送完 ACK 后就认为连接已经建立完毕（毕竟不会有第四个 ACK 再告诉它已经收到了 ACK），然后开始把应用层的数据（HTTP 报文）开始传输。而服务器端则是收到这个 ACK 后才会开始把收到的数据交付给应用层（HTTP）。**<br />**<br />**所以在这个过程中，客户端在建连上话费的时间是一个 RTT。**<br />
<br />这种情况说的是纯粹的 `Connect` 时间，不包括 `SSL` ，所以只是对 `http` 协议而言的，如果是 `https` 协议还需要再考虑 SSL 握手的时间，我们后续会在别的文章中介绍。<br />

<a name="guKHx"></a>
#### 动手试试
我们可以使用 `WireShark` 来抓取一次  `http` 请求来看看建连的过程。<br />
<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1584966581339-1ff4f09d-c1dc-4dab-a0ef-636e942cf5fa.png#align=left&display=inline&height=597&name=image.png&originHeight=1194&originWidth=2192&size=1880284&status=done&style=none&width=1096)<br />可以看到这里从发起 `seq` 到收到 `ack` （经过 1 `RTT` ）后，客户端就没有再等待直接发起了 `GET / HTTP/1.1` 的请求。<br />
<br />

<a name="tmNZ6"></a>
## 如何优化建连时间
<a name="vhZdc"></a>
### 例子
我们用一个简单的页面看看建连对网页性能的影响：[https://xcodebuild.github.io/why-so-slow/connect/index.html](https://xcodebuild.github.io/why-so-slow/connect/index.html)<br />

> 源代码在：[https://github.com/xcodebuild/why-so-slow/blob/master/connect/index.html](https://github.com/xcodebuild/why-so-slow/blob/master/connect/index.html)


<br />就像上面说的，我们在开发场景下往往不需要重新连接，包括 `Disable Cache` 是不会禁用 `TCP` 的连接复用的，所以我们使用 [Webpage Test](https://www.webpagetest.org/) 来看一下这个页面的性能状况。<br />
<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585020683958-c843ada1-7492-44d1-8c71-e65389fb9850.png#align=left&display=inline&height=582&name=image.png&originHeight=1164&originWidth=1910&size=229615&status=done&style=none&width=955)<br />
<br />我们可以看到这这个页面的 JavaScript 文件以及后面的 `fetch` 请求都有个很长的 `DNS + Connect + SSL` 时间。因为他们的域名不同，所以需要重新解析域名。不是同一个 TCP 连接，所以需要重新建连（包括 SSL 握手）。<br />
<br />在图中这个 `fetch` 请求的 `Connect + SSL` 一共耗时 `500ms` ，意味着用户必须等待这个建连完成后才能真正发起这个请求。<br />

<a name="zlxEH"></a>
### pre-connect
为了解决上面这种问题，Chrome 引入了 [`Preconnect`](https://web.dev/uses-rel-preconnect/) （现在大部分浏览器都是支持的）。<br />
<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585102598647-3d2dd3b0-fbfc-4bbc-99f5-10debdf6ee91.png#align=left&display=inline&height=150&name=image.png&originHeight=300&originWidth=736&size=76442&status=done&style=none&width=368)<br />
<br />我们可以在页面的 `<head>` 中加入<br />

```html
<link rel="preconnect" href="https://www.mocky.io" crossorigin>
```

<br />来告知浏览器提前建立连接。<br />
<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585043302410-4fc5bf0c-b9f3-45ef-bba2-3ebbe7ce0ce0.png#align=left&display=inline&height=269&name=image.png&originHeight=538&originWidth=1994&size=401496&status=done&style=none&width=997)<br />
<br />可以看到这种情况下，我们在 JS 加载后前（实际上 `fetch` 这个时候才能开始执行），就开始建立连接。同时 `preconnect` 也附带着让浏览器提前进行了 DNS 解析。<br />

<a name="QIrav"></a>
### 连接复用

<br />当然如果直接使用同一个连接，即使不使用 `pre-connect` 就能天然减少额外的连接次数。<br />

<a name="cSppd"></a>
#### 域名收拢
在 HTTP 1 时代，为了解决阻塞的问题，很多网站都做了分散域名的优化让多个请求可以并行加载。而在 HTTP 2 普及后，已经具备了连接复用的能力，使用多个分散的域名只会让我们消耗更高的连接成本。<br />
<br />所以尽可能把域名收拢到相同域名，可以尽可能的减少建连的耗时。<br />

<a name="SbrZd"></a>
#### IP 收拢
我们都知道，一个 TCP 连接是由一个四元组组成的（源 IP、源端口、目标 IP、目标端口），和域名其实没有关系。所以看起来很反直觉的一点是，当两个请求域名不同，但来自同一个 IP 时，同样可以复用连接（虽然会额外解析一次 DNS）。<br />
<br />如果我们试用了类似于阿里云全站加速的技术，把页面和静态资源的 IP 指向同一个可以帮助我们减少重复的连接建立。<br />

<a name="7UdXx"></a>
### 连接为什么不复用


<a name="8RMHh"></a>
#### 如何确定一个连接

<br />看起来无论是 `pre-connect` 还是链接复用都非常简单，但实际应用中并非如此。由于一些浏览器安全策略，不同的连接之间复用会受到一些限制。<br />
<br />在 [https://fetch.spec.whatwg.org/#cors-protocol-and-credentials](https://fetch.spec.whatwg.org/#cors-protocol-and-credentials) 我们可以看到<br />

> A user agent has an associated connection pool. A connection pool consists of zero or more connections. Each connection is identified by an origin (an origin) and credentials (a boolean).


<br />即一个连接是由 `origin` 和 `credentials` 确定的，这里的 `origin` 并非单纯是指我们加载的连接的 `origin` ，而是对于页面上不同的资源来说，会遵循不同的策略（详细的策略见 [https://html.spec.whatwg.org/multipage/origin.html#concept-origin](https://html.spec.whatwg.org/multipage/origin.html#concept-origin)）。<br />
<br />例如对于图像而言（其实对于 `script/css` 等来说也是一样的）
> For images of `[img](https://html.spec.whatwg.org/multipage/embedded-content.html#the-img-element)` elements
> If the [image data](https://html.spec.whatwg.org/multipage/images.html#img-req-data) is [CORS-cross-origin](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cors-cross-origin)
> A unique [opaque origin](https://html.spec.whatwg.org/multipage/origin.html#concept-origin-opaque) assigned when the image is created.
> If the [image data](https://html.spec.whatwg.org/multipage/images.html#img-req-data) is [CORS-same-origin](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cors-same-origin)
> The `[img](https://html.spec.whatwg.org/multipage/embedded-content.html#the-img-element)` element's [node document](https://dom.spec.whatwg.org/#concept-node-document)'s [origin](https://html.spec.whatwg.org/multipage/origin.html#concept-origin).


<br />即在有 `crossorigin` 时（不是单纯的是另外一个域名时），则其 `origin` 是图片的 `origin` 。<br />如果没有（一般来说是没有的），则 `origin` 是页面相同的 `origin` 。<br />
<br />这意味着对于 `cors` 和 `non-cors` 的请求、`credentials=true` 和 `credentials=false` 的请求来说，他们的连接是不能复用的。<br />
<br />例如 [https://xcodebuild.github.io/why-so-slow/connect/cors-non-cors.html](https://xcodebuild.github.io/why-so-slow/connect/cors-non-cors.html) 这个页面中，有四个来自同一个域名的 `img` ，但是后面两个是 `crossorigin` 的<br />

```html
<img src="https://i.picsum.photos/id/1061/200/200.jpg"/>
<img src="https://i.picsum.photos/id/1061/200/300.jpg"/>
<img src="https://i.picsum.photos/id/1061/100/300.jpg" crossorigin/>
<img src="https://i.picsum.photos/id/1061/300/300.jpg" crossorigin/>
```

<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585190581512-5105a07b-5871-4d57-ac19-829f926b978c.png#align=left&display=inline&height=458&name=image.png&originHeight=916&originWidth=1924&size=538733&status=done&style=none&width=962)<br />
<br />这样就会发现前面两个和后面两个分别能够复用连接，但是 `cors` 的和 `non-cors` 的不能复用连接。<br />

> 其实这里如果有 crossorigin="use-credentials"，其和 cors 也不能复用连接


<br />具体这么做的原因主要是为了安全考虑，在 [https://github.com/whatwg/fetch/issues/341](https://github.com/whatwg/fetch/issues/341) 中有提到，在这里不展开。<br />

<a name="0RLnO"></a>
#### 怎么避免不复用

<br />知道了怎么确定一个连接后，我们就知道怎么避免连接没有复用的问题。无论是我们尝试让两个请求复用一个连接还是通过 `preconnect` 去提前建连，都应该保持其 `cors` 和 `credentials` 的一致性。<br />
<br />由于实际规则其实蛮复杂的，并不能保证我们总是能判断策略是否符合预期，**还是建议通过 `WebPageTest` 等工具验证是否有多余的建连。**<br />
<br />当然通过 Chrome Devtools 也能够验证这一点，我们可以在 Network 面板打开 `Connection ID` ，可以看到不同的连接使用的 `Connection ID` 是不同的。<br />
<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585191129731-7ff634e7-4184-4de0-98a0-d3339c388644.png#align=left&display=inline&height=101&name=image.png&originHeight=202&originWidth=2012&size=181126&status=done&style=none&width=1006)<br />

<a name="EyboO"></a>
## 为什么要握手

<br />为什么一定要先握手才能发送 HTTP 报文呢？这是由 TCP 本身的设计决定的，TCP 是一种可靠的传输层通信协议。所谓可靠，就是能保证数据流的顺序和完整性。<br />

<a name="qVj1E"></a>
### ISN

<br />TCP 本身在网络层（IP 协议）的上层，应用层的下层（HTTP 协议）。当应用层发起请求时，把包传给 TCP，TCP 将其分割成合适的大小，将其传递给网络层。<br />
<br />为了保证不丢包，TCP 会给每一个包一个序号，接收端接受到后返回响应的确认消息。如果在合理的时间内没有收到确认，发送端则会认为发生了丢包，会尝试重新发送。<br />
<br />而作为接收端，收到的包可能是乱序的（网络层不保证传输顺序）或者重复的（例如上面重新发送的时候就会重复），就会按照接收方的序号重新组建传输包的内容，然后将其交付给应用层。<br />
<br />理解了 TCP 保证顺序和完整性的原理，就理解了 TCP 包的序号（Sequence Number**）**的重要性，而 TCP 握手时就是为了相互交换初始序列号（ISN，Inital Sequence Number**），**从而保证互相收到的包都能够保持正确的顺序。<br />

<a name="MZ1LO"></a>
#### 为什么不能用固定值

<br />从 ISN 的使用场景很自然可以想到，只要我们统一用一个固定值（例如0）作为 ISN，不就可以直接避免握手的性能损耗了么？<br />

<a name="Uj6iu"></a>
##### 避免相邻的 TCP 连接互相干扰

<br />假设我们把 ISN 统一设置为 0，当我们的客户端和一个服务器建立起连接后传输了一部分数据包后，突然网络中断了，这个时候他们之间重新建立起连接，ISN 仍然为 0。<br />
<br />这个时候服务器端可能同时收到序号为 N 的包，但却无从判断这个包属于哪一个 TCP 连接。<br />

<a name="jpz0i"></a>
##### 安全因素

<br />防止伪造的目标来源预测到 ISN 从而构造数据包干扰 TCP 通信。<br />

<a name="RPdQe"></a>
### 结论

<br />TCP 为了确保能够把数据按照正确顺序、完整的发送给目标，必须通过握手同步 ISN。而由于 TCP 是全双工的（即双向通信），握手至少需要三次才能完成。<br />
<br />其实对于客户端（浏览器）来说，从发送 ACK 到接受到 SYN-ACK 的过程就已经完成了 TCP 的建连，此时就可以开始给服务器端传输数据了。<br />

<a name="CeCLZ"></a>
## 能不能更快一点
<a name="IPdfI"></a>
### TCP Fast Open
TCP 协议每次都要等待 SYN-ACK+SYN-ACK 后，服务端的 TCP 才会把接收到的数据包传输给应用层，这样当连接不稳定时总是需要重新建立连接。那么，为什么不直接在第一次传输 SYN 时直接发送数据呢？<br />
<br />事实上在 TCP 上有一个拓展标准是支持这么做的，称之为 TCP Fast Open，在 TFO 第一次建立连接时和正常的三次握手是相同的，但客户端会额外拿到一个 TFO Cookie。而当之后再重新建立连接（例如说断网后重连，或者移动设备切换网络登）时，则直接由 SYN 携带 TFO Cookie 和数据发送。服务端收到校验 Cookie 有效直接把数据交付给应用层。<br />
<br />然而 TFO 并没有在所有的客户端和服务端默认打开，目前绝大多数浏览器都是不支持的，而且由于 TCP 作为协议层由操作系统实现，无法由应用层的浏览器、客户端等自由控制。<br />

<a name="Yk40Q"></a>
### QUIC/HTTP3
QUIC 和 HTTP3 也解决了建连耗时的问题，不在本文展开，后续会在其他文章介绍。<br />

<a name="M0DPI"></a>
## 总结
由于 HTTP 是基于 TCP 的，而 TCP 为了可靠性是面向连接的，需要通过三次握手建立连接。<br />
<br />在 HTTP2 后我们有了多路复用可以让多个请求在一个连接中进行，但是连接的复用并不是单纯由域名决定的，同一个域名的连接可能不能复用一个连接，而不同的域名其实也可能复用一个连接。我们需要尽可能确定连接被正确的复用了。如果使用了 CDN 技术，我们可以尝试让页面和资源使用相同的 IP 从而复用链接。<br />
<br />除此之外，我们可以使用 `preconnect` 来提前建连，同样的，也需要确定这个提前建立的连接被正确复用了。这对于即将发起的请求、即将到来的 `redirect` 等非常有效。

<a name="MzPEp"></a>
## 拓展阅读


- [preconnect resource hint and the crossorigin attribute](https://crenshaw.dev/preconnect-resource-hint-crossorigin-attribute/)
- [https://github.com/whatwg/fetch/issues/341](https://github.com/whatwg/fetch/issues/341)

