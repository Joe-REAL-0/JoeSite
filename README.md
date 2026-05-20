# Joe_Site

这是我的个人网站项目，前端使用 HTML 和 CSS + JavaScript，从零开始开发，后端采用 Python 的 Flask 框架进行路由配置。

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

- 可以查看Joe的oc背景介绍
- 具备注册账号以及登陆的功能
- 用户可以上传头像以及自助添加友情链接
- 登陆后的用户可以在留言墙上留言
- 其中有五个个人链接
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