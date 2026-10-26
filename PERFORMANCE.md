# Performance & Verification

## 结论

本项目已有成功生产构建、最终统一验证和分项自动化证据。当前机器的 Playwright Chromium 使用 **SwiftShader 软件 WebGL**，因此采样只能证明加载、资源、内存、真实 render submission 上限和自适应降档链路受控，不能代表桌面显卡、手机 SoC、Safari 或 Firefox 的最终帧率。

- 配置目标：桌面 ULTRA/BALANCED 尽量接近 60 FPS；移动 LITE 保持可接受的 30 FPS。
- 验证状态：最终统一 `pnpm verify` 成功，共 46 个测试实例：17 通过、29 按配置跳过、0 失败；耗时 11.3 分钟，`.last-run.json` 状态为 `passed`。
- 性能样本：DOM Content Loaded `205.7 ms`，load event `208.2 ms`，8 个资源，传输 `849,988 B`，解码 `2,063,927 B`。
- Chromium heap：used `12,490,424 B`（约 11.91 MiB），低于测试的 32 MiB 上限。
- SwiftShader 压力下 AUTO 可从 BALANCED 降到 LITE，并在 LITE 仍不足时关闭 POST FX；独立 `render-budget.spec.ts` 还读取 `gl.info.render.frame`，约束 LITE 实际 WebGL submission，而不是只把场景数学隔帧。这些都是降级策略证据，不是硬件 FPS 成绩。
- 仍需发布方在目标 Windows/macOS/iOS/Android 真机及目标 Chrome/Safari/Firefox 版本上签署帧率、触控、热降频和 GPU 内存结论。

最终落盘的原始性能样本保存在 `output/playwright/performance-desktop.json`，最终统一验证的 HTML 报告位于 `output/playwright/report/index.html`。第三轮视觉证据位于 `screenshots/final-round3/`。

## 已实施策略

### 渲染预算

- `ULTRA / BALANCED / LITE` 集中配置 DPR、粒子数、几何细分、反射分辨率、更新频率和后处理预算。ULTRA/BALANCED 使用 display RAF 的 always 模式；LITE 使用 demand 模式和带漂移校正的约 30 Hz invalidate 脉冲，`render-budget.spec.ts` 以真实 renderer frame counter 断言 3 秒软件渲染窗口至少提交 24 帧且低于 38 FPS，并同时确认实际 frameloop 为 demand。
- 自动推荐读取 WebGL2、视口宽度、DPR、`deviceMemory`、`hardwareConcurrency`、粗指针和 reduced-motion；移动/触控设备默认锁定 LITE。
- 正常质量切档期间 SceneCanvas 保持同一个 WebGL context。启动时的 context antialias / power preference 不热改；运行期切档更新 DPR、场景预算、shadows 和后处理，不重挂 Canvas。真实 context loss 会卸载 Canvas 并永久转入本次会话的 2D fallback。
- 三档 EffectComposer multisampling 均为 0。ULTRA/BALANCED 使用 SMAA + SelectiveBloom，LITE 移除 SMAA、DOF 与色差，改用轻量 Bloom，并将 composer scale 降至 `0.72`。
- Points、BufferGeometry、InstancedMesh、复用 material/uniform 和预计算/多数带 seed 的 buffer 承担大规模 3D 场景；Signal Lab 的 2D 粒子初始布局仍使用 `Math.random()`。非当前幕停止逐帧更新，避免 React 高频状态更新和每帧对象分配。
- Specimen Lab 粒子场一次分配最大 3300 点的 position/phase/scale buffers；质量或 `0.25–1.5×` 密度变化只改 drawRange。`specimen-buffer.spec.ts` 通过拦截 WebGL2 buffer 创建/删除，防止 slider 操作重复分配 GPU buffers。
- 选择性 Bloom、Noise、Vignette、Chroma 和 DOF 都受质量或 Lab 开关约束；Lab 可实时关闭 POST FX，也能以 `postFxIntensity 0–1.5` 连续缩放效果强度。

### 动画与生命周期

