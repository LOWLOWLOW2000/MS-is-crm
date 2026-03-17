const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/dashboard/sales-room/refinement', destination: '/sales-room/refinement', permanent: true },
      { source: '/dashboard/sales-room', destination: '/sales-room', permanent: true },
      { source: '/dashboard/inside-sales/refinement', destination: '/sales-room/refinement', permanent: true },
      { source: '/dashboard/inside-sales', destination: '/sales-room', permanent: true },
      { source: '/calling', destination: '/sales-room', permanent: true },
    ]
  },
};

module.exports = nextConfig;
