/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/shared"],
  optimizeFonts: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.INTERNAL_API_URL || "http://127.0.0.1:5000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
