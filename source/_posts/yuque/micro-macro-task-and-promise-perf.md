
---

title: 宏任务、微任务和 Promise 的性能

urlname: micro-macro-task-and-promise-perf

date: 2019-12-24 22:26:54 +0800

tags: []

---
<a name="AK0O6"></a>
## 背景

我们都知道 setTimeout 和 Promise 并不在一个异步队列中，前者属于宏任务（ `MacroTask` ），而后者属于微任务（ `MicroTask` ）。

很多地方在介绍宏任务和微任务的差异时，往往用一个类似于 `++i++++`  一样的题目让大家猜测不同任务的执行先后。这么做虽然可以精确的理解宏任务和微任务的执行时序，但却让人对于它们之间真正的差异摸不着头脑。

更重要的是，我们完全不应该依赖这个微小的时序差异进行开发（正如同在 c++ 中不应该依赖未定义行为一样）。虽然宏任务和微任务的定义是存在于标准中的，但是不同的运行环境并不一定能够精准的遵循标准，而且某些场景下的 `Promise` 是各种千奇百怪的 polyfill。

**总之，本文不关注执行时序上的差异，只关注性能。**
<a name="R7Jsf"></a>
## 异步

无论是宏任务还是微任务，首先都是异步任务。在 JavaScript 中的异步是靠事件循环来实现的，拿大家最常见的 setTimeout 为例。

```javascript
// 同步代码
let count = 1;

setTimeout(() => {
	// 异步
  count = 2;
}, 0);

// 同步
count = 3;
```

一个异步任务会被丢到事件循环的队列中，而这部分代码会在接下来同步执行的代码后面才执行（这个时序总是可靠的）。每次事件循环中，浏览器会执行队列中的任务，然后进入下一个事件循环。

> 当浏览器需要做一些渲染工作时，会等待这一帧的渲染工作完成，再进入下一个事件循环


