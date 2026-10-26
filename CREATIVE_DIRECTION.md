# AETHER//NULL — Creative Direction

> 状态：当前实现的创意基准。这里区分“已经出现在浏览器里的语言”和“后续审片原则”，不把未落地的镜头或游戏机制写成既成事实。

## 1. 核心命题

用户不是来浏览产品，而是被一段失落信号选中的见证者。Boot 让一次普通页面加载变成接触仪式；七个滚动章节把浏览动作转译为唤醒、下坠、观察、校准、触碰、定位与穿越。

当前体验的呼吸是：

**冷启动 → 苏醒 → 下坠 → 考古 → 校准 → 漂浮 → 联结 → 穿越**

三个仍然有效的判断标准：

1. **因果可见**：滚动、指针、滑杆、节点与长按都应改变光、空间、声音或状态。
2. **极繁受控**：实时场景负责密度，正文周围保留黑场；信息不铺成通用玻璃卡片墙。
3. **母题连续**：断环、信号、轨道、碎片和坐标跨幕复现，即使当前版本使用场景交叉淡化而非完整物质变形。

## 2. 世界观与文案语气

- Aether Archive 是一座在宇宙边界恢复自检能力的失落档案馆。
- Aether Core 是机器、信标与记忆容器的混合体；用户进入后，它才获得完整的光与声音。
- 文案使用短句、编号、坐标和未解释的档案术语。系统冷静，信号本身诗意。
- 主标题与操作文案保持英文，避免营销式解释；页面 `<html lang="en">` 与实际界面语言一致。
- 结局不是胜利计分，而是边界被重新打开：`THE UNKNOWN IS OPEN`。

## 3. 八幕已实现叙事

| 幕 | 视觉主角 | 用户动作与当前结果 |
| ---: | --- | --- |
| 00 / Boot | 真实任务进度驱动的坐标环与指针磁吸粒子 | READY 后尝试解锁程序化声音；580ms 音频预算超时会中止本次解锁并静默进入，HUD 仍可重试。 |
| 01 / Awakening | 液态铬 Core、轨道、碎片与粒子 | 滚动推进镜头；细指针改变观察偏移与表面响应。 |
| 02 / Descent | 粒子隧道、光轨、断环和测量路径 | 滚动进度与速度改变旅行、拖尾感、相机 FOV 与 roll。 |
| 03 / Artifacts | 五件不同轮廓的程序化遗物 | 浏览横向展馆；选中遗物会从展台飞向镜头，卡片轮廓与详情 sigil 通过双向 shared View Transition 完成 3D→2D→3D 交接。 |
| 04 / Signal Lab | 3D signal field + 2D 粒子仪器 | 调整三参数；达到阈值并保持后锁定 Signal ID。 |
| 05 / Memory Ocean | 本地海面图像、3D 波面与海→星粒子 | 指针移动涟漪；滚动让海面逐渐失重。 |
| 06 / Constellation | 30 节点与 32 条脉冲路径 | 桌面拖拽空间；聚焦六个主节点之一并读取档案。 |
| 07 / Portal | 多层断环、shader 光阱与向心粒子 | 持续长按约 1.7s 充能，进入 2.2s crossing，再开放 Restart、Lab 与 System；粒子、声音、闪光、曝光和镜头 Dolly/FOV 同步响应。 |

Hidden Specimen Lab 是幕后第九空间：它不是新剧情关卡，而是把渲染系统当成标本公开。打开时叙事场景退场，单一实时标本占据画面；控制台只承担可观测、可操作的技术参数。

## 4. 视觉 DNA

### 4.1 已使用母题

| 母题 | 当前造型 | 叙事职责 |
| --- | --- | --- |
| 信号 | 单线波形、频谱、脉冲节点、Signal ID | 表示响应、校准和可恢复的信息。 |
| 断环 | Boot 坐标环、Core 轨道、隧道环、Portal 环 | 表示测量系统与未闭合边界。 |
| 光轨 | Descent rails、星图连接、Portal 向心粒子 | 给滚动和长按一个空间方向。 |
| 碎片 | Core 实例片、遗物几何、CSS 断面 | 表示文明材料与残余结构。 |
| 坐标 | Mono 标签、幕编号、深度值、节点 code | 给超现实画面建立可信尺度。 |

### 4.2 当前色彩系统

页面的基础 CSS token 与 `[data-theme]` 主题覆盖来自 `src/styles/global.css`；逐幕 background/fog 来自 `src/config/theme.ts` 的 `CHAPTER_THEMES`。实时 3D 的四套主题以 `THEME_VARIANTS` 为配置源，再由 `THEME_SCENE_COLORS` 同步提供给 Core 与 Lab 的材质、粒子和灯光；Core 与 Lab scene 不再各自维护一份平行色表：

