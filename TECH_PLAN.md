# AETHER//NULL — Technical Architecture

> 状态：当前工作区的实现记录，不是待办蓝图。本文写明真实模块边界、已接线的配置、降级路径和已知空白；未来变更应先改代码与测试，再更新这里。

## 1. 技术栈与实际职责

| 层 | 当前版本 | 实际职责 |
| --- | --- | --- |
| 应用 | React `19.2.8` + TypeScript `7.0.2` + Vite `8.2.2` | 语义 DOM、生命周期、生产构建和 SceneCanvas 动态入口 |
| 实时 3D | Three.js `0.185.1` + R3F `9.7.0` + Drei `10.7.8` | 单 Canvas、相机、程序化几何、实例、Points、shader 与 Html 标签 |
| 动画/滚动 | GSAP `3.15.0` + Lenis `1.3.26` | ScrollTrigger、DOM reveal、SVG path、横向 pin、平滑滚动；`@gsap/react 2.1.2` 已安装但当前源码未导入 |
| 后处理 | `@react-three/postprocessing 3.0.5` + `postprocessing 6.39.4` | Bloom/SelectiveBloom、SMAA、Noise、Vignette、Chroma、ULTRA DOF |
| 低频状态 | Zustand `5.0.15` | 入场、当前幕、声音、质量、Signal、Portal、遗物/节点、Lab |
| 声音 | Web Audio API | 程序化 drone、filter/analyser/compressor、HUD 主音量、chirp/impact/Portal charge 与 Signal shader 能量驱动 |
| 图标 | Phosphor React `2.1.10` | 本地打包的界面 SVG 图标 |
| 验收 | Playwright `1.62.1` + Chromium | 三视口旅程、Portal、fallback/context loss、性能预算与证据、截图和浏览器诊断 |

Vite 构建目标为 ES2022、CSS code split、无生产 sourcemap，并把 chunk warning 上限设为 1400 kB。当前没有手写 `manualChunks`；由 Rolldown 保留 `React.lazy()` 的 SceneCanvas import boundary，避免 2D fallback 入口主动 preload spatial 依赖。七个叙事 scene 仍随 SceneCanvas 一起加载，不是逐幕动态 import；最终文件名与大小以本次构建产物为准。

## 2. 当前工程结构

```text
src/
  App.tsx                    # 应用编排、Boot、HUD、Canvas、overlay 与操作桥
  main.tsx                   # React StrictMode 入口
  audio/AetherAudio.ts       # 单例 Web Audio engine
  components/
    BootSequence.tsx
    SystemHUD.tsx
    ArtifactModal.tsx
    SpecimenLab.tsx
    WebGLFallback.tsx
    SceneErrorBoundary.tsx
    useDialogLifecycle.ts
    CustomCursor.tsx
    SplitText.tsx
  config/
    content.ts               # 八幕主线 + hidden Act 08 内容元数据
    camera.ts                # 九个 act 的 camera path
    quality.ts               # 三档质量、AUTO heuristic、mobile 声明
    theme.ts                 # token、chapter themes、Lab variants
    features.ts              # 可安全关闭的稳定/实验功能开关
    portal.ts                # 充能、crossing 与相机反馈参数
    artifacts.ts             # 五件遗物
    constellation.ts         # 30 节点 / 32 连接
    signal-lab.ts            # 三参数游戏
    audio.ts                 # 场景声音和 cue 数据
    index.ts                 # 稳定聚合出口
  hooks/
    useAssetPreloader.ts
    useCinematicScroll.ts
    useWebGLSupport.ts
  runtime/signals.ts         # pointer / scroll / invalidate 可变桥
  scene/
    SceneCanvas.tsx          # Canvas、director、post stack
    CameraRig.tsx
    ActLayer.tsx
    useActFrame.ts
    CoreScene.tsx
    TunnelScene.tsx
    ArtifactsScene.tsx
    SignalFieldScene.tsx
    OceanScene.tsx
    ConstellationScene.tsx
    PortalScene.tsx
    SpecimenLabScene.tsx
    shaders.ts
    sceneMath.ts
  sections/                  # 01..07 语义章节与 DOM 交互
  store/useAetherStore.ts
  styles/                    # global/components/sections/responsive
  types/                     # experience/state/quality/lab/audio/theme
public/
  assets/fonts/              # 3 个本地 WOFF2 + OFL/notice
  assets/images/             # Memory Ocean AVIF/WebP
  assets/licenses/           # Phosphor MIT + 生产依赖 inventory/包内 notices；构建时复制到 dist
  favicon.svg
scripts/
  generate-third-party-notices.mjs  # 生产依赖 notice inventory/归档生成器
tests/
  visual.spec.ts
  visual-gallery.spec.ts
  final-gallery.spec.ts
  artifact-transition.spec.ts
  render-budget.spec.ts
  specimen-buffer.spec.ts
  portal.spec.ts
  preload-timeout.spec.ts
  audio-fallback.spec.ts
  audio-late-unlock.spec.ts
  signal-lab.spec.ts
  quality-switch.spec.ts
  portal-touch.spec.ts
  fallback.spec.ts
  context-loss.spec.ts
  performance.spec.ts
output/playwright/           # 截图、报告、结果与性能 JSON
```

