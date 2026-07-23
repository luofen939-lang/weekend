# 懒得动

一个帮助用户减少周末出行决策成本的多端应用。用户只需要选择心情、预算、距离等偏好，系统就会从地点与活动池中给出一个可以立即执行的出门方案。

项目包含 Expo 多端客户端、Node.js API、MySQL 数据库迁移、可选 AI 推荐能力，以及 Web、iOS、Android 共用的产品与设计资料。

> 当前为 MVP / 学习型项目。公开部署前，请完成安全审计、隐私合规检查，并在仓库根目录添加适合你的开源许可证。

## 产品预览

| 首页 | 偏好选择 | 抽卡结果 |
| --- | --- | --- |
| ![首页](design/mobile-high-fidelity/exports/home.jpg) | ![偏好选择](design/mobile-high-fidelity/exports/preferences.jpg) | ![抽卡结果](design/mobile-high-fidelity/exports/result.jpg) |

| 活动详情 | 本周约定 |
| --- | --- |
| ![活动详情](design/mobile-high-fidelity/exports/detail.jpg) | ![本周约定](design/mobile-high-fidelity/exports/todos.jpg) |

## 核心能力

- 按城市、心情、人数、预算、距离和室内外偏好抽取活动
- 活动详情、地图导航、重抽与加入本周约定
- 邮箱验证码、访客会话与账号数据迁移
- 待办进度、签到、成长资产、日记与互动
- Web、iOS、Android 共用一套 React Native 页面
- 可选的语义搜索、个性化推荐与 AI 行程生成
- 地图、短信、邮件、支付与 AI 服务均通过环境变量接入
- 未配置第三方 AI 服务时，自动降级为规则或关键词方案

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 客户端 | Expo 56、React Native、React Native Web、Expo Router、TypeScript |
| API | Node.js 24、Express 5、TypeScript |
| 数据 | MySQL 8；可选 Qdrant / Chroma 向量库 |
| AI | OpenAI 兼容接口、硅基流动、智谱、DeepSeek（均为可选） |
| 地图 | 高德地图 JS API / Web 服务 |
| CI/CD | GitHub Actions、GitHub Pages（仅静态前端） |

## 项目结构

```text
.
├── apps
│   ├── client                 # Expo 多端客户端
│   └── api                    # Express API
├── database
│   ├── migrations             # 增量数据库迁移
│   ├── bootstrap.sql          # 本地数据库初始化
│   ├── schema.sql             # 基础表结构
│   └── seed.sql               # 演示数据
├── design                     # 高保真设计稿与页面原型
├── docs                       # PRD 与 AI 推荐方案文档
├── scripts                    # 数据导入与本地工具
└── .github/workflows          # GitHub Pages 工作流
```

本开源副本没有包含本地依赖、数据库数据、真实环境变量、证书、日志、用户上传内容、构建产物和平台部署缓存。完整清单见 [OPEN_SOURCE_CHECKLIST.md](OPEN_SOURCE_CHECKLIST.md)。

## 环境要求

- Node.js 24 LTS
- npm 11+
- MySQL 8.0+
- 可选：Docker Desktop 或本地 Qdrant
- iOS 调试需要 macOS 与 Xcode
- Android 调试需要 Android Studio

## 快速开始

### 1. 安装依赖

```bash
npm --prefix apps/api ci
npm --prefix apps/client ci
```

### 2. 创建本地配置

```bash
cp apps/api/.env.example apps/api/.env
cp apps/client/.env.example apps/client/.env.local
```

至少需要为 API 设置数据库连接信息和一个不少于 32 个字符、随机生成的 `JWT_SECRET`。示例配置使用本机 MySQL 管理账号，生产环境必须改为独立的最小权限账号。不要把 `.env`、私钥或第三方服务密钥提交到 Git。

可以使用下面的命令生成本地 JWT 密钥：

```bash
openssl rand -base64 48
```

### 3. 初始化数据库

```bash
mysql -u root -p < database/bootstrap.sql
npm run db:migrate
```

### 4. 启动 API

```bash
npm run dev:api
```

API 默认地址为 `http://localhost:3001/api/v1`，健康检查为 `http://localhost:3001/health`。

### 5. 启动客户端

另开一个终端：

```bash
npm run dev:web
```

也可以启动 Expo 交互终端：

```bash
npm run dev:client
```

然后按 `w`、`i` 或 `a` 分别打开 Web、iOS 模拟器或 Android 模拟器。

