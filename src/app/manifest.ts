import type { MetadataRoute } from "next";

// Web App Manifest for the whole product, not just the field surface.
//
// The previous manifest lived at public/manifest.webmanifest, was scoped to
// "/m/" and was linked only from the mobile layout — so the office surface was
// not installable at all. It also declared 192x192 and 512x512 icons that
// pointed at a single 293x224 non-square PNG, which Chrome rejects outright,
// so the install prompt could never appear.
//
// Serving it from app/manifest.ts means Next injects <link rel="manifest">
// into every page automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mandovara Interior OS",
    short_name: "Mandovara",
    description:
      "Measure-to-install operating system for Mandovara — measurements, quotations, dye-lot stock, make, install and money.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B1020",
    theme_color: "#0F2A28",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable art sits inside the ~80% safe zone so Android's circle crop
      // does not clip the mark.
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the installed icon to jump straight to the field surfaces.
    shortcuts: [
      { name: "Measure a site", short_name: "Measure", url: "/measure" },
      { name: "Today's installs", short_name: "Install", url: "/install" },
      { name: "Mark attendance", short_name: "Attendance", url: "/m/attendance" },
    ],
  };
}
