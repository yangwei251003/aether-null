# AETHER//NULL 开源发布核查

日期：2026-10-26。检查针对独立发布候选，未修改原项目目录。

## 已执行

| 检查 | 结果 |
|---|---|
| 锁文件安装 | Node.js 24.15.0、pnpm 10.33.2，`pnpm install --frozen-lockfile` 通过 |
| 类型检查 | `pnpm typecheck` 通过，包含应用及 Playwright TypeScript |
| 生产构建 | `pnpm build` 通过，输出静态 HTML、CSS、JavaScript 及本地图像/字体 |
| 第三方声明 | 根据当前安装树重新生成：72 个生产包、149 份去重 notice，没有 unresolved 条目 |
| 桌面遗物交互 | 详情打开、关闭与双向过渡通过 |
| 桌面信号校准 | 手动滑杆值、可见评分与锁定状态一致性通过 |
| 桌面完整旅程 | 实际通过 Boot、七章叙事、品质切换、遗物、信号、星图、传送门与 Specimen Lab 的既有测试；该测试同时检查脚本、网络与资源错误 |
| 手机完整旅程 | 390 × 844 触屏配置下的既有完整旅程通过，包含44px触控目标、传送门与Lab交互 |
| WebGL不可用 | 禁用WebGL/WebGL2后，完整2D叙事、遗物、信号、星图、传送门与Lab流程通过 |
| Pages子路径 | 在 `/aether-null/` 子路径打开生产构建，Boot与关键预载通过；MemoryOcean图片宽1536px；无脚本错误、HTTP错误、失败或外部资源请求 |
| 文档截图 | 实际运行 Chrome 后捕获首页，已人工检查；不是效果设计稿或生成截图 |

测试使用现有 Chrome 的官方 Playwright `channel` 支持。初次默认测试环境缺少其对应的 Chromium headless shell，未进入功能断言；切换到已安装 Chrome 后重新完成上述测试。

手机扩展检查发现背景元素同时使用 `inert` 与 `aria-hidden` 时可能保留隐藏焦点。公开候选移除了多余的背景 `aria-hidden`，并在隔离背景前转移焦点。修改后桌面、手机与WebGL回退三个完整旅程均通过，原项目目录未改动。

## 发布内容与隐私

- 保留完整 `src`、`public`、`scripts`、`tests`、锁文件和必要构建配置，以及原设计与性能文档。
- 排除依赖目录、构建产物、缓存、当前配置、环境变量文件、测试输出和日志。
- 体验采用虚构档案、程序化几何与交互声音，不包含真实账户、支付或个人位置数据；Boot 的装饰数字坐标已改为抽象文字。
- 敏感扫描保留必需的第三方版权作者声明；这些公开许可中的作者邮箱不作为原用户联系方式删除。

## Pages 适配

Vite 使用相对 `base`，动态图片通过 `import.meta.env.BASE_URL` 定位。字体、CSS 和 HTML 引用由 Vite 构建转换。`.github/workflows/pages.yml` 从锁文件安装依赖、检查并构建，只上传 `dist`。

GitHub 上的真实部署由主发布流程另行启用和核验；此文档本身不表示远端已部署成功。

## 许可与未验证范围

原创代码与文档采用根 MIT。GSAP 不是 MIT / OSI 开源软件，其独立许可必须保留；不能把所有依赖统一改写为 MIT。字体、图标、其他依赖与项目 AI 辅助图像分别见 [资产与依赖来源](../ASSET_LICENSES.md)。

本次没有完整重跑所有历史性能、音频故障、显存预算与各设备矩阵，也没有在第二台物理设备或 Safari / Firefox 实测。历史性能记录只反映原记录日期，不宣称本次跨所有硬件验证。

参考：[Vite 官方部署说明](https://vite.dev/guide/static-deploy.html#github-pages)、[Vite 公共基础路径](https://vite.dev/guide/build.html#public-base-path)、[Playwright 官方浏览器 channel](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge)。