- Lenis 接入 GSAP ticker；ScrollTrigger 只把章节/滚动进度写入共享 runtime signal，R3F 从 signal/ref/uniform 读取高频数据。
- Camera、particle、shader、Portal charge 和 pointer 数据不逐帧写 React state；Portal 数字读数约 80 ms 节流。
- 页面隐藏时 Lenis 暂停、音频 suspend；声明式 Canvas 模式改为 `demand` 并停止 LITE budget loop。reduced-motion 也使用无连续脉冲的 demand。恢复可见后按当前质量声明式恢复 always 或 30 Hz demand 脉冲，避免 Canvas prop 与内部桥接器双写 frameloop。
- Signal Lab 2D 场仅在章节接近视口时运行；reduced-motion 使用 36 粒子并按需重绘。
- GSAP context、ScrollTrigger、Lenis、RAF、observer、媒体查询、音频节点和事件监听器均有清理路径。

### 资源与加载

- Boot 百分比由 `document.fonts.ready`、Memory Ocean 压缩图和动态 SceneCanvas 模块的真实完成状态驱动；`useAssetPreloader` 有一个 10 秒聚合超时，悬挂资源不会永久锁住入口。
- SceneCanvas 是动态 import 边界；当前产物为 main chunk、rolldown runtime 和一个包含七幕 3D 场景/Three/R3F 的 SceneCanvas chunk。GSAP/Lenis 位于 main，`index.html` 不预载 SceneCanvas 空间模块。
- Memory Ocean 本地提供 1536×1024 AVIF（约 119 KiB）与 WebP（约 188 KiB），`<picture>` 优先 AVIF；无远程热链。
- Archivo Variable、Manrope Variable 与 IBM Plex Mono WOFF2 均本地托管，只声明实际使用的字体文件。

### 移动端、无障碍与回退

- `<=767px` 重新编排长镜头、遗物横向叙事、HUD、星图和 Portal；Artifacts 改为原生 scroll-snap，不只是缩小桌面构图。中等视口的粗指针同样避开桌面 pin。Memory Ocean 使用 `overflow: clip` 保留 sticky 海面并截断横向溢出。
- coarse pointer 减少视差/粒子/相机滚转并关闭 R3F object pointer events；按钮使用约 44px 触控目标。当前自动尺寸断言覆盖可见 button，原生 range 由 CSS 约束但未纳入同一尺寸断言。
- WebGL2 探测失败、SceneCanvas error boundary 或运行时 context loss 会切换到按幕变化的 2D Core/Tunnel/Relics/Signal/Ocean/Network/Gate，保留同一套 DOM 叙事和关键操作。
- `prefers-reduced-motion` 可在运行中启用：取消平滑滚动、非必要 reveal、视差与 roll，切到 LITE + demand rendering，而不删除章节或游戏闭环。

## 自动验收范围

`pnpm test:e2e` 使用 Playwright Chromium，串行运行以下 viewport emulation：

| 项目 | CSS 视口 | deviceScaleFactor | 触控 | 说明 |
| --- | ---: | ---: | --- | --- |
| desktop | 1440×900 | 1 | 否 | 完整视觉旅程、桌面专项、性能采样 |
| tablet | 1024×1366 | 2 | 是 | 完整视觉旅程、触屏 Portal |
| mobile | 390×844 | 3 | 是 | 完整视觉旅程、LITE 启动、触屏 Portal |
| webgl-fallback | 1440×900 | 1 | 否 | 禁用 WebGL/WebGL2 后的 2D 旅程 |

主旅程从真实 Boot 进入，覆盖八幕语义、遗物详情、Signal ID、主星图节点、Portal、Restart、Specimen Lab、单一 Canvas/context 和固定截图。专项测试会刻意替换或延迟 Image、AudioContext、WebGL 等浏览器能力，以验证资源超时、静音进入、迟到解锁、context loss 和 2D fallback；因此“无 mock”只适用于主视觉旅程，不适用于故障注入专项。

新增性能/稳定性专项包括：`artifact-transition.spec.ts` 验证详情可见性、双向 shared View Transition 与 morph 属性的有界清理；实时 3D 遗物推进/返回由场景实现并在 Gallery 画面中审片，不把该 DOM 专项夸大成 WebGL 投影断言。`render-budget.spec.ts` 验证 LITE renderer frame 上限，`specimen-buffer.spec.ts` 验证 GPU buffer 复用。`final-gallery.spec.ts` 由 `AETHER_FINAL_GALLERY=1` 启用，正常动效下捕获 desktop 12 帧、tablet 7 帧、mobile 7 帧，并为每个项目写入 renderer/质量/文件/诊断 manifest；它默认跳过，不影响普通回归耗时。

