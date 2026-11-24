# Joe_Site

这是我的个人网站项目，前端使用 HTML 和 CSS + JavaScript，从零开始开发，后端采用 Python 的 Flask 框架进行路由配置。

## 分支工作流

- `dev` 是日常开发分支，所有改动（功能、修复、样式、实验）都在这里提交并 push 到 `origin/dev`。
- `main` 是稳定分支，只接受 Pull Request 合并，禁止直接 push。
- `dev` 合并回 `main` 必须先开 PR，确认无误后再合并。
- 需要长期隔离的改动可以另开 `feature/*` 分支，同样向 `dev` 提 PR。

```bash
git checkout dev
git pull --rebase origin dev
# ...修改代码...
git add -A && git commit -m "说明"
git push origin dev
```

从 `dev` 向 `main` 发 PR：

```bash
gh pr create --base main --head dev --title "标题" --body "改动说明"
```

仓库设置里应为 `main` 开启分支保护（Require a pull request before merging），从远端层面挡住直接 push。

## 技术栈

- 前端：HTML、CSS、JavaScript
- 后端：Python、Flask

## 项目结构

```
Joe_Site/
├── static/        # 静态资源（CSS、图片等）
├── templates/     # 前端页面模板（HTML）
├── app.py         # Flask 应用主文件
└── README.md      # 项目说明
```

内容面板和弹窗共用 `static/css/global.css` 的 `.cyber-frame`。调整 `--window-opacity` 可改变底色的不透明度，调整 `--window-scanline` 可改变终端扫描线的颜色和强度。

## 快速开始

1. 安装依赖：
    ```bash
    pip install -r requirements.txt
    ```
2. 运行项目：
    ```bash
    python app.py 
    ```

    或者
    ```bash
    python wsgi.py 
    ```
3. 在浏览器访问 
- 主程序:`http://localhost:30069`
- wsgi:`http://localhost:5000`

## 功能介绍

- 角色立绘身后：立绘完全显现后，左侧蓝色柔光渐入，右侧同时错峰浮现蓝色光点并向右上角飘动、靠近角落时淡出。开启系统的「减少动态效果」后光点保持静止。
- 可以查看Joe的oc背景介绍
- 具备注册账号以及登陆的功能
- 用户可以上传头像以及自助添加友情链接
- 登陆后的用户可以在留言墙上留言
- 移动端首页左下角的梯形卡片集中展示五个站外链接，右侧的「探索小站」按钮打开站内导航。
- 「我的网盘」进入站内 `/cloud` 页面，共用小站的开屏动画。网盘域名需提供有效的 HTTPS 证书，并允许小站通过 iframe 嵌入。
- 更多功能有待开发

## GitHub 第三方登录

登录页已支持 GitHub OAuth，并会在登录成功后自动拉取 GitHub 头像保存到站内头像目录。部署前请在环境变量中配置：

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`，例如 `https://你的域名/oauth/github/callback`
- `GOOGLE_REDIRECT_URI`，例如 `https://你的域名/oauth/google/callback`
- `DISCORD_REDIRECT_URI`，例如 `https://你的域名/oauth/discord/callback`
- `TELEGRAM_REDIRECT_URI`，例如 `https://你的域名/oauth/telegram/callback`
- `MAIL_USERNAME` 和 `MAIL_PASSWORD` 仍然用于原有验证码注册流程

如果站点前面有 Nginx / 反向代理，请确保外层实际访问协议是 HTTPS，并正确转发 `X-Forwarded-Proto`，否则 Flask 可能会把外部回调地址生成成 `http`。

示例：

```bash
GITHUB_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REDIRECT_URI=https://example.com/oauth/github/callback
GOOGLE_REDIRECT_URI=https://example.com/oauth/google/callback
DISCORD_REDIRECT_URI=https://example.com/oauth/discord/callback
TELEGRAM_REDIRECT_URI=https://example.com/oauth/telegram/callback
MAIL_USERNAME=your_mail@qq.com
MAIL_PASSWORD=your_mail_app_password
```

如果你在本地调试，回调地址也可以先填 `http://127.0.0.1:30069/oauth/github/callback`，但第三方平台里登记的回调 URL 必须和实际请求地址完全一致。