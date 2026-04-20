// PM2 配置：在腾讯云 CVM 上用 pm2 托管 Next.js 进程
// 启动：  pm2 start ecosystem.config.js
// 重启：  pm2 restart career-report
// 查日志： pm2 logs career-report
module.exports = {
  apps: [
    {
      name: "career-report",
      // 通过 next 的二进制入口启动，避免跨平台 `npm start` 的 shell 解析问题
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "800M",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // 真实密钥请放 .env.production.local，不要写进版本库
      },
      // 日志落在项目目录下，方便排查
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
