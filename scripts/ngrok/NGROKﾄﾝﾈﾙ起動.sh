#!/usr/bin/env bash
# NGROKﾄﾝﾈﾙ起動 — IS_01 の Web/API をいったん止めてから start:dev を立ち上げ、続けて ngrok http 3000 を前面で起動する

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

LOG_FILE="${TMPDIR:-/tmp}/is01-ngrok-dev.log"

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

wait_for_http() {
  local url="$1"
  local max="${2:-120}"
  local i=0
  while [ "$i" -lt "$max" ]; do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

echo "[NGROKﾄﾝﾈﾙ起動] 既存の ngrok http 3000 を停止します"
pkill -f 'ngrok http 3000' 2>/dev/null || true
sleep 1

echo "[NGROKﾄﾝﾈﾙ起動] Web(3000) / API(3001) を解放します（APP 関連の開発サーバー停止）"
kill_port 3000
kill_port 3001
sleep 2

echo "[NGROKﾄﾝﾈﾙ起動] npm run start:dev をバックグラウンドで起動 → $LOG_FILE"
: >"$LOG_FILE"
(
  npm run start:dev >>"$LOG_FILE" 2>&1
) &
DEV_BG_PID=$!

echo "[NGROKﾄﾝﾈﾙ起動] http://localhost:3000 が応答するまで待機（最大 120 秒）"
if ! wait_for_http "http://127.0.0.1:3000" 120; then
  echo "[NGROKﾄﾝﾈﾙ起動] エラー: 3000 が開きません。ログ末尾:"
  tail -n 80 "$LOG_FILE" || true
  kill "$DEV_BG_PID" 2>/dev/null || true
  exit 1
fi

echo "[NGROKﾄﾝﾈﾙ起動] ngrok http 3000 を起動します（止めるときは Ctrl+C。dev はバックグラウンドのまま）"
echo "[NGROKﾄﾝﾈﾙ起動] トンネル URL / リクエスト確認: http://127.0.0.1:4040"
exec ngrok http 3000
