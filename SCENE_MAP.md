# AETHER//NULL — Scene Map

> 状态：当前浏览器实现的逐幕地图。主线是 Boot + 七个滚动章节，共八幕；Hidden Specimen Lab 是独立覆盖层，不计入主线滚动长度。本文中的高度、阈值和预算来自现有 CSS/TypeScript，而不是未来设想。

## 1. 主线总览

| ID | 章节 | 实际布局长度 | 实时主角 | 当前可完成动作 |
| ---: | --- | --- | --- | --- |
| 00 | Boot / Cold Start | 固定全屏，无滚动 | 坐标环 + 背后的 Core 场景 | 等待 READY，点击或键盘进入 |
| 01 | Core Awakening | 桌面 `180dvh`；手机 `145dvh` | 液态 Core、轨道、碎片、粒子 | 滚动与细指针观察 |
| 02 | Quantum Descent | 桌面 `240dvh`；手机 `190dvh` | 粒子隧道、断环、光轨 | 滚动控制旅行与相机 |
| 03 | Relic Vault | 桌面 `94dvh` intro + 动态 pinned track；手机 `80dvh` intro + 自然横滑 | 五件程序化遗物 | 检查任一遗物，完成双向 3D→2D→3D 交接并关闭详情 |
| 04 | Signal Lab | 桌面 `150dvh`；手机 `165dvh` | 3D signal field + 2D Canvas 仪器 | 三参数校准或 Auto Align，生成 Signal ID |
| 05 | Memory Ocean | 桌面 `260dvh`；手机 `220dvh` | 本地图像、3D 波面、海→星粒子 | 指针涟漪与滚动变形 |
| 06 | Constellation | 桌面 `220dvh`；手机 `185dvh` | 30 节点、32 条连接 | 细指针拖拽/选择；DOM 聚焦六个主节点 |
| 07 | Null Gate | 桌面 `220dvh`；手机 `190dvh` | shader Portal、断环、向心粒子 | 约 1.7s 长按充能、2.2s crossing，Restart / Lab / System |

`src/config/content.ts` 中仍保存 `scrollSpanVh` 元数据，但当前 CSS 和 Artifacts 的 ScrollTrigger 动态距离才决定真实页面长度；两者不是同一套自动布局源。章节激活以视口中点附近的 `[data-act]` 为准，ScrollTrigger 同步该幕的 `actProgress 0–1`。

## 2. 全局镜头、场景和渲染规则

- 视口同一时刻只有一个 R3F Canvas。SceneCanvas 自身动态导入；模块加载后，Core、Tunnel、Artifacts、Signal、Ocean、Constellation 和 Portal 同时挂载在同一场景树中。章节与运行期质量切换都不创建新 Canvas：DPR、场景预算和后处理随档位更新，antialias / power preference 则固定为首次创建 context 时的启动档选择。
- `ActLayer` 用 opacity、轻微 scale 与 Z 位移平滑交接；退场的 inactive group 会在 opacity 阻尼到 `<=0.002` 前短暂与当前幕重叠，但 `useActFrame` 会立即停止其场景更新。没有“当前幕前后各保留一个独立 Canvas”或逐幕资源卸载器。
- Core 同时服务 Boot 和 Awakening；其余场景各对应一个 `data-act`。
- `CAMERA_PATHS` 为 Boot、七幕与 Lab 提供 position、target、FOV、roll、focusDistance、damping 和 pointer influence。CameraRig 在关键帧间 smoothstep，再用阻尼追随。
- 细指针视差只在非 reduced-motion、非 coarse pointer 时生效；粗指针只把相机配置中的 path roll 乘 `0.16`，由滚动速度产生的附加 roll 不走该倍率；reduced-motion 的 roll 与视差为 0。
- 背景和指数雾按当前幕在 `CHAPTER_THEMES` 之间插值。全局曝光在 Awakening 略升、Ocean 略降、Portal 完成时提升。
- POST FX 是单一 composer，三个档位的 composer multisampling 均为 0：LITE 使用普通 Bloom，其余使用 SelectiveBloom；ULTRA/BALANCED 另挂 SMAA，LITE 不挂。Noise、Vignette、Bloom、Chroma 与 DOF 强度共同乘以 Lab 的 `postFxIntensity 0–1.5×`。DOF 只在 ULTRA 挂载，并在 Artifacts/Portal 提升；Lab 打开时 bokeh 归零。SMAA 属于可热改的后处理，与启动时固定的 WebGL context antialias 是两层机制。
- Canvas frameloop 由单一声明式状态派生：未进入、LITE、reduced-motion 或页面隐藏为 demand；已进入且可见、非 reduced-motion 的 ULTRA/BALANCED 为连续 always。LITE 由约 30 FPS 的定时 invalidate 驱动，页面隐藏或 reduced-motion 时停止该脉冲；恢复可见后按当前档位继续。
- 只有已进入、非粗指针、无 modal overlay 且当前处于 Artifacts / Constellation 时，`InteractionBridge` 才启用 R3F 命中；关键动作始终另有 DOM 路径。

