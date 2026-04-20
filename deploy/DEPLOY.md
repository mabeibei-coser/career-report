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
vim .env.production.local   # 填入真实 MINIMAX_API_KEY

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
npm ci
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

## 故障排查

- **启动失败**：`pm2 logs career-report --err` 看错误日志
- **端口被占**：`lsof -i:3000` 或 `ss -tlnp | grep 3000`
- **构建 OOM**（低配机器）：临时加 swap
  ```bash
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  ```
- **API 超时**：.env.production.local 里 MINIMAX_BASE_URL 配置正确？MiniMax 账号余额？
