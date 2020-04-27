
---

title: 网页渲染为什么这么慢

urlname: why-so-slow-webpage-rendering

date: 2020-04-02 22:33:11 +0800

tags: []

---
当浏览器开始下载 HTML 后，就会一遍解析一遍开始渲染页面的内容。我们做性能优化其中一个重要的目的就是为了让用户尽可能早的看到有效的内容，所以了解浏览器的渲染机制是非常有必要的。
<a name="93cmh"></a>
## 渲染过程
<a name="7t3co"></a>
### HTML
HTML 显而易见是渲染必不可少的内容，浏览器接收到 HTML 的内容就会开始解析内容，构建响应的 DOM 树。浏览器并不依赖于下载或者解析完完整的 HTML，而是解析一部分渲染一部分。<br />
我们可以在响应头中增加 `Transfer-Encoding:chunked` 告知浏览器 HTML 将会被一块块的流式返回，在这个基础上 facebook 构建了 bigpipe，通过在服务器端流式地返回 HTML 给浏览器，你会看到自己的个人首页是随着数据的加载一块一块的渲染出来的，这样可以避免一次性获取大量的数据才开始渲染页面。
<a name="JWG6a"></a>
#### Chunk 和缓冲
当我们使用 chunk 流式返回 HTML 内容时，我们期望浏览器能够马上渲染接收到的 chunk 块，但实际情况下有些浏览器则会缓冲一定的长度。例如下图中 Safari 使用 bigpipe 渲染，浏览器一直等到 `this is pagelet 1` 才渲染页面，然后完成后续渲染。<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585838072215-a9fab628-ddaa-4974-9b19-60dd6e1c69be.png#align=left&display=inline&height=231&name=image.png&originHeight=462&originWidth=1264&size=199221&status=done&style=none&width=632)<br />而当我们把 `Welcome to ...` 加长后 ，Safari 则直接渲染出首屏再完成后续的渲染<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585838081766-1342ab0c-bcdf-4913-9e59-527e4cbf7ab5.png#align=left&display=inline&height=170&name=image.png&originHeight=340&originWidth=1368&size=144463&status=done&style=none&width=684)<br />Chunk 缓冲区的具体长度没有明确的标准，根据 StackOverflow 上的回答，当前客户端 chunk 缓冲区大小大概如下：
```html
Mac:                       text/html:     image/jpeg:
curl 7.24.0                4096 bytes     
Firefox 17                 1024 bytes     1886 bytes
Chrome 26.0.1410.65        1024 bytes     1885 bytes
Chrome 29.0.1524.0         8    bytes     1885 bytes
Safari 6.0.4 (8536.29.13)  1024 bytes     whole file

Windows XP:
IE8                        256  bytes
Chrome 27.0.1453.94        1024 bytes
Firefox 21                 1024 bytes
Opera 12.15                128  bytes AND 3s have passed

Windows 7
IE9                        256  bytes

Windows 8:
IE10                       4096 bytes
```
<a name="DMIvU"></a>
### CSS
默认情况下，浏览器同样把 CSS 也认作是渲染必不可少的内容，因为一般来说一个没有 CSS 的页面是无法有效展示的：<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585838094023-264c267c-c92e-4de3-bc0d-dab59cc470fd.png#align=left&display=inline&height=281&name=image.png&originHeight=562&originWidth=686&size=137688&status=done&style=none&width=343)<br />
所以上面的代码中的 `<link rel="stylesheet" href="styles.css">` 会阻塞首屏的渲染，当浏览器解析到这里时，虽然 DOM 的解析仍然会向下进行，但浏览器会一直等待 `styles.css` 加载完成并且构建成相应的 CSSOM 后再继续渲染。
<a name="AaPEF"></a>
#### 媒体查询和阻塞渲染
上面提到，CSS 在 **默认** 的情况下会阻塞渲染，但是可以通过合理的条件查询避免不必要的阻塞渲染，例如下面的代码中
```html
<link href="style.css" rel="stylesheet">
<link href="other.css" rel="stylesheet" media="(min-width: 900px)">
```
`style.css` 会阻塞渲染，而 `other.css` 就只在屏幕宽度符合查询条件时才会阻塞渲染，浏览器会针对这些条件进行判断。
<a name="z37Rf"></a>
### 异步 stylesheet
如果我们通过 js 动态插入 `stylesheet` ，同样也不会阻塞页面的渲染，下面这个例子中， `test.css` 的加载并不会阻塞页面的渲染。
```html
<head>
  <script>
   var a = document.createElement('link');
   a.href = 'test.css';
   a.rel = 'stylesheet';
   document.head.appendChild(a);
  </script>
</head>
<body>

<h1>This is content</h1>

</body>
```


> 在 Safari 下的表现有所区别，内联 script 插入的 CSS 仍然会阻塞渲染，但通过 requestAnimationFrame 异步插入的 CSS 则不会。