![image.png](https://cdn.nlark.com/yuque/0/2019/png/236311/1577197618038-db7d48f3-aaa0-454c-b75d-976ee1deca9f.png#align=left&display=inline&height=304&name=image.png&originHeight=912&originWidth=1788&size=336135&status=done&style=none&width=596)

那么，为什么已经有了这么一个机制，为什么又要有所谓的微任务呢，难道只是为了让大家猜测不同异步任务的执行时序么？

我们来看一个 `async function` 的例子

```javascript
const asyncTick = () => Promise.resolve();

(async function(){
	for (let i = 0; i < 10; i++) {
  	await asyncTick();
  }
})()
```

我们看到这里明明其实没有异步等待的任务，但是如果 `Promise.resolve` 每次都和 `setTimeout` 一样往异步队列里丢一个任务然后等待一个事件循环来执行。看起来似乎没有什么大的问题，因为『事件循环』和一个 `for` 循环听起来似乎并没有什么本质上的不同。

**然后在事实上，一次事件循环的耗时是远远超出一次 for 循环的。**<br />**<br />我们都知道 `setTimeout(fn, 0)` 并非真的是立即执行，而是要等待至少 `4ms` （事实上可能是 10ms）才会执行。

> [MDN 相关文档](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout#Minimum_delay_and_timeout_nesting)
> 
> In modern browsers, `setTimeout()`/`setInterval()` calls are throttled to a minimum of once every 4 ms when successive calls are triggered due to callback nesting (where the nesting level is at least a certain depth), or after certain number of successive intervals.
> <br />**Note**: 4 ms is [specified by the HTML5 spec](http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#timers) and is consistent across browsers released in 2010 and onward. Prior to (Firefox 5.0 / Thunderbird 5.0 / SeaMonkey 2.2), the minimum timeout value for nested timeouts was 10 ms.


这意味着如果我们仍然采用这种方式去执行 async function（实际上就是 Promise) ，性能会非常的糟糕。

而且对于正在执行一些复杂任务的页面（例如绘制）就更加糟糕了，整个循环都会被这个任务直接阻塞。

微任务就是为了适应这种场景，**和宏任务最大的不同在于，如果在执行微任务的过程中我们往任务队列中新增了任务，浏览器会全部消费掉为止，再进入下一个循环**。这也是为什么微任务和宏任务的时序上会存在差别。

看一个例子：

```javascript
// setTimeout 版本
function test(){
   console.log('test');
   setTimeout(test);
}
test();

// Promise.resolve 版本
// 这会卡住你的标签页
function test(){
   console.log('test');
   Promise.resolve().then(test);
}
test();

// 同步版本
// 这会卡住你的标签页
function test(){
   console.log('test');
   test();
}
test();
```

你会发现 `setTimeout` 版本的页面仍然能够操作，而控制台上 `test` 的输出次数在不断增加。

而 `Promise.resolve` 和直接递归的表现是一样的（其实有一些区别， `Promise.resolve` 仍然是异步执行的），标签页被卡住，Chrome Devtools 上的输出次数隔一段时间蹦一下。

> 不得不说 Chrome 的 Devtools 优化的确实不错，其实这里已经是死循环的状态了，JS 线程被完全阻塞


<a name="DWWPv"></a>
### Promise 的性能

了解宏任务和微任务的差异有助于我们理解 Promise 的性能。

我们在实际生产中常常发现某些环境下的 Promise 的性能表现非常不如意，有些是不同容器的实现，另一些则是不同版本的 polyfill 实现。尤其是一些开发者会更倾向于体积更小的 `polyfill` ，例如这个有 `1.3k Star` 的实现

[https://github.com/taylorhakes/promise-polyfill](https://github.com/taylorhakes/promise-polyfill)

默认就是使用 `setTimout` 模拟的 `Promise.resolve` ，我们在 [https://jsperf.com/promise-performance-with-timers](https://jsperf.com/promise-performance-with-timers) 可以看到性能的对比已经有了数量级的差距（事实上比较复杂的异步任务会感觉到明显的延迟）。

![image.png](https://cdn.nlark.com/yuque/0/2019/png/236311/1577197618078-d26207a8-f401-4bcc-8049-5859303cf138.png#align=left&display=inline&height=406&name=image.png&originHeight=1218&originWidth=1950&size=202161&status=done&style=none&width=650)


<a name="czISa"></a>
### 如何正确的模拟 Promise.resolve

除了 `Promise` 是微任务外，还有很多 API 也是通过微任务设定的异步任务，其实如果有了解过 `Vue` 源码的同学就会注意到 `Vue` 的 `$nextTick` 源码中，在没有 `Promise.resolve` 时就是用 `MutationObserver` 模拟的。

看一个简化的的 `Vue.$nextTick` ：

```javascript
const timerFunc = (cb) => {
    let counter = 1
    const observer = new MutationObserver(cb);
    const textNode = document.createTextNode(String(counter))
    observer.observe(textNode, {
      characterData: true
    })
    counter = (counter + 1) % 2
    textNode.data = String(counter)
}
```

原理其实非常简单，手动构造一个 `MutationObserver` 然后触发 DOM 元素的改变，从而触发异步任务。

使用这种方式就明显把数量级拉了回来

![image.png](https://cdn.nlark.com/yuque/0/2019/png/236311/1577197618165-bce37f3c-a859-4312-8e3f-7f717c0757dd.png#align=left&display=inline&height=359&name=image.png&originHeight=1076&originWidth=1952&size=173379&status=done&style=none&width=650.6666666666666)


> 由于这个 Promise 本身实现偏向于体积的缘故，这里的 benchmark 性能仍有数倍差距，但其实 `bluebird` 等注重性能的实现方式在 `timer` 函数用 `MutationObserver` 构造的情况下性能和原生不相上下，某些版本的浏览器下甚至更快
> 
> **![image.png](https://cdn.nlark.com/yuque/0/2019/png/236311/1577197618171-ffb74451-d0c7-417c-8655-8ef5ae500449.png#align=left&display=inline&height=303&name=image.png&originHeight=908&originWidth=1264&size=58867&status=done&style=none&width=421.3333333333333)**



当然实际上 Vue 中的 `NextTick` 实现要更细致一些，例如通过复用 `MutationObserver` 的方式避免多次创建等。**不过能够让 Promise 实现在性能上拉开百倍差距的就只有宏任务和微任务之间的差异。**<br />**
> 除 `MutationObserver` 外还有很多其他的 API 使用的也是微任务，但从兼容性和性能角度 `MutationObserver` 仍然是使用最广泛的。


<a name="uADje"></a>
### 总结

宏任务和微任务在机制上的差异会导致不同的 `Promise` 实现产生巨大的性能差异，大到足以直接影响用户的直接体感。所以我们还是要避免暴力引入 `Promise polyfill` 的方式，在现代浏览器上优先使用 `Native Promise` ，而在需要 polyfill 的地方则需要避免性能出现破坏性下滑的情况。

另外，哪条 `console.log` 先执行看懂了就好了，真的不是问题的关键，因为你永远不应该依赖宏任务和微任务的时序差异来编程。

<a name="71Z7C"></a>
## 拓展阅读

- [视频][ Jake Archibald's talk The Event Loop](https://vimeo.com/254947206)
- [https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout#Minimum_delay_and_timeout_nesting](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout#Minimum_delay_and_timeout_nesting)
- [https://github.com/taylorhakes/promise-polyfill](https://github.com/taylorhakes/promise-polyfill)
- [https://jsperf.com/promise-vs-bluebird](https://jsperf.com/promise-vs-bluebird)

