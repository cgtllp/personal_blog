import { chmodSync, copyFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../.dev.vars", import.meta.url));
const destination = fileURLToPath(new URL("../dist/server/.dev.vars", import.meta.url));

let contents;
try {
  contents = readFileSync(source, "utf8");
} catch {
  throw new Error("Create .dev.vars in the project root with AUTH_PEPPER before running npm start.");
}

if (!/^AUTH_PEPPER=[a-f0-9]{64}$/im.test(contents)) {
  throw new Error(".dev.vars must contain AUTH_PEPPER followed by a 64-character hexadecimal value.");
}

copyFileSync(source, destination);
chmodSync(destination, 0o600);
