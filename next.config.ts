import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // PDF and Word parsing libraries load their own workers/resources at runtime,
  // so they are required from node_modules instead of being bundled.
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: {
    serverActions: {
      // Document uploads go through a Server Action (files are capped at 4 MB).
      bodySizeLimit: "5mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
