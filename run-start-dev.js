/**
 * 開発サーバー起動ランチャー。
 * npm の実行ディレクトリ（npm_config_local_prefix）を基準に実行するため、
 * UNC パスで CMD の cwd が C:\Windows に落ちている場合でも動作する。
 */
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const root = process.env.npm_config_local_prefix || process.cwd();
const rootPath = path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);

process.chdir(rootPath);

// #region agent log
fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H2',location:'run-start-dev.js:cwd',message:'start:dev launcher cwd',data:{root,rootPath,cwd:process.cwd()},timestamp:Date.now()})}).catch(()=>{});
// #endregion

// dev 起動のたびに dev 側 distDir をクリーンにする（build との衝突防止・チャンク欠落で CSS が404になる再発防止）
try {
  const webNextDevDir = path.join(rootPath, 'apps/web/.next-dev')
  const webNextDir = path.join(rootPath, 'apps/web/.next')
  fs.rmSync(webNextDevDir, { recursive: true, force: true })
  // 念のための互換：以前の壊れた .next が残っていると悪さをすることがある
  fs.rmSync(webNextDir, { recursive: true, force: true })
} catch {
  // ignore
}

const run = (cmd) => {
  execSync(cmd, { stdio: 'inherit', cwd: rootPath, shell: true });
};

try {
  require(path.join(rootPath, 'scripts', 'print-restart-commands.js'));
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
}
run('npx concurrently -k -n api,web "npm run dev:api" "npm run dev:web"');
