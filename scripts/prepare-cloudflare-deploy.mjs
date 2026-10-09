import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME || "rijian-daily-notes";
const workerName = process.env.CLOUDFLARE_WORKER_NAME || "rijian-daily-notes";
const customDomain = process.env.CLOUDFLARE_CUSTOM_DOMAIN || "rijian.qingheye.top";

if (!databaseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)) {
  throw new Error("Set CLOUDFLARE_D1_DATABASE_ID to the UUID returned by wrangler d1 create.");
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(workerName)) {
  throw new Error("CLOUDFLARE_WORKER_NAME must contain lowercase letters, numbers, and hyphens.");
}
if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(customDomain)) {
  throw new Error("CLOUDFLARE_CUSTOM_DOMAIN must be a valid hostname.");
}

const serverDir = join(process.cwd(), "dist", "server");
const generated = JSON.parse(await readFile(join(serverDir, "wrangler.json"), "utf8"));
generated.name = workerName;
generated.topLevelName = workerName;
if (process.env.CLOUDFLARE_ACCOUNT_ID) generated.account_id = process.env.CLOUDFLARE_ACCOUNT_ID;
generated.secrets = { required: ["AUTH_PEPPER"] };
generated.d1_databases = [{
  binding: "DB",
  database_name: databaseName,
  database_id: databaseId,
  migrations_dir: "drizzle",
}];
generated.routes = [{ pattern: customDomain, custom_domain: true }];
generated.workers_dev = true;

const migrationDir = join(serverDir, "drizzle");
await mkdir(migrationDir, { recursive: true });
for (const name of await readdir(join(process.cwd(), "drizzle"))) {
  if (name.endsWith(".sql")) await copyFile(join(process.cwd(), "drizzle", name), join(migrationDir, name));
}

const output = join(serverDir, "wrangler.deploy.json");
await writeFile(output, `${JSON.stringify(generated, null, 2)}\n`);
console.log(`Prepared ${output} for Worker ${workerName}, D1 ${databaseName}, and ${customDomain}.`);