没有路由器、每幕 scene interface、SceneDirector class、ResourcePool 或独立 app/content/theme/effects/shaders 包。自动化常规产物在 `output/playwright/`，第三轮美术证据另存 `screenshots/final-round3/`。旧文档中的推荐树已由上面的真实树替代。

## 3. 应用生命周期与数据流

```text
Boot tasks ──> App preload hook ──> BootSequence
       │              └──> mirrored Zustand boot state（当前无 selector 消费）
       └── WebGL2 probe ──> lazy SceneCanvas ──┐
                                               │
Lenis/ScrollTrigger ──> runtime scrollSignal ──┼──> CameraRig + active scene uniforms
Fine-pointer CustomCursor events ─> runtime pointerSignal ┤
                                               │
DOM controls ──────────> Zustand ──────────────┴──> Signal / Portal / Lab / focus state

Web Audio analyser ───────────────────────────────> SignalFieldScene energy uniform（muted 时为 0）
```

`App.tsx` 负责：

1. 探测 WebGL2 并启动 Boot preload。
2. 选择 SceneCanvas 或 CSS fallback。
3. 将章节变化写入 Zustand，并通知 Audio engine 切幕。
4. 将 DOM 的遗物、节点、Signal、Portal、HUD 与 Lab 操作映射到 store。
5. 在 React 卸载时 dispose Audio engine。

高频相机、指针、滚动速度、shader 时间、粒子和 charge 主要在 ref/uniform/runtime signal 中；UI 数字与离散状态才进入 React/Zustand。Portal 读数约 80ms 节流，Lab FPS 约 650ms 采样，Adaptive Quality 每 6 秒形成一个窗口。Lab 的 DPR 读数只是 `devicePixelRatio` 与 `2 / 1.5 / 1` 档位值取小后的 UI 估值；检测到 SwiftShader/llvmpipe/software renderer 时 FPS 位显示 `SW`，不展示会误导用户的软件渲染数值。

## 4. 配置架构：已接线与保留字段

`src/config/index.ts` 提供小型稳定入口，并同时导出聚合对象：

```ts
experienceConfig = {
  site,
  acts,
  mainActs,
  actById,
  systemCopy,
  navigation,
  artifacts,
  constellation: { nodes, connections }, // connections 是映射后的 CONSTELLATION_PATHS
  signalLab,
  portal,
  features,
}
```

Theme、chapter theme、quality、mobile fallback、camera 与 audio 不在这个对象内，而是以具名导出和 alias 单独存在。当前组件大多直接使用这些导出；`experienceConfig` 是内容与游戏数据的稳定聚合，但尚未被整棵应用一次性消费。

| 配置文件 | 当前消费者 | 备注 |
| --- | --- | --- |
| `content.ts` | sections、Boot、Portal、SystemHUD | 章节文案/ID、`SITE_METADATA`、`SYSTEM_COPY` 与 `SYSTEM_NAVIGATION` 共享；App 的数字 act→ID 映射仍是本地运行时桥，`scrollSpanVh` 未驱动 CSS 高度。 |
| `camera.ts` | `CameraRig` | 九个 act 均接线；focused constellation node 会覆盖 target/position。 |
| `theme.ts` | `EnvironmentDirector`、Core、Specimen Lab | `CHAPTER_THEMES` 驱动 background/fog；`THEME_SCENE_COLORS` 从 `THEME_VARIANTS` 派生并供实时场景材质/灯光使用。`themeToCssVariables()` 仍未直接消费，CSS `[data-theme]` token 仍由样式表维护。 |
| `quality.ts` | App heuristic、SceneCanvas、各 scene | DPR、启动 AA/power preference、粒子、几何、post、reflection、隔帧更新已部分接线。`shadows` 只开关 renderer shadow map；当前 scene 没有 `castShadow`/`receiveShadow`，因此还没有实际投影。 |
| `artifacts.ts` | 3D Artifacts、DOM Vault、Modal | 文案、geometry、position/rotation/scale、orbitRate、accent 与数据读数共享；`distortion` 目前只有声明，没有消费者。 |
| `constellation.ts` | 3D nodes/paths、DOM major buttons | 所有 30 节点/32 连接渲染；6 major 形成语义入口。 |
| `signal-lab.ts` | section、store、3D Signal | 范围、初始/目标、threshold、hold、ID prefix 接线。 |
| `audio.ts` | `AetherAudio` | master、compressor、analyser、scene 参数和通用 cue 合成器接线；ambient bus 的 gain/lowpass 初始化主 ambient 链，cue 的 bus 只作为 gain scalar。没有四个独立 AudioNode 子总线，其余 interface/impact/signal bus 的 `lowpassHz` 尚未消费，部分声明 cue 也无调用点。 |
| `portal.ts` | Portal DOM、CameraRig | `1700ms` charge、`2200ms` crossing 以及 dolly/look/FOV/shake 参数共享，避免 DOM、CSS 与相机各自维护时长。 |
| `features.ts` | Artifact、HUD/scroll、Signal shader、adaptive quality | 当前稳定开关为 Artifact View Transition、scroll-aware navigation、audio analyser shader 与 adaptive quality；WebGPU 与 haptics 显式关闭，WebGL2 仍是唯一生产渲染主路径。 |