## 环境变量

### 客户端

配置文件：`apps/client/.env.local`

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | 是 | API 的完整 `/api/v1` 地址 |
| `EXPO_PUBLIC_AMAP_JS_KEY` | 地图可选 | 高德 JS API 客户端 Key |
| `EXPO_PUBLIC_AMAP_SERVICE_HOST` | 生产环境推荐 | 高德安全代理地址 |
| `EXPO_PUBLIC_AMAP_SECURITY_JS_CODE` | 仅本地调试 | 会进入前端包，不应作为真正的服务端秘密 |

所有 `EXPO_PUBLIC_*` 变量都会被打进客户端包，任何人都能读取。真正的私钥、支付密钥和服务端 Token 必须只放在 API 环境中。

### API

配置文件：`apps/api/.env`

| 类别 | 主要变量 |
| --- | --- |
| 基础服务 | `PORT`、`CLIENT_ORIGIN`、`LOG_LEVEL` |
| MySQL | `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME` |
| 鉴权 | `JWT_SECRET` |
| 地图 | `AMAP_WEB_SERVICE_KEY` |
| 邮件 / 短信 | `EMAIL_PROVIDER`、SMTP 或腾讯云短信配置 |
| 支付 | 支付宝 App ID、应用私钥、公钥与回调地址 |
| AI | 对应服务商 API Key、模型名称与向量库地址 |

完整变量和注释见 [`apps/api/.env.example`](apps/api/.env.example)。

## 常用命令

```bash
npm run dev:web                 # 启动 Web 客户端
npm run dev:client              # 启动 Expo 交互终端
npm run dev:api                 # 启动 API
npm run build:web               # 导出静态 Web
npm run build:api               # 编译 API
npm run db:migrate              # 执行数据库迁移
npm run test                    # 运行 API 测试
npm run lint                    # 检查前后端
npm run security:scan           # 扫描常见敏感信息
```

## 可选 AI 能力

不配置 AI Key 时，抽卡和基础推荐仍然可用。启用语义搜索或 AI 行程生成时：

1. 在 `apps/api/.env` 中选择 AI 服务商并填写自己的 API Key。
2. 启动 Qdrant：

   ```bash
   npm run dev:qdrant
   ```

3. 重启 API，并访问：

   ```bash
   curl http://localhost:3001/api/v1/travel/status
   ```

更多说明见 [`docs/travel-ai-recommendation`](docs/travel-ai-recommendation)。

## GitHub Pages

仓库已经包含静态前端发布工作流。首次使用时：

1. 在 GitHub 仓库的 Settings → Pages 中选择 GitHub Actions。
2. 在 Actions variables 中配置 `EXPO_PUBLIC_API_URL`。
3. 如果启用地图，再配置 `EXPO_PUBLIC_AMAP_JS_KEY` 和 `EXPO_PUBLIC_AMAP_SERVICE_HOST`。
4. 推送到 `main` 分支。

工作流会根据仓库名称自动设置 Expo 的 Pages base path。GitHub Pages 只托管前端，API 和 MySQL 需要部署到其他服务。

## 数据与安全

- 仓库只包含演示数据，不应提交真实用户数据或数据库快照。
- 生产环境必须使用高强度 `JWT_SECRET`、HTTPS、最小权限数据库账号和严格的 CORS 白名单。
- 邮件、短信和支付回调需要额外的频率限制、签名校验与幂等处理。
- 上传文件应接入对象存储、内容类型校验、大小限制和恶意文件扫描。
- 提交前运行 `npm run security:scan`，并开启 GitHub Secret Scanning。
- 若发现安全问题，优先使用 GitHub 仓库的 Private vulnerability reporting，不要在公开 Issue 中披露密钥或漏洞细节。

## 文档

- [产品需求文档](docs/PRD-V1.2.md)
- [移动端高保真设计稿](design/mobile-high-fidelity/README.md)
- [Figma 页面结构](design/figma-app-structure.md)
- [AI 推荐技术方案](docs/travel-ai-recommendation)

## 贡献

欢迎通过 Issue 讨论需求、体验问题和实现方案。提交 Pull Request 前，请确保：

```bash
npm run security:scan
npm run lint
npm run test
npm run build:web
```

请勿在 Issue、截图、测试数据或提交历史中包含真实手机号、邮箱、访问令牌、支付密钥和数据库连接信息。
