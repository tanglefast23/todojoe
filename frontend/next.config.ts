import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images from logo services
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.parqet.com",
        pathname: "/logos/**",
      },
      {
        protocol: "https",
        hostname: "assets.coincap.io",
        pathname: "/assets/**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
        pathname: "/**",
      },
    ],
  },
  // Optimize package imports for better tree-shaking
  // This automatically transforms barrel imports to direct imports
  experimental: {
    optimizePackageImports: [
      // Icon libraries
      "lucide-react",
      "@radix-ui/react-icons",
      // Chart libraries
      "recharts",
      "lightweight-charts",
      // Grid layout
      "react-grid-layout",
      // Radix UI primitives (used via shadcn/ui)
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
};

export default nextConfig;
