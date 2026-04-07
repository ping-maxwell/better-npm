import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX({
	// customise the config file path
	// configPath: "source.config.ts"
});

const nextConfig: NextConfig = {};

export default withMDX(nextConfig);
