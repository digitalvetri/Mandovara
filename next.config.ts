import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@react-pdf/renderer", "canvas"],
  // Standalone output — copies just the files needed to run the server
  // into .next/standalone, so the production Docker image can be tiny
  // (no dev deps, no source, no unused node_modules). Required for
  // Coolify / any container deploy.
  output: "standalone",
  // Force the Prisma client + query engine binary into standalone
  // output. Next's static tracing misses these because they're loaded
  // via dynamic require from a pnpm hoist path that changes per env.
  // Without this, `.next/standalone` starts up and immediately crashes
  // with "Cannot find module '.prisma/client'".
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      // bcryptjs is bundled into the server actions and never referenced
      // as a package at runtime by app code — but the entrypoint's seed
      // script requires it via node's resolver. Include it explicitly so
      // it lands in /app/node_modules/bcryptjs/ inside the standalone tree.
      "./node_modules/bcryptjs/**/*",
      "./prisma/**/*",
      // prisma/seed/pending-stock.ts reads the origin dataset from
      // src/data. Tracing follows the APP's import graph, and the seed
      // is force-included by the glob above rather than discovered — so
      // its own out-of-tree import is not followed and the JSON would be
      // missing inside the container. Harmless today (the seed only runs
      // on an empty database) and a silent failure the first time it is
      // not.
      "./src/data/**/*",

      // ── @react-pdf and its whole dependency closure ────────────────
      //
      // Every quotation and invoice PDF 500'd in production while
      // working perfectly under `next dev`. The standalone server said:
      //
      //   Failed to load external module @react-pdf/renderer:
      //   Cannot find package '.../@react-pdf+textkit/node_modules/
      //   bidi-js/index.js'
      //
      // @react-pdf/renderer is in serverExternalPackages, so it is
      // required from node_modules at runtime rather than bundled.
      // Tracing then copied bidi-js's package.json and its CJS `main`
      // but dropped dist/bidi.mjs — the ESM entry @react-pdf/textkit
      // actually imports — leaving a package that exists on disk and
      // still cannot be resolved. The renderer failed to load at all,
      // which is why the route returned 500 even for an unknown share
      // token, where the handler's own code returns 404.
      //
      // Listed as whole package trees rather than the one missing file:
      // the same partial-copy can hit any of these, and a PDF route is
      // not the place to find out one release later. Verified by
      // running .next/standalone/server.js locally — `next dev` and
      // `next start` both resolve from the full node_modules and cannot
      // reproduce this.
      // NOTE: deliberately NOT globbing .pnpm/@react-pdf+*/** — those
      // directories contain symlinked scope folders that the copier
      // cannot recreate ("ENOENT: mkdir .../@react-pdf/types"). The
      // @react-pdf packages themselves trace correctly; it is their
      // plain leaf dependencies below that lose files.
      // The canonical store copies…
      "./node_modules/.pnpm/bidi-js@*/**/*",
      // …AND the nested paths the importers actually resolve through.
      // pnpm links a dependency into its dependent's own node_modules;
      // tracing flattens that symlink and copies only the files it
      // thinks are reachable, which left
      //   @react-pdf+textkit/node_modules/bidi-js/
      // as a real directory holding src/ and NOTHING else — no
      // package.json, so Node cannot resolve an entry point and looks
      // for index.js, which is the error above. Filling the store path
      // alone does not help: textkit resolves through this copy.
      // pnpm's hoisted store. @react-pdf/layout bundles its own copy of
      // textkit, and THAT one resolves bidi-js from
      // node_modules/.pnpm/node_modules/ — a third location for the same
      // package. Each nesting resolves through whichever copy is closest
      // to the importer, so all of them have to survive tracing.
      "./node_modules/.pnpm/node_modules/bidi-js/**/*",
      "./node_modules/.pnpm/node_modules/hyphen/**/*",
      "./node_modules/.pnpm/node_modules/unicode-properties/**/*",
      "./node_modules/.pnpm/node_modules/unicode-trie/**/*",
      "./node_modules/.pnpm/node_modules/fontkit/**/*",
      "./node_modules/.pnpm/node_modules/restructure/**/*",
      "./node_modules/.pnpm/node_modules/linebreak/**/*",
      "./node_modules/.pnpm/node_modules/dfa/**/*",
      "./node_modules/.pnpm/node_modules/png-js/**/*",
      "./node_modules/.pnpm/@react-pdf+textkit@*/node_modules/bidi-js/**/*",
      "./node_modules/.pnpm/@react-pdf+textkit@*/node_modules/hyphen/**/*",
      "./node_modules/.pnpm/@react-pdf+textkit@*/node_modules/unicode-properties/**/*",
      "./node_modules/.pnpm/@react-pdf+font@*/node_modules/**/*",
      "./node_modules/.pnpm/@react-pdf+pdfkit@*/node_modules/**/*",
      "./node_modules/.pnpm/@react-pdf+image@*/node_modules/**/*",
      "./node_modules/.pnpm/@react-pdf+layout@*/node_modules/**/*",
      "./node_modules/.pnpm/fontkit@*/**/*",
      "./node_modules/.pnpm/hyphen@*/**/*",
      "./node_modules/.pnpm/unicode-properties@*/**/*",
      "./node_modules/.pnpm/unicode-trie@*/**/*",
      "./node_modules/.pnpm/restructure@*/**/*",
      "./node_modules/.pnpm/linebreak@*/**/*",
      "./node_modules/.pnpm/dfa@*/**/*",
      "./node_modules/.pnpm/png-js@*/**/*",
      "./node_modules/.pnpm/media-engine@*/**/*",
      "./node_modules/.pnpm/queue@*/**/*",
      "./node_modules/.pnpm/abs-svg-path@*/**/*",
      "./node_modules/.pnpm/parse-svg-path@*/**/*",
      "./node_modules/.pnpm/svg-arc-to-cubic-bezier@*/**/*",
    ],
  },
  // typedRoutes disabled — friction outweighs value while modules are still
  // landing in placeholder form. Re-enable in Session 20+ when routes stabilise.
  typedRoutes: false,
  // Server actions default to a 1 MB request body — that's a hard block on
  // catalogue PDF uploads (typical brand catalogues are 5–100 MB). The
  // uploadCollectionPdf action itself refuses anything over 200 MB, so
  // 210 MB here matches with a small margin for multipart overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "210mb",
    },
  },
};

// Sentry build-time wrapper. Source-map upload only runs when
// SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT are all set (Coolify
// build env). Without them, withSentryConfig no-ops and next build proceeds
// unchanged. Runtime Sentry init lives in src/instrumentation{,-client}.ts.
const sentryEnabled = !!(
  process.env["SENTRY_AUTH_TOKEN"]
  && process.env["SENTRY_ORG"]
  && process.env["SENTRY_PROJECT"]
);

export default sentryEnabled
  ? withSentryConfig(config, {
      org:       process.env["SENTRY_ORG"]!,
      project:   process.env["SENTRY_PROJECT"]!,
      authToken: process.env["SENTRY_AUTH_TOKEN"]!,
      silent:            true,
      widenClientFileUpload: true,
      disableLogger:     true,
      tunnelRoute:       "/monitoring",
    })
  : config;