`QUALITY_PROFILES.targetFps` 直接生成运行时降级阈值；`particles.artifacts` 驱动 Memory Mask，`cursorTrail` 驱动 Custom Cursor 的 `32/20/0` 个 trail。仍未直接消费的是 `particles.boot`、`particles.constellation` 和 `post.bloom` 布尔值；constellation 数字不裁剪 30 节点数据，Bloom 是否挂载目前由全局 POST FX、profile `post.enabled` 与 level 分支决定。`quality.shadows` 只切换 R3F shadow manager，当前 scene 无 shadow caster/receiver；`reflectionResolution` 只控制 refractive artifact，LITE 的 0 会改用非 transmission 材质，不用于 Ocean。`MOBILE_FALLBACK.breakpoint` 同时参与初始推荐与 resize/pointer 驱动的移动质量锁，`cameraRollMultiplier` 参与粗指针相机；其余 `compactBreakpoint`、maxQuality、dprCap、particle/scene span 等声明尚未接线。

## 5. Boot、资源与本地媒体

`useAssetPreloader` 用等权 task 记录真实 completion：

- `document.fonts.ready`
- `/assets/images/memory-ocean.webp`
- WebGL2 可用时 `import('../scene/SceneCanvas')`

任何 task 抛错会写 Boot 错误文案，但 `.finally()` 仍推进等权进度并在所有 task settle 后 READY。独立 `10_000ms` timer 会在任务悬挂时写 timeout 提示、把进度置 100 并开放入口；资源预载本身不提供 retry、字节级进度或统一取消。用户触发进入后，固定 620ms 退场与 580ms 音频预算同时开始；预算内成功才启用声音，超时会 abort 当前 `unlock(signal)` 并静默进入，避免迟到的 resume 覆盖 HUD 后续用户手势。AVIF 仅由 Memory Ocean `<picture>` 在浏览时选择；Boot 明确预载 WebP，确保兼容源可用。

字体由三条本地 `@font-face` 加载并使用 `font-display: swap`。图片和字体都走 `/assets/...` 根路径；生产部署到子目录前必须配置 Vite `base`。没有运行时远程媒体、GLB、HDRI 或音频文件。来源与许可边界见 `ASSET_LICENSES.md`。

## 6. 滚动、时间与动画

### 6.1 Lenis / GSAP

- Lenis `duration 1.18`、`lerp 0.085`、`autoRaf` 默认由实例行为关闭的自管时钟未使用；项目显式从 GSAP ticker 调用 `lenis.raf(time * 1000)`。
- reduced-motion 时 duration 0、lerp 1、smoothWheel false，导航立即完成；媒体偏好运行中改变会销毁并按新参数重建 Lenis/ScrollTrigger 编排。
- Lenis scroll 更新全局 progress、velocity、direction，随后 `ScrollTrigger.update()`、最近 act 计算和 R3F invalidate。
- 每个 `[data-act]` 建立 ScrollTrigger，写 `scrollSignal.actProgress`。
- 非 reduced-motion 启用 reveal、字符、parallax、Ocean 透视、Descent DrawSVG/MorphSVG/MotionPath/ScrambleText；Artifacts 只在 `min-width: 900px` 且 fine pointer/hover 条件成立时 pin，中等粗指针和手机都走原生 horizontal scroll-snap。
- 磁吸按钮使用独立 pointer listener，偏移为指针到按钮中心距离的 16%，并写入独立 CSS `translate`，避免覆盖控件自身的 `transform` 定位。

当前不是严格单 RAF：GSAP/Lenis、R3F、Signal 2D Canvas、Portal hold、Lab FPS 和 Web Animations 各有必要的时钟。通过 act gating、IntersectionObserver、visibility 与低频 UI 更新控制成本，而不是声称所有系统由一个 FrameDirector 接管。

### 6.2 R3F frame policy

