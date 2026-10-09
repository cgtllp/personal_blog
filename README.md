# 日笺

一个按日期记录待办的小站。用户在本站注册账号，之后凭该账号和密码登录。身份验证由应用和 Cloudflare D1 完成，不使用 ChatGPT 或其他第三方登录。每个账号只能读取和修改自己的事项。

## 本地运行

需要 Node.js 22.13 或更高版本。

```sh
npm ci
```

生成一个随机密钥，并写入项目根目录的 `.dev.vars`。文件格式为 `AUTH_PEPPER=<64 位十六进制值>`；不要提交该文件。可以用 `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'` 生成值。

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_flimsy_madame_web.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_red_morgan_stark.sql
npm start
```

上述两条 SQL 只需对一个新的本地数据库各执行一次。`npm run dev` 也可用于开发预览，它与构建预览共用 `.wrangler/state`。

## 部署到 Cloudflare Workers

先在自己的 Cloudflare 账号中用 Wrangler 创建 D1 数据库，记录返回的 UUID。构建后的 Worker 使用这个数据库，并需要单独设置 `AUTH_PEPPER` Secret；生产环境必须持续保留同一个值，否则现有密码无法验证。

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 create rijian-daily-notes
export CLOUDFLARE_D1_DATABASE_ID="上一步返回的 UUID"
npm run build
npm run prepare:cloudflare
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --remote --config dist/server/wrangler.deploy.json
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.deploy.json
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js secret put AUTH_PEPPER --config dist/server/wrangler.deploy.json
```

`secret put` 会交互式要求输入密钥。部署完成前设置好密钥，再开放站点注册。更新代码时重跑构建、准备配置、迁移和部署命令；不要重新创建数据库或更换密钥。可通过 `CLOUDFLARE_WORKER_NAME` 和 `CLOUDFLARE_D1_DATABASE_NAME` 修改默认名称。`dist/server/wrangler.deploy.json` 是生成文件，不提交到 Git。

原来用 ChatGPT 身份创建的任务保留在旧数据库中，无法仅凭新的账号密码自动判断它们属于谁。迁移这些任务需要先确认旧身份和新账号的对应关系。

## 账号规则

- 账号名为 3–32 位英文字母、数字或下划线，不区分大小写。
- 密码至少 15 位。服务端保存加盐的密码派生值，登录会话保存在 D1，浏览器仅保存 HttpOnly Cookie。
- 目前没有邮箱或密码找回功能；请妥善保存账号、密码和部署密钥。

## 检查

```sh
npm run lint
npx tsc --noEmit
npm run build
```
