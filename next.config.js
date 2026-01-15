/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile vosk-browser if it's installed (though we're using CDN approach)
  transpilePackages: ['vosk-browser'],
  webpack: (config, { isServer }) => {
    // Handle vosk-browser and other packages that may have special module formats
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig

