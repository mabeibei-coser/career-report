# career-report

AI 职业定位报告。面向**应届大学生**的校招定位工具：求职意向 + 简历（选填）→ 6 题 AI 快测 → 6 章节定位报告。

详细技术约束见 `CLAUDE.md`。

## 本机启动

```powershell
npm install
npm run dev
# 打开 http://localhost:3000
```

## 环境变量

复制 `.env.local.example` 为 `.env.local`，填 DeepSeek / 讯飞 / 火山等 API key（详见 CLAUDE.md「环境变量」节）。

## ⚠️ 关键约束

### data/ 目录不得放在云同步目录下

`data/` 里的 sqlite 文件（`career-report.db`）以及 WAL 模式产生的 `.db-wal`、`.db-shm`，**绝不可以**落到坚果云 / OneDrive / Dropbox 等云盘同步目录里。同步代理会持文件锁，破坏 WAL 一致性。

部署到腾讯云 Lighthouse 时，data/ 走绝对路径，落在 `/var/lib/...` 一类的本地盘目录。

### 管理后台已分离

career-report 当前**只服务终端用户的前台**。原来内嵌的管理后台（admin）已经切到独立项目 `../admin-hub/`：
- `app/admin/`、`app/api/admin/`、`components/admin/`、`lib/admin-session.ts` 等都不在这里了
- `admins / service_tracking / service_tracking_records` 三张表的 schema 由 admin-hub 拥有，**不要在 career-report 的 `lib/db.ts` 里加这些表的 init**——会触发 silent schema drift
- 如果需要后台功能，到 admin-hub :3001 / 生产环境 `<domain>/admin/`

## 测试

- 桌面端：`npm run test:e2e`
- 移动端：`npm run test:e2e:mobile`

## 部署

参考 `~/.claude/skills/gstack/tencent-deploy/SKILL.md` 或项目 CLAUDE.md 里的部署节。
