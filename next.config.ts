import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Hosts the dev/prod server will accept. The preview environment proxies the
 * app under `*.{port}-*.e2b.app` style hosts, so we keep this permissive in
 * development and lock down in production via AUTH_URL / TRUSTED_ORIGINS.
 */
function buildAllowedOrigins(): string[] {
  const fromEnv = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ["*.e2b.app", "*.localhost", "localhost", ...fromEnv];
}

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bullmq", "@node-rs/argon2", "unpdf", "mammoth"],
  allowedDevOrigins: buildAllowedOrigins(),
  poweredByHeader: false,
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
                },
              ]),
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