- Canvas 的 `frameloop` prop 是唯一真源：未进入、LITE、页面隐藏或 reduced-motion 声明为 `demand`；已进入且可见、非 reduced-motion 的 ULTRA/BALANCED 声明为 `always`。LITE 由带漂移校正的 timeout 以约 `1000 / 30ms` 周期 invalidate，因此限制的是实际 WebGL render submission，不只是场景数学更新。
- `RendererBridge` 不再命令式争写 frameloop，只同步 `renderSignal.hidden`、驱动 LITE budget loop，并把 R3F 实际 frameloop、render/camera 指标写入 canvas diagnostics。页面隐藏或 reduced-motion 时 30 Hz loop 停止，只响应必要的显式 invalidation。
- `useActFrame` 对非当前幕清空积累；LITE 重场景仍按 profile 每两次 submission 更新一次，并累积 delta，避免仿真时间变慢。
- reduced-motion 每次 invalidation 仍更新滚动相关 uniform，但传入 delta 上限为 `1/120s`。
- Lab 打开时叙事 scene group `visible=false`，叙事 `useActFrame` 停止；Lab scene 仅在 open 时挂载。

`visibilitychange` 会停止/恢复 Lenis、更新声明式 Canvas visibility 状态、设置 render hidden，并暂停/恢复 AudioContext。没有单独的音频 analyser RAF。

## 7. Canvas、相机与后处理

Canvas 参数：

- WebGL2 强校验；非 WebGL2 context 会抛错并由 Scene error boundary 转 fallback。运行中 `webglcontextlost` 会被拦截并通知 App 永久切到同一 fallback。
- Perspective camera：near `0.05`、far `240`，初始 `[0,0,8.6] / fov 38`。
- sRGB output、ACES Filmic tone mapping、初始 exposure `0.88`。
- DPR 与 shadows 取当前质量档；antialias 和 powerPreference 只在首次创建 WebGL context 时取启动档，运行期不热改。R3F `performance` hint 固定为 `min 0.45 / max 1 / debounce 320`，不是档位字段。
- `eventSource=document.body`；Canvas 自身视觉上覆盖视口。
- App 等初始质量 recommendation 完成后才挂 Canvas，并由 App 订阅 store 后把当前 `qualityLevel` 传给稳定的 SceneCanvas instance；SceneCanvas 不自行订阅 quality，运行期也没有 quality key。切档保留同一个 Canvas/WebGL context，实时更新可热改的场景预算、DPR、shadows 与后处理；immutable antialias / powerPreference 沿用启动值。

SceneWorld 包含：

1. `EnvironmentDirector`：逐幕 background/fog 插值。
2. `RendererBridge`：LITE 定时 invalidation、render hidden 同步与低频 canvas frameloop/render/camera diagnostics；frameloop 模式本身由 Canvas prop 声明。
3. `AdaptiveQualityDirector`：真实 RAF 窗口降档。
4. `InteractionBridge`：仅在 entered、非粗指针、无 artifact/Lab overlay 且当前为 Artifacts/Constellation 时启用 R3F events。
5. `ContextLossBridge`：拦截 runtime context loss 并通知 App 转入 2D。
6. `ExposureDirector`：幕与 Portal 状态曝光。
7. `CameraRig`：配置相机、pointer、roll、node focus。
8. 七个叙事 scene 或打开时的 `SpecimenLabScene`。
9. 全局 PostStack。

后处理真实条件：

| 档位 | Bloom | DOF | Chroma | 后处理 AA | Noise / Vignette | Composer scale |
| --- | --- | --- | --- | --- | --- | ---: |
| ULTRA | SelectiveBloom | Artifacts/Portal 动态 bokeh；Lab 强制 0 | `0.00135` | SMAA | `0.025 / 0.42` | `1` |
| BALANCED | SelectiveBloom | 不挂载 | `0.0008` | SMAA | `0.018 / 0.34` | `1` |
| LITE | 普通 Bloom | 关闭 | 0 | 不挂载 | `0.01 / 0.22` | `0.72` |

POST FX 可由 Lab 全局关闭，也可用 `postFxIntensity 0–1.5` 连续缩放 Bloom、色差、Noise、Vignette 与可用时的 DOF。三个档位的 `EffectComposer.multisampling` 当前均为 0；SMAA 是随 ULTRA/BALANCED 档热挂载的 composer pass，与首次创建 WebGL context 时的 antialias 标志不同。切到 LITE 会移除 SMAA，但不重建 context。当前 composer 不按每幕卸载/换 profile；仅 DOF bokeh、背景/雾和 exposure 对 act 有显式逻辑。

Specimen Lab 的粒子场在首次挂载时一次性生成最多 3300 个点的 position/phase/scale TypedArray 与 BufferAttribute。质量档或 `particleMultiplier` 只计算可见 `count` 并调用 `geometry.setDrawRange(0, count)`；不会为每次 slider input 重建数组、geometry 或 GPU buffer。`specimen-buffer.spec.ts` 对 create/deleteBuffer 做浏览器级审计，保护这条不泄漏约束。