<a name="JKX9p"></a>
## Script
Script 标签也可能会阻塞页面的渲染，这取决于它在页面中的具体位置和属性。
<a name="GrgYx"></a>
### 在 DOM 之前
如果 Script 标签出现在 DOM 之前，浏览器会选择完整加载并执行完相应的 JS 后才会继续解析 DOM（是的，和 CSS 不同，是连解析都会阻塞的）。这是为了 JS 能够顺序和确定地执行，防止 JS 加载好后 DOM 已经和预期的不同。
<a name="VYNEe"></a>
### 在 DOM 之后
DOM 后的 Script 不会阻塞前面已经加载好的 DOM 的渲染，所以一般来说我们都推荐把 Script 标签放在页面的底部。
<a name="Pb7WS"></a>
#### Safari
在 Safari 中，情况有一些不同。即使 Script 在 DOM 的后面，Safari 并不会直接把 DOM 渲染出来，而是等待整个页面的 JS 全都加载并且执行完毕后才真正渲染页面。
```html
<div id="test">test</div>
<script>
  console.log(document.getElementById('test'));
</script>
<script src="footer.js"></script>
```
上面的代码在 Chrome 中会直接渲染出 `test` 元素，而在 Safari 中，虽然能够在 console 中打出元素，但是却要等到 `footer.js` 完全加载完后才会渲染页面。<br />
如果你需要针对 Safari 做一些渲染优化，可以考虑使用 `requestAnimationFrame` 来插入标签从而确认不影响用户首屏。
> 这个问题在后续版本的 Safari 中可能会得到解决

<a name="KSKFB"></a>
### async
我们可以通过给 Script 添加 `async` 属性告知浏览器该 Script 不阻塞页面的渲染，浏览器将会一边加载一边继续解析 DOM，加载好后立即执行。浏览器并不会保证有 `async` 属性的 Script 标签的执行顺序，需要注意的是， `async` 对于内联脚本是没有意义的。
<a name="TuNA9"></a>
### defer
`defer` 和 `async` 的作用有些区别，在于告知浏览器不阻塞页面渲染的同时，把脚本推迟到 `DOMContentLoaded` 事件前执行。除此之外，页面上多个 `defer` 的 Script 标签仍然会保持执行顺序。同样的，defer 对于内联脚本没有意义。
<a name="8gchi"></a>
### 动态插入
由 JS 动态插入的脚本对页面的影响和 `async` 类似，加载不会阻塞页面渲染，加载完成后立即执行。
<a name="uk7BE"></a>
## JavaScript 对渲染的影响
上面说 Script 对渲染的影响，主要还是说资源文件的网络加载阻塞了页面渲染。而除了这些情况外，其实 JS 本身的执行就是会对页面渲染造成影响的。<br />
我们都知道页面中的 JavaScript 代码（除了 Worker）都运行在一个线程中，由 EventLoop 驱动<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1585838012767-3aa4b188-ef41-4743-bf5d-1f35cbfc9c01.png#align=left&display=inline&height=158&name=image.png&originHeight=316&originWidth=1220&size=116969&status=done&style=none&width=610)<br />浏览器在事件循环中需要等待队列中的 JS 执行完毕，才能确定是否需要更新渲染，所以 JS 的执行本身其实就会导致渲染被阻塞。<br />
下面这个例子中，由于 JS 一直阻塞了 EventLoop， `test` 这个元素是不会被渲染出来的。
```html
<script>
  while(true){
  	console.log('test'):
  }
</script>
<h1>test</h1>
```
<a name="KrepY"></a>
## 建议
<a name="tB2vN"></a>
### 尽可能精简和内联你的 CSS
由于页面的渲染完全依赖于 CSS 的加载，所以尽可能的精简首屏的 CSS，如果可能的话考虑内联进页面。
<a name="bfI00"></a>
### 使用媒体查询减少 CSS 的阻塞
如果有明确只在特定条件下生效的 CSS（例如 print），考虑使用合适的媒体查询减小对渲染的阻塞。
<a name="ObXFY"></a>
### 使用 preload 提前关键资源的加载
`<link rel="preload">` 可以提高资源加载优先级和提前时间，如果确定有引用的资源必然阻塞渲染，考虑用 `preload` 提前它的加载。
<a name="z6QI5"></a>
### 减少阻塞渲染的 script
Script 的加载和执行对渲染的阻塞非常明显，如果不必要的话合理使用 `async` `defer` 或者移动到页面底部。如果需要优化 Safari 的渲染性能，考虑使用 `requestAnimation` 来插入 `script` 等异步内容。
<a name="jKWgb"></a>
### 避免长时间运行的 JS，尤其是首屏渲染前
在首屏渲染之前执行一个很耗时的 JS 可能以为着白屏，尽可能避免这种情况。
<a name="05XJ6"></a>
### 使用 Bigpipe 优化数据较多的页面
如果页面取数分为非常多块而且耗时（例如个人中心这样的页面），考虑使用 Bigpipe 让页面尽可能早的开始渲染，在分块时注意第一个 `chunk` 的大小是否能够填满浏览器的缓冲区。<br />


