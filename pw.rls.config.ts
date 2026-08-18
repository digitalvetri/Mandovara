import base from "./playwright.config";
export default { ...base, use: { ...base.use, baseURL: "http://localhost:3300" },
  webServer: { command: "./node_modules/.bin/next dev --port 3300", url: "http://localhost:3300",
    reuseExistingServer: false, timeout: 180_000,
    env: { ...process.env, APP_DATABASE_URL: "postgresql://mandovara_app:mandovara_app_local@localhost:15432/mandovara" } as Record<string,string> } };
