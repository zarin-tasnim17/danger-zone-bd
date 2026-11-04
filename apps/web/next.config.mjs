/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/shared"],
  optimizeFonts: false,
  async rewrites() {
    const rawTarget =
      process.env.INTERNAL_API_URL ||
      (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.startsWith("/")
        ? process.env.NEXT_PUBLIC_API_URL
        : "https://danger-zone-bd.onrender.com");
    const targetUrl = rawTarget.replace(/\/+$/, "").replace(/\/api\/v1$/, "");

    return [
      {
        source: "/api/v1/:path*",
        destination: `${targetUrl}/api/v1/:path*`,
      },
      {
        source: "/health/db",
        destination: `${targetUrl}/api/v1/health/db`,
      },
    ];
  },
};

export default nextConfig;
