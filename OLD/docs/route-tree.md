# ページルート ツリー図（app 配下）

一番トップ（Root Layout）から、うまくいっていない／要注意のルートを明示。

```
app/
├── layout.tsx                    ← Root（html, body, Providers, globals.css）
│
├── page.tsx                      → /              【TOP】TopHeader + ナビ + メイン + フッター（独自）
│
├── (auth)/                       ※ URL にセグメントなし
│   └── login/
│       └── page.tsx              → /login        ⚠ レイアウトなし（Root のみ）。ヘッダー・ナビ・フッターを自前実装
│
├── (dashboard)/                  ※ URL にセグメントなし
│   ├── layout.tsx                ← MockShell + article でラップ
│   ├── dashboard/
│   │   ├── page.tsx              → /dashboard
│   │   └── calendar/
│   │       └── page.tsx          → /dashboard/calendar
│   ├── kpi/
│   │   └── page.tsx              → /dashboard/kpi
│   ├── ai-daily/
│   │   └── page.tsx              → /dashboard/ai-daily
│   ├── corporate/
│   │   └── page.tsx              → /dashboard/corporate
│   ├── list-distribution/
│   │   └── page.tsx              → /dashboard/list-distribution
│   ├── role-transfer/
│   │   └── page.tsx              → /dashboard/role-transfer
│   └── director/
│       ├── page.tsx              → /dashboard/director
│       ├── kpi/
│       │   └── page.tsx          → /dashboard/director/kpi
│       ├── ai-report/
│       │   └── page.tsx          → /dashboard/director/ai-report
│       └── daily-box/
│           └── page.tsx          → /dashboard/director/daily-box
│
├── (ops)/                        ※ URL にセグメントなし
│   ├── layout.tsx                ← 運営用レイアウト（MockShell ではない：独自 header / OpsNav / footer）
│   ├── page.tsx                  → /ops
│   ├── members/
│   │   └── page.tsx              → /ops/members
│   ├── billing/
│   │   └── page.tsx              → /ops/billing
│   ├── audit/
│   │   └── page.tsx              → /ops/audit
│   ├── reports/
│   │   └── page.tsx              → /ops/reports
│   ├── scripts/
│   │   └── page.tsx              → /ops/scripts
│   ├── lists/
│   │   └── page.tsx              → /ops/lists
│   ├── settings/
│   │   └── page.tsx              → /ops/settings
│   └── ...
│
└── sales-room/
    ├── layout.tsx                ← Providers ＋スクロールロック（シェルは各 segment）
    ├── page.tsx                  → /sales-room（従来・MockShell）
    ├── v2/
    │   ├── layout.tsx            ← SalesRoomShell
    │   └── page.tsx              → /sales-room/v2（API コックピット）
    └── refinement/
        └── page.tsx              → /sales-room/refinement
```

---

## うまくいっていない／要注意のルート

| URL | 理由 |
|-----|------|
| **/login** | 親レイアウトが Root だけ。(auth) に layout がなく、ヘッダー・ナビ・フッターをページ内で自前実装。他と入れ子構造が揃っていない。 |
| **/sales-room** | `useSearchParams` 使用のため、Suspense でラップしないと真っ白になる。page → Suspense → SalesRoomContent に分離済み。 |
| **デザインが当たらない** | ルート単位ではなく、Tailwind の読込／.next の状態や実行環境（read-only 等）の可能性。全ルートで共通しうる。 |

---

## レイアウトの種類（どのルートがどのシェルか）

| レイアウト | 適用 URL | 入れ子 |
|------------|----------|--------|
| Root only | /, /login | html → body → Providers → 各 page |
| Root + (dashboard) layout | /dashboard, /dashboard/* | Root → MockShell → main → div → **article** → page |
| Root + sales-room layout | /sales-room, /sales-room/* | Root → MockShell(leftPanel) → main → div → **article** → page |
| Root + (ops) layout | /ops, /ops/* | Root → 運営用 header/nav/footer → main → **article** → page |

---

## ルートグループの意味

- **(auth)** … URL に出ない。`/login` のみ。
- **(dashboard)** … URL に出ない。`/dashboard`, `/dashboard/kpi` など。
- **(ops)** … URL に出ない。`/ops`, `/ops/members` など。
