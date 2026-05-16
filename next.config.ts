import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // maplibre-gl ships its worker as a separate file. Without transpiling
  // it, Turbopack's static analysis sometimes can't resolve the worker URL
  // and the map renders a blank canvas.
  transpilePackages: ["maplibre-gl"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default config;