| Token / 角色 | 色值 | 用途 |
| --- | ---: | --- |
| Obsidian | `#030407` | 页面与空间主背景 |
| Void | `#080A0F` | 深层暗面 |
| Graphite | `#11151D` | 控制面与结构层 |
| Chrome | `#A9B6BD` | 次级金属与数据 |
| Cyan | `#62F1FF` | 信号、路径、聚焦与确认 |
| Magenta | `#FA61C3` | 相位、异常与深层空间 |
| Amber | `#FFB14A` | 遗物与 Portal 能量 |
| Pearl | `#EDF5F4` | 主标题与最高亮度 |

逐幕背景与雾色由 `CHAPTER_THEMES` 插值：Awakening 以 Cyan/Pearl 为中心，Descent 偏 Magenta，Artifacts 转 Amber，Signal 回到 Cyan/Magenta，Ocean 降饱和，Constellation 恢复 Cyan，Portal 让 Amber 收束。Lab 另提供 Aether、Solar、Null、Pearl 四套实时主题；主题选择通过同一 state 同时切换 DOM 的 `data-theme` token 覆盖与 3D scene 配置，关闭 Lab 后仍保留在本次页面会话。

### 4.3 材质与空间

- **Core**：多层噪声驱动的 shader 形变、Fresnel、光谱边缘、轨道与实例碎片；不是贴图球。
- **Tunnel**：shader Points、实例化环和线段轨道按 act progress 旅行；速度只作为附加热量与尺度反馈。
- **Artifacts**：The Breathing Seed、The Ring of Unspent Hours、Transparent Archive、City Folded at Dusk、Mask of the Last Witness 使用不同几何和材质逻辑；选中时对应 3D 物体放大并飞向画面中心，其他遗物退让，DOM 卡片与详情 sigil 以同名 shared View Transition 接力，关闭时逆向返回展台。它是跨层构图交接，不声称逐顶点 mesh 投影。
- **Signal**：实时 3D 粒子 uniform 与独立 2D Canvas 仪器同时响应参数；Lab 的 shader/field/time/particle 设置会影响 3D signal field。
- **Ocean**：本地压缩主视觉承担大构图，Three 波面、世界空间 Fresnel、指针涟漪与 morph particles 形成海面→星空转化；章节使用 `overflow: clip` 保留 sticky 海面而不制造错误滚动容器，不是昂贵的实时反射水体。
- **Constellation**：实例化 icosahedron 节点、lineSegments 脉冲和焦点 reticle；主节点另有 DOM 语义镜像。
- **Portal**：shader 圆盘、4–8 层断环与质量档粒子共同响应实际充能状态。
- **Specimen Lab**：实时标本表面、粒子场和诊断 cage 分别响应 shader、材质、力场、主题、时间、粒子、`POST FX INTENSITY 0–1.5×` 与 debug；粒子场只创建一次最大容量 buffer，再以 drawRange 改变有效数量。Lab 打开时景深归零，避免控制台后的标本模糊。

## 5. 排版系统

字体全部从 `public/assets/fonts/` 本地加载：

- **Display — Archivo Variable**：主标题与大型幕标题，使用宽度/字重轴形成雕塑感。
- **Body — Manrope Variable**：叙事、说明与操作文本。
- **Data — IBM Plex Mono 400**：坐标、章节、Signal ID、参数和系统读数。

标题尺度主要使用 `clamp()`；大型 Display 通常收紧 `-0.055em` 至 `-0.09em`，Mono 数据保持较宽字距。自写 `SplitText` 为视觉字符提供 `aria-hidden`，外层通过 `aria-label` 暴露稳定全文；GSAP 的原生 SplitText 只在非 reduced-motion 时处理指定 DOM，并使用自动 ARIA。

## 6. 当前运动语言

- Lenis 只做滚动插值，并接入 GSAP ticker；ScrollTrigger 将每幕进度写入共享 signal。
- CameraRig 在配置关键帧间平滑插值位置、target、FOV、roll 与焦距；指针仅叠加小范围偏移。
- 七个 3D 场景加载后同时驻留在当前 Canvas；`ActLayer` 以 opacity、scale 和 Z 位移交接，非当前幕停止场景更新。章节与运行期质量切换都保留同一个 WebGL context；切档实时改变 DPR、场景预算与后处理，而 context antialias / power preference 沿用启动时选择。ULTRA/BALANCED 另挂可热切换的后处理 SMAA，LITE 不挂载。ULTRA/BALANCED 使用连续 frameloop；LITE 以 demand + 定时 invalidate 实际限制在约 30 FPS，reduced-motion 与页面隐藏时也切为 demand。
- GSAP 负责 DOM reveal、字符、Artifacts 横向 pin、Ocean 透视与 Descent SVG draw/morph/motion path。
- 磁吸按钮使用独立 DOM pointer listener 和 CSS `translate`；每次 `pointermove` 都读取当前的 `hover:hover` + `pointer:fine`，条件不满足时不施加偏移。独立位移不会覆盖按钮原有的 `transform` 构图（例如 Portal 的 `translateX(-50%)` 居中）。
- Artifact 详情在浏览器支持、且未启用 reduced-motion 时调用双向 View Transition API；共享名把展馆卡片轮廓与 modal sigil 连接起来，3D 遗物同时向中心/镜头推进，关闭时两条运动链都返回。回退路径直接开关 modal，不影响操作。
- Portal 的数字显示约每 80ms 更新；3D 光阱仍从连续 charge/ref 读取。状态按 `dormant → charging → crossing → complete` 推进，约 1.7s 充能与 2.2s crossing 期间同步声音、粒子、曝光、闪光与镜头。
- Portal 只有在当前 active act 为 Portal 且处于 charging/complete 时才把标题构图固定到安全区；离开章节后不会跨幕覆盖。移动端另为 HUD 与底部安全区重新安排标题和操作。
- 页面隐藏时停止平滑滚动、暂停音频，并把 R3F 改为 demand。

