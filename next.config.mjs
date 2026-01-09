/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ❗ Permite construir aunque haya errores de TypeScript
    ignoreBuildErrors: true,
  },
  //eslint: {
    // Opcional, pero útil si ESLint también está rompiendo el build
   // ignoreDuringBuilds: true,
 // },
};

export default nextConfig;
