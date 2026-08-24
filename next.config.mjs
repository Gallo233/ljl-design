/** @type {import('next').NextConfig} */

/*
 * Subpath support, without the trap it used to carry.
 *
 * This used to read `GITHUB_ACTIONS === "true" ? "/joi-doorway" : ""`, from when the
 * site was published to GitHub Pages. It no longer is — `.github/workflows/deploy.yml`
 * SSHes into the box and builds there — so the branch never fired in production and
 * looked harmless. It was not: any build that happened to run inside a GitHub Action
 * would have silently prefixed every asset, route and image with `/joi-doorway`.
 *
 * The mechanism is worth keeping for a genuine subpath deploy, so it stays — driven by
 * an explicit variable that only someone deploying to a subpath would set.
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
