/**
 * POLARIS V1 acceptance checks — API + twin + experiment path (no browser).
 * Run: pnpm exec tsx apps/api/scripts/acceptance-v1.ts
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000";

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];
  const push = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  try {
    const health = await fetch(`${API}/health`).then((r) => r.json());
    push("API health", health.status === "ok", JSON.stringify(health.features ?? {}));
  } catch (e) {
    push("API health", false, e instanceof Error ? e.message : "unreachable");
    print(checks);
    process.exit(1);
  }

  const demos = await fetch(`${API}/v1/twin3d/demo-cities`).then((r) => r.json());
  push("Demo cities", Array.isArray(demos.items) && demos.items.some((c: { slug: string }) => c.slug === "monaco"), String(demos.items?.length));

  const open = await fetch(`${API}/v1/twin3d/open`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cityName: "Monaco" }),
  });
  const openBody = await open.json();
  push("Monaco open ready", open.status === 200 && !!openBody.scene, `status=${open.status} mode=${openBody.mode}`);

  if (!openBody.scene) {
    print(checks);
    process.exit(1);
  }

  const scene = openBody.scene;
  const layers = Object.fromEntries(scene.layers.map((l: { id: string; status: string; featureCount: number }) => [l.id, l]));
  push("Buildings layer", layers.buildings?.status === "ready" && layers.buildings.featureCount > 0, String(layers.buildings?.featureCount));
  push("Roads layer", layers.roads?.status === "ready" && layers.roads.featureCount > 0, String(layers.roads?.featureCount));
  push("POIs layer", layers.pois?.status === "ready" && layers.pois.featureCount > 0, String(layers.pois?.featureCount));
  push("Terrain", scene.terrain?.status === "ready", scene.terrain?.status ?? "missing");
  push("Camera over Monaco", scene.camera?.lat > 43.7 && scene.camera?.lon > 7.3, `${scene.camera?.lon},${scene.camera?.lat}`);

  const buildings = await fetch(
    `${API}/v1/twin3d/cities/${scene.citySlug}/file?path=${encodeURIComponent("layers/buildings.geojson")}`,
  );
  push("Buildings GeoJSON", buildings.ok, `http ${buildings.status}`);

  const searchHospital = await fetch(`${API}/v1/twin3d/cities/${scene.citySlug}/search?q=hospital`).then((r) =>
    r.json(),
  );
  push(
    "Search hospital",
    Array.isArray(searchHospital.items) && searchHospital.items.length > 0,
    String(searchHospital.items?.length ?? 0),
  );

  const searchAirport = await fetch(`${API}/v1/twin3d/cities/${scene.citySlug}/search?q=airport`).then((r) =>
    r.json(),
  );
  push(
    "Search airport",
    Array.isArray(searchAirport.items) && searchAirport.items.length > 0,
    String(searchAirport.items?.length ?? 0),
  );

  const catalog = await fetch(`${API}/v1/experiments/catalog`).then((r) => r.json());
  push(
    "Rainfall scenario catalog",
    Array.isArray(catalog.items) && catalog.items.some((i: { kind: string }) => i.kind === "heavy_rain"),
    String(catalog.items?.length),
  );

  const run = await fetch(`${API}/v1/experiments/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      citySlug: scene.citySlug,
      kind: "heavy_rain",
      parameters: { rainfall_scenario: "extreme", duration_h: 4 },
      epicenter: { lon: scene.camera.lon, lat: scene.camera.lat },
    }),
  });
  const runBody = await run.json();
  push("Experiment run", run.ok && !!runBody.result && !!runBody.decisionBrief, `http ${run.status}`);
  if (runBody.result) {
    push(
      "Timeline frames",
      Array.isArray(runBody.result.timeline) && runBody.result.timeline.length >= 5,
      String(runBody.result.timeline?.length),
    );
    push(
      "Affected entities",
      runBody.result.affectedEntities?.length > 0,
      String(runBody.result.affectedEntities?.length),
    );
    push(
      "Output layers",
      runBody.result.outputLayers?.length > 0,
      runBody.result.outputLayers?.map((l: { id: string }) => l.id).join(","),
    );
  }
  if (runBody.decisionBrief) {
    push(
      "Mission Intelligence brief",
      !!runBody.decisionBrief.executiveSummary && !!runBody.decisionBrief.strategies?.length,
      `priority=${runBody.decisionBrief.emergencyPriority} conf=${runBody.decisionBrief.confidence}`,
    );
    push(
      "Strategies A/B/C",
      runBody.decisionBrief.strategies?.length === 3,
      runBody.decisionBrief.strategies?.map((s: { id: string }) => s.id).join(""),
    );
  }

  print(checks);
  const failed = checks.filter((c) => !c.ok);
  process.exit(failed.length ? 1 : 0);
}

function print(checks: Check[]) {
  console.log("\nPOLARIS V1 Acceptance\n");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
  }
  const failed = checks.filter((x) => !x.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
