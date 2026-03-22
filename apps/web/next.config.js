const nextConfig = {
  reactStrictMode: true,
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
