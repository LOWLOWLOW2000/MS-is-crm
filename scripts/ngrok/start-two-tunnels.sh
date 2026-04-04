#!/usr/bin/env bash
# Web(3000) と API(3001) を ngrok で同時公開する（2 トンネル）
# 事前: npm run start:dev などで 3000/3001 が起動済みであること
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

GLOBAL_NGROK="${HOME}/.config/ngrok/ngrok.yml"
LOCAL_CFG="$(dirname "${BASH_SOURCE[0]}")/ngrok-two-tunnels.yml"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok が見つかりません。https://ngrok.com/docs/agent からインストールしてください。"
  exit 1
fi

if [[ ! -f "$LOCAL_CFG" ]]; then
  echo "設定が見つかりません: $LOCAL_CFG"
  exit 1
fi

CONFIG_ARGS=(--config "$LOCAL_CFG")
if [[ -f "$GLOBAL_NGROK" ]]; then
  CONFIG_ARGS=(--config "$GLOBAL_NGROK" --config "$LOCAL_CFG")
fi

echo "[ngrok 2 tunnels] is01-web → :3000 / is01-api → :3001"
echo "[ngrok 2 tunnels] ダッシュボード: http://127.0.0.1:4040"
echo "[ngrok 2 tunnels] 止める: Ctrl+C"
echo ""
echo "apps/web/.env に設定（表示された HTTPS URL に置き換え）:"
echo "  NEXTAUTH_URL=https://（Web の ngrok URL）"
echo "  API_BASE_URL=https://（API の ngrok URL）"
echo "  NEXT_PUBLIC_API_BASE_URL=https://（API の ngrok URL）"
echo ""
echo "apps/api の CORS: CORS_EXTRA_ORIGINS に Web の ngrok origin を追加"
echo ""

exec ngrok start "${CONFIG_ARGS[@]}" is01-web is01-api