## 3. 分幕实装

### 00 — Boot / Cold Start

**构图**：全屏暗场、扫描线、坐标角标和以真实 task 数量驱动的中心断环。CoreScene 已在后方运行 act 0，因此进入时不是从空白突然创建 3D 场景。

**实际加载任务**：

1. `document.fonts.ready`。
2. `public/assets/images/memory-ocean.webp` 加载完成（以 Image `onload` 为完成信号，没有显式调用 `decode()`）。
3. WebGL2 可用时动态导入 `SceneCanvas`；不可用时省略该任务并走 CSS fallback。

每个任务完成就按等权计数更新进度；当前不是按字节加权。任务失败会显示 `Fallback retained: ...`，但 `.finally()` 仍允许其他任务完成后 READY。另有硬编码 `10_000ms` 总等待上限：到时写入 timeout fallback 提示、把进度置 100 并开放入口；它不取消仍在后台 pending 的 promise，也没有重试按钮或独立的 `CONTINUE IN LITE` / `ENTER SILENT` 选择。

**进入**：按钮 READY 后可点击，或聚焦后按 Enter/Space。应用同时启动带 `AbortSignal` 的 `AudioContext.unlock()`、580ms 音频预算和固定 620ms Boot 退场；预算内成功会播放 impact 并带声音进入，超时则中止本次解锁并静默进入，避免迟到 promise 反向改写 HUD。用户随后仍可从 HUD 发起一次新的授权尝试；浏览器拒绝或缺少 Web Audio 不会阻止叙事。

**回退/reduced**：WebGL2 缺失时 Boot 背景直接使用 CSS Core；reduced-motion 全局将扫描、环与 transition 缩为近乎即时。

### 01 — Core Awakening

**DOM**：`AETHER//NULL` 分割标题、`THE LAST SIGNAL IS STILL ALIVE`、叙事正文、坐标与滚动提示。非 reduced-motion 下字符和 reveal 由 GSAP/ScrollTrigger 进入。

**3D**：

- Core shader 使用多层 value noise/fbm、呼吸、Fresnel 与 Chrome/Cyan/Magenta 光谱，并随章节进度和细指针观察变化；当前没有读取音频分析值。
- ULTRA/BALANCED/LITE 使用 `5200/2400/900` Core 粒子和 `132/84/42` 实例碎片。
- 多轴 torus 轨道、点光和 directional light 建立液态金属尺度。

**镜头**：配置从约 `[0.1, 0.15, 8.6] / fov 38` 推进至 `[0.02, 0.02, 1.35] / fov 52`，末端 target 指向深处。实际 roll 峰值约 `0.025 rad`，不是 10° 大幅翻滚。