## 8. 状态、游戏与 overlay

Zustand 是一个扁平 store，按对象分区：

- `boot`：phase、progress、loaded/total、error。
- `audio`：enabled、initialized、muted、volume。
- `quality`：level 与 `auto | manual` source。
- `lab`：open、shader、material、field、theme、timeScale、particleMultiplier、postProcessing、postFxIntensity、debug、fps/dpr。
- `game`：Signal status、parameters、alignment、Signal ID、attempts。
- `portal`：status、charge、traversed。
- `artifact`：selected 与 discovered IDs。
- `node`：hovered、focused 与 discovered IDs。

Signal 的 UI 读数、store 状态和 hold 判断共同调用 `scoreSignal()`：每个参数在 tolerance 的 `2.5×` 距离窗口内线性计分，再取三项平均。共享分数达到 `0.88` 并保持 1400ms，才由 `crypto.getRandomValues` 生成一次 ID。

Portal DOM 用 `performance.now()` delta 充能，1700ms 到 100；pointer/keyboard 提前 release 直接 cancel 至 0。到 100 后状态进入 `crossing`，禁用重复触发，并在 2200ms 内同步 flash、粒子、音频、曝光和 CameraRig 的 charge/crossing dolly、look depth、FOV 与 shake，之后才 `complete`。charging/complete 的固定安全构图由 `.app-shell[data-active-act='portal']` 限定，不会在离开 Portal 后继续覆盖其他幕。结果控件在原指针释放前 disabled，release/cancel 后再保护 180ms 才开放 Restart/Lab/System。当前 completion 不检查 Signal、Artifacts 或 Constellation 状态。

Artifact Modal 与 Specimen Lab 共用 `useDialogLifecycle`：背景 inert/`aria-hidden`、body/html overflow lock、Tab/Shift+Tab focus trap、Escape、初始焦点和关闭后的焦点恢复。Artifact 打开时实时选中物推进到镜头中心、其余物缩退；支持 View Transition 的非 reduced-motion 浏览器用同名视觉快照双向 morph，`ready`/`finished` 与兜底 timer 都会清理临时属性，关闭后返回 3D 展台。Lab 选项以 `aria-pressed` 表达当前值。

## 9. 音频实现

音频图在 Boot 用户手势后惰性创建：

```text
3 oscillators + generated loop noise -> per-voice/noise gains -> ambient gain
                  -> low-pass -> analyser -> dynamics compressor -> master -> destination
```

- `AUDIO_CONFIG` 设置 master、analyser FFT/smoothing、compressor 与每幕 drone 参数。
- `setScene()` 平滑修改 filter、ambient gain 与三 oscillator frequency。
- `setSignalParams()` 修改 cutoff、Q、gain 与 detune；feature flag 开启时 `getEnergy()` 把 analyser 能量提供给 3D Signal shader，muted/disabled 时 `getEnergy()` 与 `getSpectrum()` 明确返回零能量。
- `cue()` 从配置读取 waveform、频率、包络、filter、bus gain 与可选 noiseMix，经 analyser/compressor 路径输出；Boot、遗物、节点、Signal lock 与 Portal crossing 已调用。
- `chirp()` 与 Portal charge oscillator 直接连接 master，使用短包络或实时 pitch；`impact()` 是 `enter-impact` cue 的包装。
- Sound toggle 改变 master target；HUD volume range 调用 `setVolume()` 并更新后续启用时的目标 gain。设置只在当前页面内保存，没有 localStorage。
- 页面隐藏 suspend，恢复且 enabled 时 resume；React App 卸载会停止、断开并 close context。

当前不是完整四子总线 mixer，也没有 limiter 节点、立体声 phase 或 granular ocean。虽然有通用 cue factory，`core-pulse`、`parameter-tick` 与配置中的 `portal-charge` 尚无调用点；compressor 是唯一动态处理节点。

## 10. 质量档与 AUTO 降级

| 参数 | ULTRA | BALANCED | LITE |
| --- | ---: | ---: | ---: |
| 配置目标 | 60 FPS | 60 FPS | 30 FPS |
| DPR | `1–2` | `1–1.5` | `0.8–1.15` |
| Core 粒子 | 5200 | 2400 | 900 |
| Tunnel 粒子 | 7200 | 3600 | 1100 |
| Signal 粒子 | 4800 | 2400 | 720 |
| Ocean / Portal 粒子 | `9600 / 7400` | `4400 / 3500` | `1300 / 1100` |
| Geometry segments | 128 | 72 | 36 |
| Shadow manager / 启动 AA 请求 | on / on | on / on | off / off |
| R3F submission policy | display RAF / always | display RAF / always | 约 30 Hz / demand |
| 重场景 update | 每次 submission | 每次 submission | 每 2 次 submission |

