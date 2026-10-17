/**
 * Copy Cesium Assets/Workers/ThirdParty/Widgets into public/cesium for CESIUM_BASE_URL.
 */
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const cesiumPkg = dirname(require.resolve("cesium/package.json"));
const src = join(cesiumPkg, "Build", "Cesium");
const dest = join(webRoot, "public", "cesium");

if (!existsSync(src)) {
  console.warn("[copy-cesium] Cesium Build not found — run pnpm install in apps/web");
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const folder of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  cpSync(join(src, folder), join(dest, folder), { recursive: true });
}
console.log("[copy-cesium] Copied Cesium static assets → public/cesium");
