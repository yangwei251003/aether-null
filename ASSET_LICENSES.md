# Asset Licenses & Provenance

本文件只记录当前工作区中实际存在、会进入页面或生产构建的视觉/字体资产。实现没有远程热链：图片、字体和 favicon 位于 `public/`，CSS 噪声为内联 data URI，3D 几何、粒子、shader 和声音由项目代码在浏览器中生成。Playwright 主旅程会检查资源 origin，并在发现外部请求时失败。

## 本地图片与项目视觉

| 文件或范围 | 当前来源记录 | 许可证 / 发布注意 |
| --- | --- | --- |
| `public/assets/images/memory-ocean.webp` | 1536×1024 的项目原创生成图；2026-08-23 在本次 Codex 会话中使用 OpenAI 图像生成工具生成，作为 Boot 关键图片和 Memory Ocean 的 WebP 回退。 | SHA-256：`5F255C5E7D01FF6518B3FFFC52F957B7AA1EC42D37CBD57929D7280B522EA907`。没有单独的第三方素材许可证；逐字提示词与未压缩原始生成文件未保留，不能用本记录独立审计训练数据或潜在第三方权利。 |
| `public/assets/images/memory-ocean.avif` | 同一项目图像的 1536×1024 AVIF 交付版本；`<picture>` 优先选择该版本。 | SHA-256：`02CE89041A28580B711329FFE476101B2EECC5F0BCCAB09E965B5224D0256A84`。继承 WebP 所记录的来源与权利边界；没有独立第三方许可。 |
| `public/favicon.svg` | 工作区内为 AETHER//NULL 编写的简单轨道 SVG。 | 项目资产；项目原创代码与该SVG按根级MIT许可发布；第三方组件仍保留各自协议。 |
| `src/scene/**` 与 `src/scene/shaders.ts` | 项目代码生成的 Three.js 几何、实例、BufferGeometry、粒子布局与 GLSL。 | 没有下载的 GLB/GLTF、HDRI 或纹理；代码分发条款仍取决于项目所有者，不能由本文件代替根级软件许可证。 |
| `src/styles/**` 中的几何与噪声 | 项目 CSS 的渐变、mask、clip-path、路径和内联 SVG turbulence。 | 没有外部图案包或运行时图像请求。 |
| `src/audio/AetherAudio.ts` | Web Audio oscillator、filter、gain、compressor、analyser 与实时交互音。 | 没有采样音频、音乐或下载的声音文件。 |

留存的生成描述摘要（不是逐字提示词）为：“alien black memory ocean transforming into star field; electric cyan/plasma magenta/solar amber; cinematic wide composition; no text/logos”。这条会话记录与上述哈希能确认当前文件的项目来源，但不能替代完整生成日志、适用服务条款或发布方对人物肖像、商标及其他潜在第三方权利的审查。

## 本地字体

三个 WOFF2 文件直接提交在 `public/assets/fonts/`，由 `src/styles/global.css` 的 `@font-face` 本地引用；项目没有安装或运行时请求 Fontsource 字体包。三者随附 SIL Open Font License 1.1：

- 完整许可证：`public/assets/fonts/LICENSES/OFL-1.1.txt`
- 字体声明：`public/assets/fonts/LICENSES/FONT_NOTICES.txt`

| 字体 | 本地文件 | 随附版权声明 | 许可证 |
| --- | --- | --- | --- |
| Archivo Variable | `public/assets/fonts/archivo-variable-latin.woff2` | Copyright 2020 The Archivo Project Authors | SIL OFL 1.1 |
| Manrope Variable | `public/assets/fonts/manrope-variable-latin.woff2` | Copyright 2018 The Manrope Project Authors | SIL OFL 1.1 |
| IBM Plex Mono 400 | `public/assets/fonts/ibm-plex-mono-latin-400.woff2` | Copyright © 2017 IBM Corp.; Reserved Font Name “Plex” | SIL OFL 1.1 |

OFL 1.1 允许使用、研究、嵌入与再分发字体，并要求字体软件及版权/许可证声明随分发保留；字体文件或其单独组件不可按许可证禁止的方式独立销售，修改版还须遵守保留名称条款。发布构建或源码包时应保留上述两个 `LICENSES/` 文件。

## 图标

界面中的扬声器、仪表、试管、箭头、准星等 React SVG 图标来自 `@phosphor-icons/react@2.1.10`。包内 `node_modules/@phosphor-icons/react/LICENSE` 声明 MIT License，Copyright © 2020 Phosphor Icons。项目已将完整文本保存为 `public/assets/licenses/PHOSPHOR-MIT.txt`；由于 `public/` 会原样进入 Vite 产物，当前构建可在 `dist/assets/licenses/PHOSPHOR-MIT.txt` 找到该 notice。

## 软件依赖与明确未包含

- `public/assets/licenses/THIRD_PARTY_NOTICES.md` 由 `pnpm licenses:generate` 调用本地生成脚本，并以 `pnpm licenses list --prod --json` 和当前安装的生产依赖图为输入。2026-08-23 的现状快照登记 72 个包，优先逐包复制顶层 LICENSE/COPYING/NOTICE；内容经换行标准化后按字节去重，同时保留包关联。对 7 个没有随安装包提供顶层 notice 的依赖（`@gsap/react`、`@mediapipe/tasks-vision`、`@react-three/fiber`、`draco3d`、`gsap`、`maath`、`stats-gl`），生成器归档嵌入源码声明，并在 manifest 指向标准 SPDX 时补入完整标准文本。最终共有 149 份 distinct notice、0 条 unresolved；three.js 等实际包的版权/许可文本也已包含。Vite 构建会把快照复制到 `dist/assets/licenses/THIRD_PARTY_NOTICES.md`；依赖、锁文件或安装树改变后应重新生成并再次构建，不能把当前快照当作未来版本的永久清单。
- GSAP / `@gsap/react` 在聚合 notices 中按已安装 manifest 记录，并链接 GSAP Standard License 与 licensing 页面；GSAP 不是 MIT 开源软件，文件没有把网页条款冻结成一份本地许可文本。商业再分发或业务模式改变前，发布方仍须检查当时适用条款。
- 当前没有第三方照片、视频、音效、音乐、GLB/GLTF、HDRI、远程字体或 CDN 媒体。
- 本次开源整理已增加根级MIT许可，适用于可授予权利的原创代码与文档。字体、图标和软件依赖保留各自协议；AI辅助图像保持上文的来源与权利边界，不声称根MIT替代潜在第三方权利。
