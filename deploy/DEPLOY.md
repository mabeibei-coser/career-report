# 腾讯云 CVM 部署指引

目标：在 Ubuntu 22.04 CVM 上用 Node.js + pm2 跑这个 Next.js 应用，`http://公网IP:3000` 访问。

---

## 一次性准备（新机器才做）

```bash
# 更新系统
apt update && apt upgrade -y

# 装 Node 20（Next.js 16 需要 Node 18+）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git build-essential

# 装中文字体 + Puppeteer 依赖的 system libs（PDF 导出会跑 headless Chromium）
apt install -y fonts-noto-cjk fonts-noto-cjk-extra \
  ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
  libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
  libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
  libxss1 libxtst6 lsb-release wget xdg-utils

# 全局装 pm2
npm install -g pm2

# 开机自启 pm2（生成 systemd 服务）
pm2 startup systemd
# 上面命令会输出一行让你执行的 sudo env ... 命令，复制执行一次即可
```

## 部署应用（首次）

```bash
# 拉代码
mkdir -p /var/www && cd /var/www
git clone https://github.com/mabeibei-coser/career-report.git
cd career-report
git checkout claude/sharp-lumiere-c98cc8

# 配置环境变量
cp deploy/env.production.example .env.production.local
vim .env.production.local   # 填入真实 DEEPSEEK_API_KEY

# 安装依赖 + 构建
npm ci
npm run build

# 建日志目录
mkdir -p logs

# pm2 启动
pm2 start ecosystem.config.js
pm2 save
```

验证：`curl -I http://127.0.0.1:3000` 应返回 200。

## 后续更新（代码改动后）

```bash
cd /var/www/career-report
git pull
npm ci              # 首次执行后 puppeteer 会下载 Chromium（~170MB）到 ~/.cache/puppeteer/
npm run build
pm2 restart career-report
```

**如果 `npm ci` 阶段 Chromium 下载失败**（国内网络不稳）：
```bash
# 跳过 postinstall，先装依赖
PUPPETEER_SKIP_DOWNLOAD=true npm ci
# 单独装 chromium（支持断点续传）
npx puppeteer browsers install chrome
npm run build
pm2 restart career-report
```

## 开放端口

腾讯云控制台 → 安全组 → 入站规则 → 放行 TCP:3000（或 80 / 443 如果用 nginx）。

## 可选：Nginx 反向代理 + HTTPS

```bash
apt install -y nginx
cp deploy/nginx.conf.example /etc/nginx/conf.d/career-report.conf
vim /etc/nginx/conf.d/career-report.conf   # 改 server_name 和 SSL 证书路径
nginx -t && systemctl reload nginx
```

SSL 证书：腾讯云控制台 → SSL 证书 → 免费申请 → 下载 Nginx 格式。

## 常用 pm2 命令

```bash
pm2 status              # 看进程状态
pm2 logs career-report  # 看日志
pm2 restart career-report
pm2 stop career-report
pm2 delete career-report
```

## 管理员后台初始化

首次部署完成后，初始化管理员密码和 session 密钥：

```bash
cd /var/www/career-report

# 运行初始化脚本（交互式，按提示输入密码）
node scripts/init-admin.mjs
```

脚本会输出两行内容，填入 `.env.production.local`：

```env
ADMIN_PASSWORD_HASH=<bcrypt hash 的 base64 编码，无 $ 号>
ADMIN_SESSION_PASSWORD=<随机 base64url 字符串>
```

**注意：**
- `ADMIN_PASSWORD_HASH` 是 bcrypt hash 的 base64 编码（脚本自动生成），不要手动填写原始 hash
- `ADMIN_SESSION_PASSWORD` 长度必须 ≥ 32 字符，否则 iron-session 会报错
- 修改环境变量后必须重启 pm2：`pm2 restart career-report`
- 数据目录权限：`chmod -R 750 /var/www/career-report/data`（防止 Nginx 直接访问）

**可选：Nginx 限制 /admin 路径仅内网访问**

在 `nginx.conf` 的 server 块中加：

```nginx
location /admin {
    allow 10.0.0.0/8;      # 内网 IP 段（按实际情况修改）
    allow 127.0.0.1;
    deny all;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
}
```

## 故障排查

- **启动失败**：`pm2 logs career-report --err` 看错误日志
- **端口被占**：`lsof -i:3000` 或 `ss -tlnp | grep 3000`
- **构建 OOM**（低配机器）：临时加 swap
  ```bash
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  ```
- **API 超时**：.env.production.local 里 DEEPSEEK_BASE_URL 配置正确？DeepSeek 账号余额？
- **管理员登录失败**：确认 `.env.production.local` 中 `ADMIN_PASSWORD_HASH` 和 `SESSION_SECRET` 已填，pm2 已重启