诊断对 `console.error`、未捕获 `pageerror`、失败请求和 HTTP 4xx/5xx 零容忍。当前 performance 样本的 `errors` 为空；记录到的 warning 只有 R3F 当前版本内部仍实例化 `THREE.Clock` 触发的 Three.js 弃用提示。视觉回归允许这条已知上游 warning；在实际由 SwiftShader 渲染时，也只条件允许其特定 ReadPixels GPU-stall 提示，其余 warning 会失败。Specimen Lab 检测到 SwiftShader/llvmpipe/software renderer 时显示 `SW FPS`，不会把极低软件帧率包装成设备指标。

## 2026-08-24 最终落盘自动性能样本

环境：Windows、headless Playwright Chromium、ANGLE/Vulkan、`SwiftShader Device (Subzero)`；JSON 时间为 `2026-08-23T17:00:52.742Z`（Asia/Shanghai `2026-08-24 01:00:52`）。软件渲染负载很高，不能用来评估目标 GPU 帧率。表中的 frame interval 来自浏览器 animation sampling；LITE submission 上限另由 renderer counter 专项约束。

| 指标 | AUTO / BALANCED start | LITE |
| --- | ---: | ---: |
| 实际采样帧数 | 11 | 34 |
| median frame interval | 1033.4 ms | 216.7 ms |
| p95 frame interval | 1516.6 ms | 600.1 ms |
| 由 median 粗估 FPS | 0.97 | 4.61 |
| 采样后状态 | 已自动降到 LITE | LITE + POST FX off + demand frameloop |

其他原始指标：

- long tasks：60 次，总计 21,710 ms，最大 2,424 ms；最大值低于专项回归阈值 10,000 ms。
- 资源预算：8 resources（阈值 `<=20`）、849,988 B transfer（阈值 `<1,500,000`）、2,063,927 B decoded（阈值 `<3,000,000`）。
- 导航预算：DCL 205.7 ms（阈值 `<3,000 ms`）、load 208.2 ms（阈值 `<15,000 ms`）。
- heap used 11.91 MiB（阈值 `<32 MiB`）。Portal 专项验证一次 Restart 前后 retained heap 没有越界；desktop 完整旅程也覆盖完成 Portal 后 Restart。

这些阈值用于发现明显回归，不构成发布 SLA。特别是 SwiftShader 的低 FPS 不能外推到真实设备；它证明的是系统能够在极端慢帧下继续响应、降到 LITE 并关闭 POST FX。

## 真机发布记录模板

| 日期 / Commit | 设备与电源模式 | 浏览器 / GPU | 视口 / DPR | 档位 | Boot READY | FCP / LCP | 10s FPS avg / p5 | JS heap start→end | GPU/long task | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 待发布实测 | 桌面目标机 | Chrome + Safari/Firefox / 记录 GPU | 1440×900 / 实际 | ULTRA/BALANCED | 记录 ms | 记录 ms | 记录 | 记录 MB | 记录 | 七幕停留与滚动 |
| 待发布实测 | 平板真机 | 浏览器 / SoC | 1024×1366 / 实际 | LITE | 记录 ms | 记录 ms | 记录 | 记录 MB | 记录 | 触控、横竖屏、热降频 |
| 待发布实测 | 手机真机 | 浏览器 / SoC | 390×844 / 实际 | LITE | 记录 ms | 记录 ms | 记录 | 记录 MB | 记录 | Portal 长按、滑杆、滚动 |

推荐分别录制 cold/warm cache；在 Awakening、Descent、Artifacts、Signal Lab、Memory Ocean、Constellation 与 Portal 各采样至少 10 秒；在进入前、Portal 完成后、Restart 三轮后比较 heap/GPU 资源；同时切换三档质量、POST FX、前后台和 reduced-motion。

## 发布门槛

- `pnpm licenses:generate`、`pnpm typecheck`、生产构建与完整 `pnpm test:e2e` 已在最终统一 `pnpm verify`/交付流程中成功；报告记录 46 个测试实例、17 通过、29 按配置跳过、0 失败。
- 三个目标视口截图、HTML 报告和性能 JSON 已生成；Console/Network 没有持续错误、失败请求或生产路径 404。
- 目标真机没有持续帧率崩塌、输入阻塞、明显布局跳动、过热失控或 Restart 后资源持续增长。
- 目标 Safari/Firefox 与真实 iOS/Android 仍需发布方验证；当前 Chromium viewport emulation 不能替代这些签署。
- 若目标机达不到预算，优先降低质量档、DPR、粒子和后处理，不移除关键叙事或操作闭环。
