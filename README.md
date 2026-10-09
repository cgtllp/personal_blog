# 日笺

一个按日期记录待办的小站。用户在本站注册账号，之后凭该账号和密码登录。身份验证由应用和 Cloudflare D1 完成，不使用 ChatGPT 或其他第三方登录。每个账号只能读取和修改自己的事项。任务标题后的“编辑明细”可打开该任务的独立 Markdown 页面，编辑、预览并保存完成过程。

## 本地运行

需要 Node.js 22.13 或更高版本。

```sh
npm ci
```

生成一个随机密钥，并写入项目根目录的 `.dev.vars`。不要提交该文件；若本地已有账号，不要覆盖旧密钥。

```sh
node -e 'const fs=require("node:fs"); const crypto=require("node:crypto"); fs.writeFileSync(".dev.vars", `AUTH_PEPPER=${crypto.randomBytes(32).toString("hex")}\n`, { flag: "wx", mode: 0o600 })'
```

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_flimsy_madame_web.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_red_morgan_stark.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_careless_brother_voodoo.sql
npm start
```

上述 SQL 只需对一个新的本地数据库各执行一次。已有本地数据库升级时只执行新增的 `0002` SQL。`npm start` 会把根目录的 `.dev.vars` 复制到构建预览的运行目录。改代码时用 `npm run dev` 开启热更新；两个模式共用 `.wrangler/state`。终端会打印本地访问地址，通常是 `http://127.0.0.1:5173/`（开发）或 `http://127.0.0.1:8787/`（构建预览）。

### 调试

- 日常开发：运行 `npm run dev`，在浏览器开发者工具的 Console 看前端报错，在 Network 查看 `/api/auth/*` 和 `/api/tasks` 的状态码与响应；服务端错误打印在运行命令的终端。
- 检查生产构建：修改代码后运行 `npm run build && npm start`。可用 `npm start -- --port 8792` 换端口。
- 检查类型、格式和构建：运行 `npm run lint`、`npx tsc --noEmit`、`npm run build`。
- 如果注册或登录返回 500，先核对 `.dev.vars` 是否有 `AUTH_PEPPER`、是否在项目根目录，并查看终端报错。如果任务接口返回 401，请先登录；若数据库还未初始化，按上面的顺序应用 SQL 文件。

## 部署到 Cloudflare Workers

先在自己的 Cloudflare 账号中用 Wrangler 创建 D1 数据库，记录返回的 UUID。构建后的 Worker 使用这个数据库，并需要单独设置 `AUTH_PEPPER` Secret；生产环境必须持续保留同一个值，否则现有密码无法验证。

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 create rijian-daily-notes
export CLOUDFLARE_D1_DATABASE_ID="上一步返回的 UUID"
# 如果 Wrangler 登录了多个账号，也设置 CLOUDFLARE_ACCOUNT_ID
npm run build
npm run prepare:cloudflare
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config dist/server/wrangler.deploy.json
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js secret put AUTH_PEPPER --config dist/server/wrangler.deploy.json
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.deploy.json
```

`secret put` 会交互式要求输入密钥。部署完成前设置好密钥，再开放站点注册。更新代码时重跑构建、准备配置、迁移和部署命令；不要重新创建数据库或更换密钥。默认将 Worker 绑定到 `rijian.qingheye.top`，并保留 `workers.dev` 访问地址；自定义域名需已在同一 Cloudflare 账号中激活。如需换域名，可设置 `CLOUDFLARE_CUSTOM_DOMAIN`。也可通过 `CLOUDFLARE_WORKER_NAME` 和 `CLOUDFLARE_D1_DATABASE_NAME` 修改默认名称。`dist/server/wrangler.deploy.json` 是生成文件，不提交到 Git。

原来用 ChatGPT 身份创建的任务保留在旧数据库中，无法仅凭新的账号密码自动判断它们属于谁。迁移这些任务需要先确认旧身份和新账号的对应关系。

## 账号规则

- 账号名为 3–32 位英文字母、数字或下划线，不区分大小写。
- 密码不能为空，没有最短长度要求。服务端保存加盐的密码派生值，登录会话保存在 D1，浏览器仅保存 HttpOnly Cookie。
- 目前没有邮箱或密码找回功能；请妥善保存账号、密码和部署密钥。

## 检查

```sh
npm run lint
npx tsc --noEmit
npm run build
```