初始推荐规则：

1. 无 WebGL2 或 reduced-motion → LITE。
2. width `<900`、coarse pointer、`deviceMemory <=4` 或 `hardwareConcurrency <=4` → LITE。
3. width `>=1440`、DPR `<=2.5`，且 `deviceMemory` 与 `hardwareConcurrency` 两个 API 都有值并各自 `>=8` → ULTRA。
4. 其他 → BALANCED。

其中 width `<900` 或 coarse pointer 还是运行时锁条件：App 监听 window resize 与 `(pointer: coarse)` change，条件成立时保存 manual 档、设为 AUTO LITE，并禁用 HUD 质量按钮和 Lab 非 LITE 选项；只有 reduced-motion 与移动锁都解除后才恢复暂存档。内存/CPU 阈值目前只参与推荐，不形成持续锁。

运行时 AUTO：进入后预热 5 秒，每 6 秒采样平均 RAF FPS；隐藏、reduced-motion 或 Lab open 时重置窗口。ULTRA `<48` 降 BALANCED，BALANCED `<36` 降 LITE，LITE `<20.1` 且 POST FX 开启时关闭 POST FX。不自动升档，也不等待幕间。没有质量锁时，HUD cycle 或 Lab quality 选择会把 source 改为 manual，后续停止自动降档。

Shadow manager 的 on/off 是 renderer 状态；当前场景没有 `castShadow` / `receiveShadow`，不能把它读成可见阴影效果。AA 一列只表示首次创建 context 时的请求：初始 LITE 为 false，初始 BALANCED/ULTRA 为 true；运行期切档不重建 context，所以不会改变既有 AA。这些数字是浏览器内近似采样和预算，不是设备 SLA。headless 数据解释由 `PERFORMANCE.md` 维护。

## 11. 响应式与输入

实现使用三组能力：CSS width、媒体查询 pointer/hover、AUTO 设备信息。

- `<=1100px`：隐藏 HUD 章节 nav、压缩 controls、重排双列 section。
- `<=767px`：手机专用章节高度与安全区；Artifacts 自然 scroll-snap；Signal 单列；Constellation 节点按钮网格；Portal action 单列；Artifact Modal 单列滚动。
- Memory Ocean 保持 `.ocean { overflow: clip }` 与内部 `position: sticky` 海面组合：裁掉横向 shader/图像溢出但不建立会破坏 sticky 的滚动容器；compact gallery 以独立滚动进度验证 sea→starlift 构图。
- `<=420px`：进一步收紧品牌、遗物宽度和节点列表。
- width `<900px` 或 `pointer: coarse`：运行时质量锁为 AUTO LITE，并禁用 HUD/Lab 升档路径；条件随 resize / pointer media change 更新。
- `pointer: coarse`：按钮 min-height 44px；CameraRig 的配置 path roll 乘 0.16、速度附加 roll 不变；R3F object events 关闭。
- Custom Cursor 订阅 `hover:hover` + `pointer:fine` 的媒体查询变化；只有非 reduced-motion 且具备 fine/hover 能力时才安装全局监听并更新 `pointerSignal`。能力丢失会清零速度、归一化坐标与 down 状态；`pointerup`、`pointercancel`、window blur 和 effect cleanup 也会复位 down。质量档分别渲染 `32/20/0` 个 trail，磁吸按钮则在每次 `pointermove` 时检查同一媒体查询，能力不满足时不施加偏移；其 CSS `translate` 与控件基础 `transform` 相互独立。
- `env(safe-area-inset-*)` 与 `100dvh` 保护刘海、浏览器顶栏和底部 Portal。

当前没有横竖屏状态持久化、orientation 专用重算、双指缩放或触摸 3D 星图拖拽。`<=767px` 样式为 HUD 图标、分段按钮、Signal/Lab slider 等提供 44px 目标；移动主旅程当前只断言所有可见 button 的宽高均不小于 43.5 CSS px，CSS selector 没有匹配原生 range。仅靠通用 `pointer: coarse` 规则时，也只保证 button 的最小高度 44px。

## 12. Reduced motion、语义与 fallback

### Reduced motion

- 初始质量选 LITE。
- 运行中开启该偏好会暂存此前的 manual quality，并把质量锁为 AUTO LITE；HUD 质量按钮和 Lab 的非 LITE 档随偏好禁用。关闭时只有移动质量锁也解除，才恢复切入前暂存的 manual 档。Lenis/ScrollTrigger 按即时参数重建，非必要 GSAP reveal/pin/parallax/SVG 时间线不创建。
- CSS 把所有 animation/transition duration 降至 `0.001ms` 并隐藏 cursor。
- CameraRig 取消 pointer 与 roll，并把每幕 path 限制在约 42–55% 的构图区间。
- Canvas 设 demand；active scene 仍能在 invalidation 时反映滚动/状态。
- Signal 2D Canvas 使用 36 粒子，停止连续 RAF，只在进入视口或参数变化时显式重绘；Custom Cursor 渲染 0 个 trail 且不安装监听。

