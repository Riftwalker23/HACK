import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `cacheComponents` (a create-next-app default in Next 16) makes
   * `export const dynamic` / `runtime` a HARD BUILD ERROR, and this is an
   * API backend where every route must execute per request against the
   * database. Its opt-in caching model buys us nothing and cost 26 build
   * errors, so it is off deliberately — do not re-enable it without
   * stripping the route segment config from every handler under app/api.
   * `partialPrefetching` goes with it; it only applies to cached components.
   */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