**当前边界**：进入 Descent 时由共享环形母题、背景/雾插值和 ActLayer 淡出衔接；没有 Core 裂缝几何真正扩张成隧道入口，也没有“Core Light”收集状态。

### 02 — Quantum Descent

**DOM/SVG**：主标题、四组深度日志、双路径 SVG、沿 path 运动的 orb 与 `DEPTH::UNMAPPED` scramble。DrawSVG、MorphSVG 和 MotionPath 仅在非 reduced-motion 下启用。

**3D**：

- ULTRA/BALANCED/LITE 使用 `7200/3600/1100` shader 粒子。
- 断环实例数为 `34/24/15`；光轨数量为 `20/14/8`，每轨段数 `48/32/20`。
- `actProgress` 推动隧道旅行；滚动 velocity 增加粒子 stretch 与镜头附加 roll。

**镜头**：Z 从 `0.6` 走到 `-82`，target 最远 `-98`；FOV `54 → 61 → 67 → 72 → 48`，配置 roll 峰值 `0.07 rad`。粗指针只保留 16% 的 path roll；视口宽度本身不触发这一倍率。reduced-motion 固定在章节中段窄范围并取消 roll。

**交接**：进入 Relic Vault 时场景淡出，Artifacts 的横向空间和 Amber 主题接管。当前光轨不会冻结并复用为真实展台几何。

### 03 — Relic Vault

**五件实装遗物**：

| 序号 | 配置名称 | 3D 几何实现 | DOM/CSS 轮廓 |
| ---: | --- | --- | --- |
| AN–01 | The Breathing Seed | 呼吸 shell、seam 与 halo | `breathing-seed` |
| AN–02 | The Ring of Unspent Hours | 多层 nested orbits | `nested-orbits` |
| AN–03 | Transparent Archive | transmission/refractive crystal | `refractive-crystal` |
| AN–04 | City Folded at Dusk | 42 个实例建筑块 | `folded-architecture` |
| AN–05 | Mask of the Last Witness | 开口 mask shell + `620/380/180` 粒子 | `spectral-mask` |

**桌面**：Intro 后，ScrollTrigger 根据 `.artifacts__track.scrollWidth` 动态计算横移距离，pin 住 stage 并把纵向滚动映射为横向展馆。

**手机**：取消 pin；五张卡片成为 `87–91vw` 的原生 horizontal scroll-snap 轨道，详情面板改为可滚动单列。

**交互**：DOM 的 `INSPECT SPECIMEN` 在支持的浏览器、非 reduced-motion 条件下使用双向 shared View Transition：卡片视觉与 modal sigil 共享 `artifact-morph` 名称，打开与关闭都设有完成 promise 和 1.2s 兜底清理。细指针也可直接点 3D 遗物；选中对象以阻尼放大到 `1.58×` 并飞向画面中心/镜头前方，其他四件退至 `0.42×`，关闭后返回原展位。Modal 显示长描述和三项数据，并把遗物 ID 加入本次会话的 `discoveredIds`。Escape、背景、Close、Return 都可关闭。

**当前边界**：现有 3D→2D→3D 是同步构图交接，并非逐顶点 mesh 投影。没有 `COLLECT ECHO`、三件收集门槛、旋转详情控制或包围盒→SVG→Signal Lens 的后续投影链；Signal Lab 始终可以滚动进入。

### 04 — Signal Lab / Phase Alignment

**参数**：

| 参数 | 范围 / step | 初始 | 目标 |
| --- | ---: | ---: | ---: |
| Frequency | `17–88 / 0.1 THz` | `43.2` | `61.8` |
| Coherence | `0–1 / 0.01` | `0.24` | `0.86` |
| Entropy | `0–1 / 0.01` | `0.76` | `0.18` |

