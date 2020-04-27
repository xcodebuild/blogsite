
---

title: 骷髅峡谷（nuc6i7kyk）安装黑苹果（macOS Catalina 10.15.4）

urlname: nuc6i7kyk-hackintosh-macos-catalina

date: 2020-04-06 21:31:28 +0800

tags: []

---
手头上有个骷髅峡谷一代的盒子（ `nuc6i7kyk` ），之前一直用的是 `Windows 10` ，然而由于工作用的是 Macbook Pro，环境切来切去的总是不适应。上网查了一下 `nuc6i7kyk` 的硬件用来黑苹果是比较合适的，于是花了点时间装了下黑苹果，总共大概花了四五个小时的时间（不过还有一些小瑕疵，也不纠结了）。<br />
系统的版本为 `macOS Catalina 10.15.4` ，引导程序选的是 `OpenCore` 。<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1586185011143-7e282c51-7177-424e-a425-382d84b2ade1.png#align=left&display=inline&height=338&margin=%5Bobject%20Object%5D&name=image.png&originHeight=676&originWidth=1560&size=377314&status=done&style=none&width=780)<br />开箱即用的 `EFI` 见：[https://github.com/xcodebuild/nuc6i7kyk-macos-efi](https://github.com/xcodebuild/nuc6i7kyk-macos-efi)
<a name="sYdO5"></a>
## 目前的状态
<a name="4tbQ1"></a>
### 可用的

- NVME
- HDMI 输出 4K 60FPS 显示器和 HiDPI
- 有线网络
- USB 3
- 休眠
<a name="6fkX7"></a>
### 不可用的

- 内置 Wifi（可以用外置的）
- 内置蓝牙（这点似乎有解但是感觉太麻烦就直接买了个外置的）
- DP 转 HDMI 似乎不可用
<a name="Ag4L9"></a>
## 安装盘
<a name="5Z4cI"></a>
### 下载系统
推荐直接去 App Store 下载原版系统，如果需要特定版本从其他地方下载原版 DMG 即可。<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1586183581819-c83c88be-5ef0-43d9-81ec-af7b5f70ddec.png#align=left&display=inline&height=836&margin=%5Bobject%20Object%5D&name=image.png&originHeight=1672&originWidth=2584&size=1486704&status=done&style=none&width=1292)
<a name="mId7n"></a>
### 制作启动盘
准备一个 U 盘，使用磁盘工具格式化为 `Mac OS 扩展(日志式) & GUID分区表` ，这里可以起名叫 `MyInstaller` 。<br />
然后等待系统下载完毕后，在终端中执行
```shell
sudo "/Applications/Install macOS Catalina.app/Contents/Resources/createinstallmedia" --volume /Volumes/MyInstaller
```
输入系统密码后等待执行完毕。
<a name="nT50q"></a>
### 启动盘 EFI
<a name="w8h49"></a>
#### 挂载
EFI 分区负责系统的启动引导，默认是不被系统挂载的，需要用一些工具或者命令来挂载。我这里图方便直使用[https://sourceforge.net/projects/cloverefiboot/](https://sourceforge.net/projects/cloverefiboot/)（虽然我其实根本没用到 Clover）。这个工具提供一个 Menubar 的工具可以挂载 EFI。<br />
从挂载-选择磁盘中，可以选择我们的 U 盘。<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1586185724701-e62184fc-7a10-42c8-ac94-3257c4acdb0d.png#align=left&display=inline&height=726&margin=%5Bobject%20Object%5D&name=image.png&originHeight=1452&originWidth=828&size=263783&status=done&style=none&width=414)
<a name="ljhj9"></a>
#### 现成的 EFI
现在启动盘还无法在 PC 设备上启动，需要把相应的配置和驱动等，由于在网上已经有现成对应设备的 `EFI` ，我做了一些适配后放到了 [https://github.com/xcodebuild/nuc6i7kyk-macos-efi](https://github.com/xcodebuild/nuc6i7kyk-macos-efi)，直接把这个仓库下载下来后复制到 U 盘的 ESI 分区中。<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1586184558636-5747aec5-59fe-4c6b-9b26-4fdc51367bae.png#align=left&display=inline&height=548&margin=%5Bobject%20Object%5D&name=image.png&originHeight=1096&originWidth=1764&size=523396&status=done&style=none&width=882)
<a name="lmYIL"></a>
## 安装
<a name="ayhl6"></a>
### 设置
需要在骷髅峡谷的 BIOS 设置中关掉不兼容的设置

- Power->Secondary Power Settings, “Wake on LAN from S4/S5”, 设置成 “Stay Off”
- Devices->Video, “IGD Minimum Memory” 设置为 64mb
- Devices->Video, “IGD Aperture Size” 设置为 256mb
- Boot->Secure Boot, “Secure Boot” 设置为 disabled
- Security->Security Features, “Execute Disable Bit” 设置为 enabled.
- Security->Security Features, “VT-d” 设置为 disabled
<a name="feYmw"></a>
### U 盘引导安装
安装部分不用太多说，把 U 盘插到骷髅峡谷上，启动时选择 `Catalina Installer` 进入安装，进入到安装界面后先用磁盘工具把相应的分区（或者硬盘）格式化成 APFS 和 GUID。<br />
然后进行安装即可，过程中会经过几次重启，每次都选 U 盘以外的 `Installer` 分区。
<a name="5i8j8"></a>
### 启动
安装完成后暂时还是需要 U 盘，因为我们刚才安装的是白苹果系统，不具备在骷髅峡谷上启动的能力。我们可以通过 U 盘引导进入系统后，仍然安装上面的 Clover 应用来挂载硬盘的 EFI 分区。<br />
然后把 U 盘的 EFI 分区原样复制到硬盘的 EFI 分区，然后我们就可以摆脱 U 盘直接启动了。<br />![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1586183143410-ed293857-c3b0-4af5-aa64-09d6ae8b748b.png#align=left&display=inline&height=328&margin=%5Bobject%20Object%5D&name=image.png&originHeight=892&originWidth=1396&size=485582&status=done&style=none&width=513)
<a name="CgIF8"></a>
## 其他
其中内置 Wifi 是不可用的（无解），内置蓝牙有解但是懒得折腾了。可以通过淘宝买个几十块的 USB 接口的解决，注意 macOS 的兼容性。<br />
![image.png](https://cdn.nlark.com/yuque/0/2020/png/236311/1586185139192-a8f45e9a-5811-4b36-8c2b-c1f25f77b0a1.png#align=left&display=inline&height=316&margin=%5Bobject%20Object%5D&name=image.png&originHeight=632&originWidth=1282&size=185833&status=done&style=none&width=641)<br />
从测速看外接了一个廉价 USB Hub 上的 USB 网卡连接 5G Wifi 似乎没有什么问题。
<a name="URUlc"></a>
## 参考

- BIOS 设置部分参考的 [https://blog.tms.im/2019/03/01/nuc6i7kyk-hackintosh-mojave](https://blog.tms.im/2019/03/01/nuc6i7kyk-hackintosh-mojave)
- EFI 修改自 [https://github.com/furui/skull-canyon-efi](https://github.com/furui/skull-canyon-efi)

