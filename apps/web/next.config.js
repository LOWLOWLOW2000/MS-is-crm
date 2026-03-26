const nextConfig = {
  reactStrictMode: true,
  /**
   * dev と build の `.next` 衝突で `/_next/static/*` が 404 になる問題を抑止する。
   * `npm run dev` / `npm run build` 側で `NEXT_DIST_DIR` を切り替える。
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  /**
   * dev 時に .next の一部が欠落して `/_next/static/*` が404になり「HTMLだけ」になる再発を抑止する。
   * WSL/ファイル監視/キャッシュ競合などで webpack の永続キャッシュが壊れるケースがあるため、
   * dev ではキャッシュを無効化して安定性を優先する。
   */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
  async redirects() {
    return [
      { source: '/dashboard/sales-room/refinement', destination: '/sales-room/refinement', permanent: true },
      { source: '/dashboard/sales-room', destination: '/sales-room', permanent: true },
      { source: '/dashboard/inside-sales/refinement', destination: '/sales-room/refinement', permanent: true },
      { source: '/dashboard/inside-sales', destination: '/sales-room', permanent: true },
      { source: '/calling', destination: '/sales-room', permanent: true },
      // (dashboard) グループは URL に出ないため、仕様どおり /dashboard/* で開けるよう実ルートへ転送
      { source: '/dashboard/kpi', destination: '/kpi', permanent: false },
      { source: '/dashboard/ai-daily', destination: '/ai-daily', permanent: false },
      { source: '/dashboard/corporate', destination: '/corporate', permanent: false },
      { source: '/dashboard/admin', destination: '/admin', permanent: false },
      { source: '/dashboard/teams', destination: '/teams', permanent: false },
      { source: '/dashboard/timecard-invoice', destination: '/timecard-invoice', permanent: false },
      { source: '/dashboard/attendance-payroll', destination: '/attendance-payroll', permanent: false },
      { source: '/dashboard/role-transfer', destination: '/role-transfer', permanent: false },
      { source: '/dashboard/list-distribution', destination: '/list-distribution', permanent: false },
      { source: '/dashboard/director', destination: '/director', permanent: false },
      { source: '/dashboard/director/:path*', destination: '/director/:path*', permanent: false },
    ]
  },
};

module.exports = nextConfig;
