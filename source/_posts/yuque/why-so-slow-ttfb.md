
---

title: TTFB 为什么这么慢

urlname: why-so-slow-ttfb

date: 2020-04-02 11:07:55 +0800

tags: []

---
TTFB （Time to First Byte）是指客户端从发起请求到接收到服务器响应的第一个字节的时间，是反应网站性能的一个重要指标 。由于网页的下载时间受到页面体积，客户端带宽等影响更大，TTFB 一般来说能够更好的反应服务端的性能。
<a name="1d6b723c"></a>
## 精确定义
上面说"从发起请求到接收到服务器响应的第一个字节"仍然有一些模糊，精确一点说，是在完成 DNS 查询、TCP 握手、SSL 握手后 **发起 HTTP 请求报文 **到 **接收到服务端第一个响应报文** 的时间差距。<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585797190134-89e36276-31aa-487b-978d-5c9065ffc621.png#align=left&display=inline&height=429&name=image.png&originHeight=858&originWidth=862&size=128265&status=done&style=none&width=431)
<a name="RTT"></a>
## RTT 和 TCP 建连 
如果不了解 RTT 和 TCP 建连的耗时，可以看一下 [TCP 建连为什么这么慢](https://www.xcodebuild.com/2020/03/26/yuque/why-so-slow-connect/)
<a name="41933693"></a>
## TTFB 多少是个合理值
我们拿到 TTFB 这个指标后，最广泛的问题就是 TTFB 究竟应该多少是个合理值？一般来说，我们可以泛泛地认为对于静态页面，50ms 是个非常理想的值（因为大部分情况下 RTT 基本就在这个范围了），而如果超过了 500ms，一般用户就会感觉到明显的等待。
<a name="c4edbbcb"></a>
### TTFB 如何构成
其实要理解 TTFB 合理的时长，我们可以看一下 TTFB 具体怎么构成。<br />
我们可以使用 tcpdump 抓一下 `curl http://www.baidu.com` 时发生了什么
```javascript
客户端 -> 服务器：seq 3612756767
服务器 -> 客户端：seq 3932881577, ack 3612756768
客户端 -> 服务器：ack 3932881578 // 到这里完成三次握手
客户端 -> 服务器：seq 3612756768:3612756845, length 77: HTTP: GET / HTTP/1.1 // 发送 GET 请求的 HTTP 报文
服务器 -> 客户端：ack 3612756845
服务器 -> 客户端：seq 3932881578:3932883030, ack 3612756845, length 1452: HTTP: HTTP/1.1 200 OK // First Byte 到达
服务器 -> 客户端：seq 3932883030:3932884359, ack 3612756845, win 776, length 1329: HTTP // 继续传输 HTTP 响应报文
// ...
```
我们看网络的来回可以发现，GET 请求发出后，到收到 First Byte 的时间其实**接近**于一个 RTT + 后端处理（一般我们叫 ServerRT）的时间。<br />
所以对一个页面的 TTFB 来说，它的**时长在通常情况下接近于和服务器的 RTT + ServerRT（可能要多一些协议层的消耗）。**
<a name="17587da8"></a>
### 试验环境验证
为了验证这个推论是否正确，我们用一些 RT 基本为零的页面进行验证。其中 Initial Connection 的时间（TCP 握手时间）也是接近 1 RTT 的。所以总体来说 TTFB 应该和  Initial Connection 非常接近。
<a name="4e2410fd"></a>
#### 空页面
准备搞台海外机器实际试试看 TTFB 和 RTT 的差距，空页面是非常接近的<br />![](https://cdn.nlark.com/yuque/0/2020/png/236311/1585796879380-d29fc5fd-495e-45ca-8035-52e904a47d4c.png#align=left&display=inline&height=790&originHeight=790&originWidth=1924&size=0&status=done&style=none&width=1924)<br />

<a name="117d2ea0"></a>
### 大体积页面
怀疑页面大小是导致协议层的开销增大（会拆成多个 TCP 包），找了个 gzip 后 100kb 的 js，访问一下看看<br />![](https://cdn.nlark.com/yuque/0/2020/png/236311/1585796879373-a00576f2-669e-46f7-a45c-f928b59d01af.png#align=left&display=inline&height=920&originHeight=920&originWidth=1914&size=0&status=done&style=none&width=1914)<br />似乎稍微大了一丢丢，但差距仍然很小，试试看更大的（gzip后仍有 1.x MB）<br />![](https://cdn.nlark.com/yuque/0/2020/png/236311/1585796879379-d368668f-4fa3-4c0d-a0d4-85f12041a9ab.png#align=left&display=inline&height=908&originHeight=908&originWidth=1926&size=0&status=done&style=none&width=1926)<br />
看到差距仍然非常小，所以说页面的体积对于 TTFB 是基本没有影响的，不会因为回传的 HTTP 报文太大导致首字节传输耗时明显增大。
<a name="f63d1776"></a>
### 如何降低 TTFB
那么，当 TTFB 很长时，我们该如何降低 TTFB 呢
<a name="7cb5a81c"></a>
#### 减少请求的传输量
例如 cookie 或者 body 很大的 POST 请求，他们的发送会更加耗时。例如当我们尝试把 cookie 变得非常长后抓到的请求变成了：
```javascript
客户端 -> 服务器：seq 2144370637:2144372089: HTTP: GET / HTTP/1.1 // 发送 GET 请求的 HTTP 报文
客户端 -> 服务器：seq 2144372089:2144372988: HTTP // 继续发送，没法送完

服务器 -> 客户端：ack 2144372089
服务器 -> 客户端：ack 2144372988 // 两次 ACK

服务器 -> 客户端 // First Byte 到达
```
发送请求的 TCP 包直接被拆成了多个，首字节说的是服务端的首字节，客户端发给服务端的包客户端需要接收完整才能做出响应然后返回。<br />
所以我们应该避免在请求中携带过多无用信息。
<a name="1d26492f"></a>
#### 减少服务端处理时间
这点最容易理解，减少服务端的处理时间（ServerRT），TTFB 自然会下降。
<a name="b4e97df0"></a>
#### 减少 RTT 时间
这点一般没有什么特别好的办法，RTT 是由网络状况和物理位置决定的，想要减少 RTT 就只能在离用户更近的地方增加服务器节点了。
<a name="7785bb09"></a>
## TTFB 越低越好么
先直接放结论，**不是的
优化性能都是为了用户体验，而 TTFB 只是描述某一段过程的参考技术指标。他只所以被看得比较重要，是因为其受影响的因素相对没那么多，能够比较客观的反应服务端的处理时间 + 网络耗时。
<a name="92d33d9b"></a>
## TTFB 和 download 的权衡
<a name="BDJtd"></a>
## Gzip
一个很典型的例子，当我们开启 Gzip 时，对于一个比较大的页面 TTFB 必然上涨（压缩需要时间），但是实际上传输的速度要快很多。用户能够更快的看到页面（首字节是无法用于渲染的）。<br />
这种情况下我们不应该去追求 TTFB 的短，真正应该在意的是用户的真实体验。
<a name="3b7ba694"></a>
### 动态加速
动态加速是个类似的例子，一些 CDN 厂商通过动态加速技术让网页更快的传输。然而由于 CDN 节点会更快的建立连接。导致发起请求的时间被提前了，而 CND 节点则承担了原来和服务器建连的成本，另外 CND 也会在节点中做一些 buffer，这都会导致 TTFB 看起来更长了，然而实际上页面的加载速度是得到了提升的。
<a name="b823255e"></a>
#### 单点测试
我们在本地针对 Akamai 的动态加速进行了单点测试
<a name="Akamai"></a>
##### Akamai
```shell
curl -w "@curl-format.txt" -so ./ppc.html https://23.218.15.80/ppc/mp3.html -H "Host: www.alibaba.com" --insecure
```


```shell
time_namelookup:  0.004775
      time_connect:  0.073131 (TCP handshake)
   time_appconnect:  0.232171 (SSL handshake)
  time_pretransfer:  0.232290
    ¦time_redirect:  0.000000
time_starttransfer:  1.401208
                   ----------
        time_total:  1.812241
```
后端 RT：1561455906142 - 1561455905344 = 798
```shell
TTFB - RTT - RT =  1169 - 69 - 798 = 300

TTFB - RT = 1169 - 798 = 371
```
<a name="a395b613"></a>
##### 美国统一接入层
```shell
curl -w "@curl-format.txt" -so ./ppc.html https://205.204.101.142/ppc/mp3.html -H "Host: www.alibaba.com" --insecure
```


```javascript
time_namelookup:  0.005029
      time_connect:  0.161610 (TCP handshake)
   time_appconnect:  0.806566 (SSL handshake)
  time_pretransfer:  0.806884
    ¦time_redirect:  0.000000
time_starttransfer:  1.830675
                   ----------
        time_total:  8.795626
```

<br />后端 RT = 1561456655052-1561456654266 = 786<br />

```shell
TTFB - RTT - RT = 1024 - 156 - 786 = 82

TTFB - RT = 1024 - 786 = 238
```
<a name="4f641c3c"></a>
##### 单点测试结论
可以看到 Akamai 的动态加速实际上使 TTFB - RT - RTT 的时间更长了（因为 CDN 节点本身的 RTT 短），同时 TTFB - RT 也变长了（CDN 会 buffer 一定量的数据才返回）。**然而总体的传输时间从 8.7s 降低到了 1.8s。**<br />
这和我们之前对首屏的观测也是一致的，动态加速拉长了 TTFB，但总体首屏是下降的。因为用户是要下载一定有效的内容才能真正进行渲染。<br />
![](https://cdn.nlark.com/yuque/0/2020/png/236311/1585796879410-eb31a3ce-3064-4d5d-8c94-18dacb1c2770.png#align=left&display=inline&height=484&originHeight=484&originWidth=1742&size=0&status=done&style=none&width=1742)
<a name="54bbba80"></a>
## 结论
TTFB 是一个非常重要的网站性能指标，能够在前端比较客观的反应出后端的耗时。**但是 First Byte 是无法渲染出任何东西的**，我们用 TTFB 来侧面衡量网站的后端耗时**不代表 TTFB 越短越好**。<br />
在有些场景下我们使用的一些优化手段让 First Byte 刻意晚了一些（gzip 内容，buffer 一定的内容再开始传输等），这个时候 TTFB 作为一个侧面印证的指标就不是那么的精确了，在这种场景下 TTFB 失去了原本的含义，不需要过于纠结。<br />
如果可能的话，还是把 ServerRT 的耗时尽可能也带到前端来参与统计。
<a name="3b40e721"></a>
## 拓展阅读

- [Stop worrying about Time To First Byte (TTFB)](https://blog.cloudflare.com/ttfb-time-to-first-byte-considered-meaningles/)
- [Server-Timing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing)
- [Round-trip delay time](https://en.wikipedia.org/wiki/Round-trip_delay_time)

