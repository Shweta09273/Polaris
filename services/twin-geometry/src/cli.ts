#!/usr/bin/env node
import { buildDigitalTwin, DEMO_CITIES, rebudgetTwinCity } from "./index.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
if (args[0] === "rebudget") {
  const slug = args[1];
  if (!slug) {
    console.error("Usage: twin3d:city rebudget <monaco|amsterdam|singapore>");
    process.exit(1);
  }
  const m = rebudgetTwinCity(slug);
  console.log(
    JSON.stringify(
      {
        citySlug: m.citySlug,
        layers: m.layers.map((l) => ({ id: l.id, n: l.featureCount, status: l.status })),
        warnings: m.warnings.slice(-8),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const city = args.join(" ").replace(/^["']|["']$/g, "");
if (!city) {
  console.error(
    `Usage:\n  twin3d:city "<City>"\n  twin3d:city rebudget <slug>\nDemo: ${DEMO_CITIES.map((c) => c.displayName).join(", ")}`,
  );
  process.exit(1);
}

console.log(`Building Digital Twin for "${city}"…`);
const result = await buildDigitalTwin({
  cityName: city,
  onProgress: (e) => console.log(`[${e.percent}%] ${e.phase}: ${e.message}`),
});
console.log(
  JSON.stringify(
    {
      citySlug: result.citySlug,
      scenePath: result.scenePath,
      buildings: result.manifest.layers.find((l) => l.id === "buildings")?.featureCount,
      roads: result.manifest.layers.find((l) => l.id === "roads")?.featureCount,
      missing: result.manifest.missing,
      warnings: result.manifest.warnings,
    },
    null,
    2,
  ),
);
