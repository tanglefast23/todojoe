import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JV To Do",
    short_name: "JV To Do",
    description: "Personal productivity hub - tasks, calendar, email, and more",
    start_url: "/calendar",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
