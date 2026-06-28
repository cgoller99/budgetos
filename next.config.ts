import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_COMMIT:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GITHUB_SHA ??
      "local-dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "budgetos.co" }],
        destination: "https://buxme.co/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.budgetos.co" }],
        destination: "https://buxme.co/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "budgetos-one.vercel.app" }],
        destination: "https://buxme.co/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