三个原生 range 同时改变 DOM 频谱、2D Canvas 粒子、3D signal uniforms 与 Web Audio 参数。启用声音时，Web Audio analyser 的频谱能量还会实时反馈到 3D alignment 与粒子尺寸；静音时该能量为 0。2D 场在章节靠近视口时由 IntersectionObserver 启动，通常桌面创建 190 粒子、`<768px` 创建 72 粒子；reduced-motion 改为 36 粒子并只在进入视口或参数变化时显式重绘。其随机布局当前不是 seeded；3D 场使用质量档粒子预算和固定 seed。

**锁定**：UI 读数、store 状态与 hold 判断共同调用 `scoreSignal()`：每个参数在 `tolerance × 2.5` 的距离窗口内线性计分，再取三项平均。共享分数达到配置的 `successThreshold 0.88` 并连续保持 `1400ms` 后，生成一次随机 `AETH-XXXX-XXXX` ID 并锁定。`AUTO ALIGN` 可直接写到目标，专门测试也用非目标的手动参数验证可见读数和锁定判定一致。Restart 将状态恢复为初始值；当前没有 Recalibrate 按钮或 session-seeded 目标。

**指针**：2D 画布默认吸引粒子；Shift 或右键改为排斥。3D 场还会读取 Lab 的 field、shader、timeScale 与 particleMultiplier。

### 05 — Memory Ocean

**DOM 画面**：`<picture>` 优先加载 1536×1024 AVIF，WebP 为兼容回退；图片有明确 alt。指针移动更新 CSS radial ripple 的中心，Ocean reveal 由 GSAP 把粘性画面从倾斜/放大推向正面。章节根使用 `overflow: clip`：它裁切海面而不生成新的滚动容器，因此 sticky visual 能维持海面→星空的连续构图。

**3D**：Ocean shader 使用双频波、fbm、pointer ripple、由波高有限差分重建的世界空间 Fresnel 与 progress；几何细分直接取质量档 `128/72/36`。同一质量档使用 `9600/4400/1300` morph particles 从水面坐标移动到星空 destination，并有独立 horizon rings，形成明确的 3D 波面→星空 morph。

**镜头**：从 `[0, 3.1, 8.2]` 逐渐落到 `[0, 0, 2.2]`，target 从海平线转向上方；FOV `42 → 58`。当前没有 FBO 反射或可累积的多涟漪 uniform 池，`reflectionResolution` 只是质量配置预算，未接入 Ocean renderer。

### 06 — Constellation

**数据**：`CONSTELLATION_NODES` 包含 6 个主节点 + 24 个 relay，共 30；`CONSTELLATION_PATHS` 包含 32 条连接。节点用 InstancedMesh，路径用单一 lineSegments BufferGeometry 和 travelling pulse shader。

**细指针 3D**：可拖拽不可见交互平面，将场旋转限制在 X `±0.24`、Y `±0.38`；Hover 显示 Drei Html 标签，点击 3D node 聚焦或取消。CameraRig 对焦点节点做 target 与 position 偏移。

**语义控制**：六个主节点各有 DOM button；键盘、触摸、fallback 都可聚焦并显示 node-focus 文案。coarse pointer 下 R3F events 被关闭，因此移动端以这些按钮为真实入口，不承诺双指缩放或触摸 3D 拖拽。

**质量**：所有档位仍渲染配置中的 30 节点数据；LITE 只降低 icosahedron detail 和更新频率。`QUALITY_PROFILES.particles.constellation` 的 `36/30/24` 当前没有裁剪 node array，因此不能把它解释为实际节点数量。

**当前边界**：没有 TRACE 按钮、三条指定光路进度或 Portal 解锁门槛；选择节点仅记录 focused/discovered 状态并改变镜头/reticle。

### 07 — Null Gate

**3D/DOM**：Three 场景由 `7400/3500/1100` 粒子、`8/6/4` 层断环、shader 圆盘和点光组成；DOM 叠加 28 条光线、三层 ring、charge 按钮与 live readout。

