const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repo = 'web-portfolio';
const basePath = isGithubActions ? `/${repo}` : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    basePath,
    assetPrefix: isGithubActions ? `/${repo}/` : '',
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

module.exports = nextConfig;
