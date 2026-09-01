const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repo = 'web-portfolio';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    basePath: isGithubActions ? `/${repo}` : '',
    assetPrefix: isGithubActions ? `/${repo}/` : '',
    images: { unoptimized: true },
};

module.exports = nextConfig;