**充能状态**：pointer、touch、Space 或 Enter 持续按住时按真实 `performance.now()` delta 累加，约 `1700ms` 达到 100。数字读数约每 80ms 更新；3D charge 从 store/ref 平滑追随。松开、pointer leave/cancel、失焦或 lost capture 会取消，未完成进度直接回到 0，不保留 25% checkpoint。

**状态与穿越**：按下后状态从 `dormant` 进入 `charging`；100% 时先写入 `portal.status='crossing'`，禁用充能按钮并播放 crossing cue、闪光、曝光和镜头 Dolly/FOV/轻震反馈。约 `2200ms` 后才进入 `complete`，标题变为 `THE UNKNOWN IS OPEN` 并显示：

- `RESTART`：重置 Signal、Portal、遗物与节点发现，滚回 Awakening；不重新显示 Boot，也不重置声音/质量/Lab 设置。
- `ENTER LAB`：打开 Specimen Lab。
- `VIEW SYSTEM`：把 debug 打开后进入同一个 Specimen Lab。

三个结果按钮会在 complete 后立即渲染在带 `aria-busy` 的容器中；完成指针仍按住时保持 disabled，window 收到 `pointerup` / `pointercancel` 后再等待 `180ms` 才开放，避免 touch release 落到刚替换出的 Restart/Lab/System 控件。键盘完成没有 pointer-held 阶段，仍经过 180ms 保护。隐藏 `role="status"` 会在 crossing 时播报正在穿越，完成后先播报 actions preparing，再在可操作时播报 available。

Portal 的 charging/complete 标题只在 `.app-shell[data-active-act='portal']` 下固定到 HUD 安全区；离开该幕不会把大标题带到后续/前序章节。移动端另调整标题、充能按钮和结果按钮的 safe-area 构图。当前没有前置 requirements 或死结局检查；Portal 仍可在没有检查遗物或节点的情况下完成。

### Hidden Specimen Lab / Config Act 08

**入口/退出**：桌面与平板 HUD 的 TestTube 按钮可随时打开；手机 HUD 隐藏该按钮，但 Portal 完成后仍有入口。背景、Close 或 Escape 关闭。`useDialogLifecycle` 负责 focus trap、背景 inert/`aria-hidden`、页面滚动锁和焦点恢复。没有 `Shift+L` 彩蛋。

**实时标本**：打开时七幕叙事 3D group 隐藏，`SpecimenLabScene` 挂载；关闭时该场景卸载。标本包含粒子场、shader surface、双色 point lights 和可选 diagnostic cage。宽视口时标本向左偏置，为右侧控制台留空间。

**控制项**：

- Shader：`spectral / interference / event-horizon`
- Material：`chrome / iridescent / refractive`
- Field：`attract / repel / vortex`
- Theme：`aether / solar / null / pearl`
- Quality：无 reduced/mobile 质量锁时可选 `ultra / balanced / lite`；有锁时固定 LITE，其他两档禁用
- Time scale：`0.25–2×`
- Particle field：`0.25–1.5×`
- `POST FX INTENSITY`：`0–1.5×`，实际乘到 Bloom、Chroma、Noise、Vignette 与可用的 DOF
- `POST FX` 与 `DEBUG FIELD`

控制台对物理 GPU 使用连续 1s 窗口、至少两窗后取最近最多三窗平均的 RAF FPS；检测到 SwiftShader/llvmpipe/software 时显示 `SW FPS`，明确拒绝把软件渲染吞吐伪装成真机 GPU 性能。DPR 是 UI 计算的 cap 估值：`min(devicePixelRatio, ULTRA 2 / BALANCED 1.5 / LITE 1)`，不是从 renderer 读取的实时 pixel ratio，LITE 显示值也不同于配置中的 `1.15` 上限。Canvas 另以低频 `data-*` 暴露 renderer frame、calls、triangles、geometries、textures 和 camera Z/FOV，供自动预算测试读取，不把它们堆进 Lab UI。

