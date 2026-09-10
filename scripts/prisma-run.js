require("dotenv").config();
const { spawn } = require("child_process");

if (!process.env.DATABASE_URL) {
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const user = encodeURIComponent(process.env.DB_USER || "postgres");
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5432";
  const name = process.env.DB_NAME || "datacrawler";
  const isSupabase =
    host.includes("supabase.co") || host.includes("pooler.supabase.com");
  const ssl =
    (process.env.DB_SSL === "true" || isSupabase) ? "&sslmode=require" : "";
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${name}?schema=public${ssl}`;
}

const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const isWin = process.platform === "win32";
const localBin = path.resolve(
  __dirname,
  `../node_modules/.bin/prisma${isWin ? ".cmd" : ""}`
);

const [cmd, cmdArgs] = fs.existsSync(localBin)
  ? [localBin, args]
  : [isWin ? "npx.cmd" : "npx", ["prisma", ...args]];

const child = spawn(cmd, cmdArgs, {
  stdio: "inherit",
  env: process.env,
  shell: isWin,
});

child.on("exit", (code) => process.exit(code ?? 1));

