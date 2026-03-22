# Next.js 開発時トラブル（`missing required error components` 等）

## 1. プロセス確認（どのポートで何が動いているか）

Linux / WSL の例:

```bash
# 3000 / 3001 を LISTEN しているプロセス
ss -tlnp | grep -E ':3000|:3001'

# または
lsof -i :3000 -i :3001 2>/dev/null
```

`node` が **複数行**出ていれば、`next dev` の二重起動の可能性あり。**該当ターミナルで Ctrl+C**、または `kill <PID>`（自分のプロセスのみ）で止める。

## 2. `.next` の安全な削除

**開発サーバーを止めたあと**に実行する（起動中に消すと HMR が壊れやすい）。

```bash
cd apps/web
rm -rf .next
```

ルートから一発で Web だけクリーン起動:

```bash
cd /path/to/IS_01
npm run dev:web:clean
```

または `apps/web` で:

```bash
npm run dev:clean
```

## 3. 「Port 3000 is in use, trying 3001…」と 3003 で起動した場合

**すでに `npm run start:dev`（または別ターミナルの `next dev`）が動いている**ときに、さらに `npm run dev:web:clean` を実行すると、3000・3001 が埋まっているため **Next が 3002 → 3003… と空きポートへ逃げます**。

- **意図しない二重起動**です。`.env.local` の `NEXTAUTH_URL` は `http://localhost:3000` 想定のため、**http://localhost:3003 で開くと認証や API 連携がずれます**。

**正しい手順:**

1. いま動いている **`start:dev` / `next dev` を一度 Ctrl+C で止める**（該当ターミナル）。
2. そのあとでだけ `npm run dev:web:clean` または `npm run start:dev` を実行する。

**キャッシュだけ消して同じプロセスで立ち上げ直したい**ときは、**止めずに** `apps/web` 内で `rm -rf .next` だけするのは避け、**いったんサーバーを止めてから** `.next` 削除 → 再起動が安全。

## 4. 推奨: 単一の起動パターン

- **API + Web 同時**: リポジトリルートで `npm run start:dev` **だけ**（別ターミナルで `apps/web` の `npm run dev` を重ねない）。
- **Web のみ**: `cd apps/web && npm run dev` **だけ**。

## 5. `--turbo` について

`next dev --turbo` はビルドパイプラインが通常と異なるため、**同じ症状が出るか試す・出たら外す**程度の切り分けに使える。常時必須ではない。

## 6. 本件で実施したコード側の対策

- **空の `matcher: []` のみの `middleware.ts` は削除**（実質 no-op で、開発ランタイムの不整合要因になり得るため）。