粒子场始终创建一组最大 `3300` 粒子的 position/phase/scale buffer；质量档或 multiplier 只改变 geometry drawRange，因此反复切换不会持续分配新的 GPU buffer。实时 3D 的四套主题色统一从 `THEME_VARIANTS → THEME_SCENE_COLORS` 派生，Core 与 Lab scene 不再各自维护平行硬编码；DOM 仍由同一 theme state 切换 `data-theme` CSS token。质量选择实时更新可热改预算，但保持同一个 WebGL context，antialias / power preference 不随 Lab 切档重建；设置关闭后保留，不会自动恢复到进入 Lab 前的主题/时间/材质。

## 4. 跨幕 UI、输入与可访问性

- HUD 桌面列出 01–07，没有锁章；跳转使用 Lenis，reduced-motion 立即跳转。`≤1100px` 隐藏章节 nav。
- HUD 始终保留声音开关、`0–100%` 音量、质量和章进度；手机隐藏 TestTube，质量标签缩成图标。reduced-motion、`<900px` 或粗指针锁生效时，质量按钮禁用并以可访问名称说明原因。音量实时写入 Audio master gain，但不跨刷新持久化。
- Custom Cursor 组件在进入后挂载，并订阅 `hover:hover` + `pointer:fine` 的媒体查询变化；只有非 reduced-motion 且具备 fine/hover 能力时才安装全局指针监听。能力丢失会清零速度、归一化坐标与 down 状态；`pointerup`、`pointercancel`、window blur 和 effect cleanup 也会复位 down。ULTRA/BALANCED/LITE 分别实际渲染 `32/20/0` 个 trail，CSS 另外在 `<=767px` 和 reduced-motion 下隐藏 cursor 外壳。磁吸按钮的 `pointermove` 会逐次检查同一媒体查询，能力不满足时不施加偏移；偏移写入 CSS `translate`，不覆盖控件自己的 `transform` 构图。
- 语义结构是 `main` 下七个 section；Canvas 与 fallback 视觉层均 `aria-hidden`。Signal range、遗物按钮、六个主节点与 Portal hold 都是 DOM 控件。
- Artifact Modal 和 Lab 是 modal dialog；两个 overlay 同时被打开时的计数锁定也由共享 lifecycle 处理。

## 5. 移动、自适应与 fallback

- `≤767px` 不执行 Artifacts 横向 pin，改用 scroll-snap；Signal 控件单列；Constellation 主节点按钮可滚动；Portal/结果按钮避开 `safe-area-inset-bottom`。
- coarse pointer 或宽度 `<900px` 是运行时移动质量锁：App 监听 pointer media change 与 resize，条件成立时保存此前 manual 档、设为 AUTO LITE，并禁用 HUD 质量与 Lab 非 LITE 入口；所有锁解除后恢复暂存档。粗指针另降低配置 path roll 并关闭场景对象命中。构图断点与质量锁是两条独立 CSS/TypeScript 路径。
- reduced-motion 可在运行中切换：Lenis 以即时参数重建，非必要 GSAP 时间线关闭；相机使用章节中段窄范围，roll/视差为 0，Canvas demand，质量也锁为 AUTO LITE，Cursor/Signal 2D 同步降级。关闭偏好后只有在移动质量锁也解除时才恢复切入前暂存的手动档。
- WebGL2 探测失败、SceneCanvas error boundary 失败，或运行中收到 `webglcontextlost` 时，`WebGLFallback` 用 act 属性切换 CSS Core、Tunnel、Relics、Network、Horizon 与 Gate。DOM 主路径不依赖 WebGL。
- Context-loss listener 会 `preventDefault()` 并延后一轮检查 canvas 是否仍连接：已卸载 Canvas 的迟到 loss 被忽略，仍连接 Canvas 的真实 runtime loss 才会在当前页面会话永久卸载 Canvas。当前不尝试恢复/重建 context，也没有每幕独立 error boundary，错误边界覆盖整个 SceneCanvas。

