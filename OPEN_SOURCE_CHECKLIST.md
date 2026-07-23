# 开源发布检查清单

这份目录是从本地开发项目生成的开源副本。原项目未被修改。

## 已从副本排除

- `.env`、`.env.local` 与其他本地环境变量
- 妙搭 / 飞书部署 Token、预览会话、应用 ID 和数据库连接串
- `.tools` 中的 MySQL 二进制、本地数据库、证书和日志
- `node_modules`、`dist`、`build`、`.expo`、`.next`、覆盖率和缓存
- `.sites-deploy`、`.miaoda-fullstack` 等平台部署工作区
- API 上传目录、支付证书和运行时附件
- 嵌套 Git 仓库和本地 Git 历史
- 重复的内部 Word 版 PRD
- 来源和再分发授权不明确的活动实景图片

## 已完成的脱敏

- 删除线上部署域名和平台应用 ID
- 删除个人 GitHub 用户名和固定仓库地址
- 将本机绝对路径改为命令行参数或仓库相对路径
- 将第三方服务凭据改为空白示例变量
- GitHub Pages base path 改为根据仓库名称动态生成
- 活动封面兜底改为仓库内置插画

## 发布前仍需人工确认

- [x] 选择项目级许可证并添加根目录 `LICENSE`（MIT）
- [ ] 确认插画、字体、图标、照片和品牌名称拥有公开分发权
- [ ] 运行 `npm run security:scan`
- [ ] 运行 `npm run lint`、`npm run test` 和 `npm run build:web`
- [ ] 检查 Git 暂存区：`git diff --cached`
- [ ] 开启 GitHub Secret Scanning 与 Dependabot
- [ ] 将生产 API 地址配置为 GitHub Actions variable
- [ ] 确认生产数据库不使用演示账号或默认密码
- [ ] 为生产 API 配置 HTTPS、CORS 白名单、限流和日志脱敏

## 建议的首次提交方式

```bash
git init
git branch -M main
git add .
npm run security:scan
git commit -m "chore: prepare initial open-source release"
```

如果密钥曾经进入 Git 历史，仅删除当前文件是不够的；应先轮换密钥，并使用 `git filter-repo` 等工具清理历史后再公开。
