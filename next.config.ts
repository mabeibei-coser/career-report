import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "puppeteer", "puppeteer-core"],
};

export default nextConfig;