## 6. 自动验收与截图

`tests/visual.spec.ts` 在 desktop/tablet/mobile 走真实 Boot、章节可访问名称、主旅程关键交互、音量滑杆、Ocean sticky 语义、Lab post-FX 强度、启动/运行期 antialias 契约、移动质量锁与可见按钮的约 44px 目标；当前尺寸断言没有匹配原生 range。`tests/quality-switch.spec.ts` 单独验证桌面 Canvas identity 与启动 AA 在 reduced-motion LITE、恢复 BALANCED 及再次切 LITE 的过程中均保持稳定，WebGL2 仍存活，并在同一 context 中关闭/重开 POST FX 后检查无 pageerror。移动主旅程另断言初始 LITE 的 antialias=false。`tests/preload-timeout.spec.ts` 验证悬挂资源不会锁死 Boot；`tests/audio-fallback.spec.ts` 验证 Web Audio 缺失时静默进入，`tests/audio-late-unlock.spec.ts` 验证 Abort 后不会由迟到 resume 打开引擎/误报 HUD，且 HUD 重试可成功；`tests/signal-lab.spec.ts` 用非目标手动参数验证可见 89% 与共享评分/hold lock 一致；`tests/artifact-transition.spec.ts` 验证详情 dialog 往返、双向 shared snapshot 与 morph 属性清理，实时 3D 遗物推进/返回由场景实现并在 Gallery 中审片；`tests/portal.spec.ts` 验证 elapsed-time charge、crossing、镜头反馈、blur 清零、Restart 与 retained heap，`tests/portal-touch.spec.ts` 在 tablet/mobile 专门验证完成 touch release 不会穿透到结果动作；`tests/fallback.spec.ts` 使用禁用 WebGL 的独立项目验证 Descent→Portal 的 act 切换，以及一个遗物、Auto Align、一个主节点和 Portal→Lab 路径；`tests/context-loss.spec.ts` 验证运行时永久切到 2D；`tests/performance.spec.ts` 记录桌面回归证据并执行预算断言；`tests/render-budget.spec.ts` 验证 LITE 实际 cadence；`tests/specimen-buffer.spec.ts` 验证反复改档/粒子倍率时 WebGL geometry 数量不增长。可选 `tests/visual-gallery.spec.ts` 生成旧版逐幕图；环境开关控制的 `tests/final-gallery.spec.ts` 生成第三轮完整审片证据并检查 Console、page error、request failure 与 HTTP 错误为空。

当前截图路径：

- 主视口：`output/playwright/desktop.png`、`tablet.png`、`mobile.png`
- 第一轮：`output/playwright/round1-boot.png`、`round1-hero.png`
- 第二轮：`output/playwright/round2-artifacts.png`、`round2-signal.png`、`round2-ocean.png`、`round2-map.png`、`round2-portal.png`、`round2-specimen-lab.png`
- Lab 复核：`output/playwright/specimen-lab.png`
- 第三轮完整审片：`screenshots/final-round3/desktop/`、`screenshots/final-round3/tablet/`、`screenshots/final-round3/mobile/`
- 第三轮每个项目目录均由 `final-gallery.spec.ts` 写入 `manifest.json`，记录 viewport、quality、renderer、reduced-motion、截图清单与浏览器诊断；桌面 12 帧，平板/手机各 7 帧。Portal 画廊保留 ready/open 稳态，充能/crossing 瞬态由专项计时测试覆盖。

这些图是当前工作区已有审片资产，不代表每次 `pnpm test:e2e` 都会重写全部文件；`pnpm capture` 只重写三个主视口截图，可选旧 gallery 才重写 round2 逐幕图。Round 3 只有在 `AETHER_FINAL_GALLERY=1` 时运行并重写对应项目目录。当前自动截图环境可能使用 SwiftShader，因此 manifest 证明的是视觉、交互与错误诊断闭环，不等价于真机 GPU 的 60 FPS 签收。
