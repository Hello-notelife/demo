# 明日讣告 · Tomorrow's Obituary

> **没有正确的选择，只有把选择变成正确！**

在项目真正失败前，先参加一次它的葬礼。

明日讣告是一个**商业预死亡推演（pre-mortem）沙盘**。你用三段大白话讲述自己的经历、想做的事、手里的真实资源；它用 DeepSeek 推演出这个项目**会怎么死、什么时候死、死于什么**，然后逼你在三个转折点里**只改一个决定**，重写结局。

它不算命，不打鸡血，也不承诺成功。它只做一件事：**把你还没看见的失败，提前搬到你面前。**

🔗 **在线体验：** https://mingri-fugao.leoluo862.workers.dev

---

## 为什么是"讣告"，不是"商业计划书"

商业计划书让你论证「为什么会成功」，于是你只会看见支持你的证据。
讣告让你论证「它已经死了，现在复盘死因」，于是盲区自己会跳出来。

这就是 pre-mortem：**先假设失败已经发生**，再倒推原因。心理学上，这一个动作能让人识别出的风险数量提升约 30%。

---

## 五幕流程

| # | 场景 | 你在做什么 |
|---|------|-----------|
| 01 | **讲述** | 说三段真话：你的经历、你想做的事、你手里真实的钱和人 |
| 02 | **讣告** | 看到完整讣告 + **三条未来线**（最坏/基准/最好），每条带触发条件和概率 |
| 03 | **盲区** | 敲开三块问号砖：谁真的付钱、渠道能否重复、验证够不够快 |
| 04 | **抉择** | 拿到**一枚**回溯币——只能改一个决定 |
| 05 | **新未来** | 结局被重写，收在一张**行动契约**（任务／截止／成功判据／停止条件） |

闭环：行动契约到期后，「带着这个起点再推演」会把上一轮的选择和任务带进下一轮的输入，
让每一次推演都从上一次的结果开始，而不是从零开始。

### 四种死法（Hazard Codex）

| ID | 名称 | 含义 |
|----|------|------|
| `demand` | 伪需求沼泽 | 有人试用，但没有人真的掏钱 |
| `channel` | 罗列利弊 | 一直在纸上比较选项，迟迟没把选择变成结果 |
| `cash` | 现金深坑 | 验证速度跑不过现金消耗 |
| `founder` | 创始人火山 | 所有关键动作都压在一个人身上 |

---

## 技术架构

全栈跑在 Cloudflare 边缘上，**没有 mock，没有假数据**——AI 推演与数据持久化都是真实链路。

```
浏览器 (原生 JS，零框架)
   │  fetch /api/*
   ▼
Cloudflare Worker  ── worker/index.mjs
   ├── 匿名会话鉴权（token → SHA-256 存储）
   ├── 速率限制（D1 滑动窗口）
   ├── server/deepseek.mjs ──► DeepSeek API（JSON 模式）
   │                      └──► Tavily API（实时行业证据，可选）
   ├── server/contracts.mjs ── 严格校验 / 归一化模型输出
   └── worker/store.mjs ────► Cloudflare D1（会话、推演、金币、连续天数）
```

| 层 | 选型 |
|----|------|
| 前端 | 原生 JS + Canvas 像素精灵，无构建步骤、无框架 |
| 运行时 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| LLM | DeepSeek `deepseek-v4-flash`（推演） / `deepseek-v4-pro`（重写） |
| 检索 | Tavily（`search_depth: advanced`，为推演提供实时行业证据） |

### 设计要点

- **契约优先**：`server/contracts.mjs` 对模型输出做强制校验——4 个 hazard、5 个时间线节点、3 个盲区、3 个转折点，ID 固定。不合格就重试，再不合格就报错，绝不把半成品塞给 UI。
- **优雅降级**：DeepSeek 不可用（没配密钥／超时／限流）时，自动回落到 `src/engine.js` 的离线规则引擎，产品**永远可用**，界面上会明确标注 `OFFLINE SIMULATION` 还是 `DEEPSEEK SIMULATION`。
- **提示词注入防护**：用户输入被明确标记为不可信数据，系统提示要求模型忽略其中任何指令。
- **无需登录**：匿名会话 + 本地 localStorage，服务端只存推演结果，不存身份。

---

## 本地运行

```bash
npm install
```

创建 `.dev.vars`（已被 `.gitignore` 忽略）：

```
DEEPSEEK_API_KEY=你的密钥
TAVILY_API_KEY=你的密钥
```

初始化本地数据库并启动：

```bash
npm run db:migrate:local
npm run dev
```

打开 http://localhost:8787

### 常用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 构建 + 本地 Worker（含本地 D1） |
| `npm test` | 运行 DeepSeek 契约测试 |
| `npm run check` | 全部源文件语法检查 |
| `npm run db:migrate:local` | 应用迁移到本地 D1 |
| `npm run db:migrate:remote` | 应用迁移到线上 D1 |
| `npm run deploy` | 构建并部署到 Cloudflare |

---

## 部署

```bash
npx wrangler d1 create mingri-fugao      # 把返回的 database_id 写入 wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put TAVILY_API_KEY
npm run deploy
```

密钥通过 `wrangler secret` 存储，**永远不会进入代码仓库**。

用 `/api/health` 确认状态：

```json
{ "status": "ok", "configured": true, "database": true, "liveEvidence": true }
```

- `configured: true` → DeepSeek 已接通
- `database: true` → D1 已接通
- `liveEvidence: true` → Tavily 已接通

---

## 项目结构

```
index.html              入口
src/
  app.js                状态机、路由、云端编排（AI ↔ 离线回落）
  ui.js                 全部界面渲染
  engine.js             离线规则推演引擎（降级方案）
  api.js                Worker API 客户端 + AI/离线结果合并
  sprites.js            Canvas 像素精灵
  data.js               预设案例 + 安全词过滤
  sfx.js                音效
worker/
  index.mjs             API 路由、鉴权、限流
  store.mjs             D1 数据访问
server/
  deepseek.mjs          DeepSeek + Tavily 调用
  contracts.mjs         模型输出校验与归一化
  deepseek.test.mjs     契约测试
migrations/             D1 迁移
```

---

## API

所有接口都需要匿名会话（`POST /api/session` 获取，随后带 `Authorization: Bearer <token>` 和 `X-Mingri-Session: <id>`）。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 运行时状态 |
| `POST` | `/api/session` | 创建匿名会话 |
| `GET` | `/api/state` | 读取账户与历史推演 |
| `PATCH` | `/api/state` | 更新偏好（momo语气） |
| `POST` | `/api/simulate` | 生成讣告推演 |
| `POST` | `/api/rewrite` | 基于选定转折点重写未来 |

---

## 边界

明日讣告**不提供**法律、医疗或投资收益建议，不预测具体财务回报，也不保证任何结果。它输出的是**保守的失败假设和可验证的下一步**——判断永远是你自己的。

没有正确的选择，只有把选择变成正确！