### 语义与 focus

- Skip link 指向可聚焦的 `#main-content`；七个 section 都有语义 heading，`aria-labelledby` 均命中现有 ID。自写 `SplitText` 会把可选 heading ID 转发到实际标签。
- Canvas 和 CSS fallback 均 `aria-hidden`；主要交互由 DOM button/range/list/dialog 提供。
- 自写 SplitText 的视觉字符隐藏，外层携带完整 `aria-label`。
- Boot loading 文案使用 polite live region；Signal 只在 locked 时写入隐藏状态，Portal 完成后先播报 final actions preparing、保护解除后再播报 available，避免滑杆/充能数字持续播报。Artifact/Lab modal 有完整 focus lifecycle。
- 细指针独有的 3D Hover/drag 是增强层，六个主星图节点仍有 DOM buttons。

当前没有 automated axe/WCAG audit、forced-colors 专用 CSS、对比度自动门槛或“Skip scene”按钮；只有 skip-to-main。

### WebGL fallback

- `useWebGLSupport()` 尝试创建 WebGL2 context；失败则从 Boot 起不加载 SceneCanvas。
- SceneCanvas 初始化或 React 渲染抛错时，单一 `SceneErrorBoundary` 显示同一 CSS fallback。
- `ContextLossBridge` 监听 `webglcontextlost` 并调用 `preventDefault()`；它延后一轮检查 canvas 是否仍连接，忽略已卸载 Canvas 的迟到 loss，只有仍连接的真实运行时 loss 才让 App 在本次页面会话永久卸载 Canvas 并切到同一 fallback。当前不尝试恢复或重建 context。
- Fallback 根据 active act 呈现 Core、Tunnel、Relics、Network、Horizon 或 Gate，语义 DOM 和控件保持原样。
- Playwright `webgl-fallback` 项目使用 `--disable-webgl --disable-webgl2` 验证主内容可见、没有 canvas，并逐项检查 Descent 至 Portal 六个下游 act 的 `data-fallback-act`，再抽查一个遗物、Auto Align、一个主节点和 Portal→Lab 的 DOM 路径；它没有单独断言 Awakening 的 act-specific fallback 属性，也没有穷尽 Restart、View System 或全部控件。

当前没有 `webglcontextrestored` listener、受控重建、逐幕 error boundary、2D Canvas 复制 3D 命中或可见的 fallback 模式文案。

## 13. 测试、构建与证据

