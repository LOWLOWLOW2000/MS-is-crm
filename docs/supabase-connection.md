# Supabase 接続設定（IS-CRM）

## 接続文字列の場所

Supabase ダッシュボードで接続文字列を表示する方法です。

### 方法1: Connect ボタン（推奨）

1. プロジェクトのダッシュボードを開く
2. 画面上部または左サイドバー付近の **「Connect」** ボタンをクリック
3. 開いたパネルで **「URI」** または **「Connection string」** を選ぶ
4. **Direct connection**（直接接続）の文字列をコピー  
   形式: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
5. `[YOUR-PASSWORD]` を実際の **Database password** に置き換える  
   （パスワードは「Database Settings」の「Reset database password」の上に説明があるが、作成後は見れないので、知っているパスワードか、分からなければ「Reset password」で新パスワードを設定して使う）

### 方法2: Project Settings → Database

1. 左サイドバー下部の **歯車アイコン（Project Settings）** をクリック
2. **「Database」** タブを開く
3. 「Connection string」「Host」「Connection info」などの項目を確認  
   （UI によっては「Connect」で開くパネルと同じ内容がここにもある）

### 方法3: 手動で組み立てる

「Connection string」という項目がなくても、次の情報が分かれば URI を自分で作れます。

| 項目 | 値（あなたのプロジェクト） |
|------|----------------------------|
| Host | `db.tldhovlybkmpidjoxqzo.supabase.co` |
| Port | `5432`（直接接続） |
| User | `postgres` |
| Database | `postgres` |
| Password | 作成時またはリセットした「Database password」 |

**URI の形:**

```
postgresql://postgres:ここにパスワード@db.tldhovlybkmpidjoxqzo.supabase.co:5432/postgres
```

**apps/api/.env の例（SSL 必須・タイムアウト30秒）:**

```env
DATABASE_URL=postgresql://postgres:あなたのDBパスワード@db.tldhovlybkmpidjoxqzo.supabase.co:5432/postgres?sslmode=require&connect_timeout=30
```

- パスワードに `@` `#` `%` などが含まれる場合は、その文字を URL エンコードする（例: `@` → `%40`）
- パスワードを忘れた場合は、Database Settings の **「Reset password」** で新しいパスワードを設定し、その値で上記を組み立てる

## P1001「Can't reach database server」が出る場合

- **IPv6 で届かない環境**（WSL などで `nc` すると `Network is unreachable` になる場合）  
  → **Connect** から **「Session mode」**（プーラー）の URI をコピーし、`DATABASE_URL` にそのまま設定する。  
  プーラーは別ホスト（例: `aws-0-xx.pooler.supabase.com:6543`）で、IPv4 で接続できることが多い。
- **Banned IP**  
  Database Settings → **Network bans** で自 IP が BAN されていれば「Unban」。
- **プロジェクト停止**  
  Dashboard でプロジェクトが Paused なら「Restore」で再開。

## 接続確認

```bash
cd /home/mg_ogawa/SFA_MG-01/is-crm
npm run db:push
```

成功すればスキーマが Supabase に反映されます。続けて `npm run db:seed` でデモユーザーを投入できます。
