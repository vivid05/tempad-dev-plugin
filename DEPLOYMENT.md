# GitHub Pages 部署说明

项目已成功推送到 GitHub，但需要手动启用 GitHub Pages 功能。

## 启用 GitHub Pages 的步骤

### 方法一：通过 GitHub 网站配置（推荐）

1. 访问仓库设置页面：https://github.com/vivid05/tempad-dev-plugin/settings/pages

2. 登录您的 GitHub 账号

3. 在 **Build and deployment** 部分：
   - **Source**: 选择 `GitHub Actions`

4. 保存设置后，GitHub Actions 会自动重新运行并部署站点

### 方法二：通过 GitHub CLI

如果已安装 GitHub CLI (`gh`)：

```bash
# 登录 GitHub
gh auth login

# 启用 Pages（Source: GitHub Actions）
gh api repos/vivid05/tempad-dev-plugin/pages \
  -X POST \
  -f source[type]="workflow"
```

## 验证部署

部署成功后，插件将可通过以下地址访问：

- **主页**: https://vivid05.github.io/tempad-dev-plugin/
- **插件文件**: https://vivid05.github.io/tempad-dev-plugin/dist/plugin.mjs

## 故障排除

### 问题：GitHub Actions 运行失败

**错误信息**: "Get Pages site failed. Please verify that the repository has Pages enabled"

**解决方案**: 按照上述步骤启用 GitHub Pages

### 问题：无法访问仓库设置

**可能原因**: 
- 未登录 GitHub 账号
- 没有仓库的管理员权限

**解决方案**: 确保已登录并拥有仓库的 admin 权限

## 部署流程

启用 Pages 后，每次推送到 `main` 分支都会自动：

1. 触发 GitHub Actions workflow
2. 构建并上传网站内容
3. 部署到 GitHub Pages
4. 几分钟后即可通过 URL 访问

## 本地开发

如果需要本地测试，可以运行：

```bash
# 使用 HTTPS 开发服务器（带自签名证书）
node dev-server.js

# 访问地址：
# https://localhost:3000/dist/plugin.mjs
# https://<your-ip>:3000/dist/plugin.mjs
```

