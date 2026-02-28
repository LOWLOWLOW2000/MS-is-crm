/**
 * 開発サーバー起動ランチャー。
 * npm の実行ディレクトリ（npm_config_local_prefix）を基準に実行するため、
 * UNC パスで CMD の cwd が C:\Windows に落ちている場合でも動作する。
 */
const path = require('path');
const { execSync } = require('child_process');

const root = process.env.npm_config_local_prefix || process.cwd();
const rootPath = path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);

process.chdir(rootPath);

const run = (cmd) => {
  execSync(cmd, { stdio: 'inherit', cwd: rootPath, shell: true });
};

try {
  require(path.join(rootPath, 'scripts', 'print-restart-commands.js'));
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
}
run('npx concurrently -k -n api,web "npm run dev:api" "npm run dev:web"');
