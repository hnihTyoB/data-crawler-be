require('dotenv').config();
const { spawn } = require('child_process');

if (!process.env.DATABASE_URL) {
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const user = encodeURIComponent(process.env.DB_USER || 'postgres');
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'datacrawler';
  const isSupabase = host.includes('supabase.co') || host.includes('pooler.supabase.com');
  const ssl = process.env.DB_SSL === 'true' || isSupabase ? '&sslmode=require' : '';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${name}?schema=public${ssl}`;
}

const args = process.argv.slice(2);
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(cmd, ['prisma', ...args], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 1));