环境要求：Node `^20.19.0 || >=22.12.0`，pnpm `10.33.2`。

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm build
pnpm preview
pnpm test:e2e
pnpm test:e2e:headed
pnpm capture
pnpm verify
pnpm licenses:generate
```

Playwright `webServer` 每次从 `pnpm build` 开始，再以 `127.0.0.1:4173 --strictPort` 预览生产 bundle；所有项目串行、单 worker，避免 WebGL 争抢。

最终统一 `pnpm verify` 已由交付主流程成功执行：共收集 46 个测试实例，17 通过、29 按配置跳过、0 失败，耗时 11.3 分钟；`.last-run.json` 为 `passed`。默认套件会收集所有 spec，但两个 gallery spec 都通过环境变量选择性启用，因此其用例在普通验证中按配置跳过。该计数只证明当前 Chromium 自动化集合，不扩大为真机 GPU、完整 WCAG、许可或发布判定。

| 测试 | 当前覆盖 |
| --- | --- |
| `visual.spec.ts` | desktop/tablet/mobile Boot、Canvas/WebGL2、启动/运行期 AA 契约、八幕关键路径、artifact dialog、Signal、node、桌面键盘/移动触控 Portal、Lab、heap delta、无外部资源和浏览器诊断 |
| `portal.spec.ts` | desktop elapsed-time hold、部分 charge 后 blur 清零、Restart 后 Portal/Signal 复位与 retained-heap 上限；未单独设置/断言 artifact 与 node 重置 |
| `preload-timeout.spec.ts` | desktop 关键 Image promise 永不 settle 时，10 秒后 Boot 仍可进入 |
| `audio-fallback.spec.ts` | desktop Web Audio API 缺失时静默进入及 HUD 状态真实性 |
| `audio-late-unlock.spec.ts` | desktop 延迟 1.8 秒的假 AudioContext；验证 580ms 预算后的迟到 resume 保持引擎/HUD 静默，并允许 HUD 用户手势重试 |
| `signal-lab.spec.ts` | desktop 非目标手动参数的 89% 可见读数、共享 `scoreSignal()` 判定与 1400ms hold lock |
| `quality-switch.spec.ts` | desktop 在 reduced-motion LITE、恢复 BALANCED 和再次切 LITE 之间保持同一 Canvas identity、启动 AA=true 与 WebGL2 存活；同一 context 中 POST FX off/on 后无 pageerror |
| `portal-touch.spec.ts` | tablet/mobile CDP touch hold；完成 release 不穿透，Portal 保持完成且 Restart/Lab 动作随后可用 |
| `fallback.spec.ts` | 独立 disabled-WebGL project：无 canvas、主内容、Descent→Portal 六个 act 属性，以及遗物、Signal、节点、Portal、Lab 的 DOM 路径 |
| `context-loss.spec.ts` | desktop 人工派发 context-loss、事件拦截、Canvas 卸载和 act-specific 2D 接管 |
| `performance.spec.ts` | desktop BALANCED/LITE RAF、navigation/resource、CDP heap/metrics JSON 与预算断言 |
| `visual-gallery.spec.ts` | `AETHER_GALLERY=1` 时的 Artifacts/Signal/Ocean/Map/Portal/Lab 审片图 |
| `artifact-transition.spec.ts` | desktop 遗物打开/关闭双向 morph 均完成、共享 snapshot 属性清理、详情截图可见 |
| `render-budget.spec.ts` | desktop 强制 LITE 后读取 Canvas 的真实 `gl.info.render.frame` 低频诊断，确认实际 frameloop 为 demand，并断言 3 秒内至少提交 24 帧且 render submission 低于 38 FPS |
| `specimen-buffer.spec.ts` | desktop reduced-motion Lab 多次改变粒子倍率，审计 `WebGL2RenderingContext.createBuffer/deleteBuffer`，确认密度变化复用稳定 buffer 集合 |
| `final-gallery.spec.ts` | `AETHER_FINAL_GALLERY=1` 时正常动效捕获 desktop 12、tablet 7、mobile 7 帧；每个项目输出含 renderer、质量、文件和诊断的 manifest；Portal 只截 ready/open 稳态，充能/crossing 由专项计时测试覆盖 |

主要输出：

- `output/playwright/desktop.png`
- `output/playwright/tablet.png`
- `output/playwright/mobile.png`
- `output/playwright/round1-boot.png`
- `output/playwright/round1-hero.png`
- `output/playwright/round2-artifacts.png`
- `output/playwright/round2-signal.png`
- `output/playwright/round2-ocean.png`
- `output/playwright/round2-map.png`
- `output/playwright/round2-portal.png`
- `output/playwright/round2-specimen-lab.png`
- `output/playwright/specimen-lab.png`
- `output/playwright/performance-desktop.json`
- `output/playwright/report/index.html`
- `screenshots/final-round3/desktop/`（12 帧 + 项目完成时的 `manifest.json`）
- `screenshots/final-round3/tablet/`（7 帧 + 项目完成时的 `manifest.json`）
- `screenshots/final-round3/mobile/`（7 帧 + 项目完成时的 `manifest.json`）

## 14. 已知边界与下一步门槛

以下功能不在当前实现中，不能作为交付声明：

- 遗物收集门槛、星图 TRACE/三路径解锁、Portal requirements。当前 3D focus + 双向 View Transition 已完成，但它使用浏览器共享快照，不是 GPU framebuffer 投影到 DOM。
- 资源预载 retry/统一 cancel 或用户可选 silent-mode 分支、Signal 新 seed/recalibrate、Portal 25% checkpoint。Boot 音频授权本身已有 AbortSignal 超时取消。
- per-scene lazy import/dispose、ResourcePool、单一 FrameDirector/RAF、context-loss 恢复/重建。
- 真正的 AUTO 升档、幕间限定降档与真机 GPU 基准。Canvas 已低频暴露 draw calls/triangles/geometries/textures 供测试诊断，但 Lab UI 只显示 FPS/DPR/MODE，软件 renderer 的 FPS 固定显示 `SW`。
- 触屏 3D drag/pinch、forced-colors、全量 WCAG 自动扫描、跨 Chrome 之外的自动化项目。
- localStorage 设置持久化、子路径部署配置和根级项目软件许可证。当前脚本为 72 个生产包归档 inventory；顶层 notices 加上 7 个无顶层文件包的嵌入声明/标准 SPDX fallback，共去重为 149 份，unresolved 为 0。依赖变化后应运行 `pnpm licenses:generate` 并重新构建；GSAP 的当前许可仍是实时外部条款，需由发布方按实际用途确认。

后续新增任何一项，交付门槛是：配置与类型接线、主要 DOM/Canvas 路径、reduced-motion/fallback/mobile 行为、Playwright 证据、资源许可证和本文同步更新。性能数值与最新发布判定由 `PERFORMANCE.md` 单独维护。