`prefers-reduced-motion` 可在运行中响应：Lenis 改为即时参数，GSAP 滚动揭示、指针视差和 camera roll 关闭；全局 CSS 把循环与 transition 缩为近乎即时，3D 只在需要重绘时以极小时间步响应滚动，Cursor trail 归零，Signal 2D 场改为 36 粒子的显式重绘。它保留状态变化和完整操作，不把“减少运动”等同于“移除内容”。

## 7. 声音方向与实装边界

声音在用户进入后才创建/恢复 AudioContext。当前引擎实现：

- 三个 oscillator 与浏览器生成的循环 noise buffer 构成可变 drone，经 ambient gain、low-pass、analyser、compressor 和 master 输出。
- 每幕根据 `AUDIO_CONFIG.scenes` 改变基频、谐波、filter 与 gain，并做平滑过渡。
- 遗物/节点/Signal 使用短 chirp 或 impact；Portal 长按使用持续 sawtooth charge voice。
- Signal 参数改变 filter、Q、ambient gain 与 oscillator detune；analyser 频谱能量回送到 3D Signal shader 的 alignment 与粒子尺寸，静音时显式返回 0。
- HUD 提供声音开关和 `0–100%` 音量滑杆，音量实时写入 master gain；设置只保留在当前页面会话。
- Boot 的 580ms 解锁预算由 `AbortSignal` 截断迟到尝试，避免静默进入后旧 promise 反向覆盖 HUD；用户可从 HUD 发起新的授权尝试。
- 页面隐藏时 AudioContext suspend，回到页面且声音启用时 resume。

`AUDIO_CONFIG` 的 ambient bus gain/lowpass 用于初始化主 ambient 链；通用 `cue()` 合成器读取 cue 包络和所属 bus 的 gain scalar，但不读取这些 bus 的 lowpass。Boot、遗物、节点、Signal lock 与 Portal crossing 已有调用点。配置中的 `core-pulse`、`parameter-tick`、`portal-charge` cue 尚未直接调用，Portal charge 使用独立持续 oscillator。没有独立 AudioNode 子总线、采样音乐、海浪或下载音效；音量可调，但不会持久化到页面刷新后。

## 8. 响应式、可达性与 fallback

- **桌面**：完整章节导航、横向 pinned 遗物馆、细指针视差、自定义光标、3D 节点命中与星图拖拽。
- **平板**：隐藏章节导航，保留 HUD Lab；粗指针触发运行时 LITE 质量锁，并关闭 Canvas 的对象命中，主要操作走 DOM。
- **手机 `<768px`**：竖屏重构图、scroll-snap 遗物、单列 Signal 控件、主节点按钮网格、底部安全区 Portal；`<900px` 规则锁定 LITE，HUD Lab 图标隐藏，Portal 完成后仍可进入 Lab。
- 页面使用 skip link、语义 section、稳定 heading、原生按钮/range、可见 focus 与 live region。Artifact 与 Lab 对话框有焦点圈定、Escape、背景 inert、滚动锁定和焦点恢复。
- WebGL2 不可用、SceneCanvas 抛错或仍连接 Canvas 的真实 runtime context loss 时，CSS fallback 按 act 切换 Core、Tunnel、Relics、Signal、Horizon、Network 与 Gate；同一 DOM 叙事和游戏控件继续工作。真实 context loss 在当前页面会话永久转入 2D，不尝试恢复 WebGL；已卸载 Canvas 的迟到 loss 会因连接状态检查而被忽略。

当前没有 forced-colors 专用样式、WebGL context 自动恢复/重建、触屏 3D 拖拽、星图 TRACE 游戏或 Portal 前置资源门槛。后续若实现，应先补测试与本文事实，再升级创意承诺。

## 9. 审片否决清单

这些是后续改动的判断门槛，不代表浏览器自动保证：

- 不把现有黑场填成卡片墙，不让 Bloom 吞掉轮廓和正文。
- 不用新随机粒子替代明确构图；粒子必须有轨道、力场、波面或 Portal 因果。
- 不以更强 blur、chroma、noise 掩盖构图问题。
- 不删除键盘/触摸路径来换取只对鼠标成立的效果。
- 新的材质、声音或外部媒体必须同时补资源来源、许可证、fallback 与质量档。

逐幕实装参数见 `SCENE_MAP.md`；代码与验证边界见 `TECH_PLAN.md` 和 `PERFORMANCE.md`。
