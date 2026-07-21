/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // wagmi's connector barrel transitively imports several optional packages
    // that we don't use with MetaMask / injected wallets and that don't resolve
    // in a browser build: Coinbase Base Account's `@x402/*` family, pino's
    // pretty-printer, lokijs, node's `encoding`, and React-Native async storage.
    // Stub them all so the production build is clean with zero module-not-found
    // noise. None are on any code path this app actually executes.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "pino-pretty": false,
      lokijs: false,
      encoding: false,
      "@react-native-async-storage/async-storage": false,
    };

    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};
export default nextConfig;
