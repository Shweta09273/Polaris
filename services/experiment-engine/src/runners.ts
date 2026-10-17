/**
 * Modular experiment runners — each scenario: Inputs → Spatial → Infrastructure → Risk → Outputs → Metrics.
 * No fabricated entities. All IDs come from twin GeoJSON.
 */

import { randomUUID } from "node:crypto";
import type { Feature } from "geojson";
import { getScenario } from "./catalog.js";
import {
  COST_ASSUMPTION,
  POPULATION_ASSUMPTION,
  circlePolygon,
  economicImpactEur,
  featureCentroid,
  featuresToCollection,
  haversineM,
  populationProxy,
  prop,
  sampleHeight,
  toAffected,
  withinRadius,
} from "./spatial.js";
import type {
  AffectedEntity,
  DataSourceUsed,
  ExperimentKind,
  ExperimentResult,
  OutputLayer,
  RiskEdge,
  RunExperimentRequest,
  TimelineFrame,
  TwinFeatureIndex,
} from "./types.js";

function num(params: Record<string, number | string | boolean>, key: string, fallback: number): number {
  const v = params[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function bool(params: Record<string, number | string | boolean>, key: string, fallback: boolean): boolean {
  const v = params[key];
  if (typeof v === "boolean") return v;
  return fallback;
}

function mergeDefaults(
  kind: ExperimentKind,
  incoming?: Readonly<Record<string, number | string | boolean>>,
): Record<string, number | string | boolean> {
  const scenario = getScenario(kind);
  const out: Record<string, number | string | boolean> = {};
  for (const p of scenario.parameters) out[p.key] = p.default;
  if (incoming) {
    for (const [k, v] of Object.entries(incoming)) out[k] = v;
  }
  return out;
}

function dataSources(twin: TwinFeatureIndex): DataSourceUsed[] {
  const counts: Record<string, number> = {
    buildings: twin.buildings.length,
    roads: twin.roads.length,
    pois: twin.pois.length,
    vegetation: twin.vegetation.length,
    water: twin.water.length,
    terrain: twin.heightmap ? twin.heightmap.heights.length : 0,
  };
  return Object.entries(counts).map(([layer, featureCount]) => {
    const meta = twin.scene.layers.find((l) => l.id === layer);
    const status =
      featureCount === 0
        ? ("missing" as const)
        : meta?.status === "partial"
          ? ("partial" as const)
          : ("ready" as const);
    const note = meta?.note;
    return note ? { layer, featureCount, status, note } : { layer, featureCount, status };
  });
}

function pointsLayer(entities: AffectedEntity[], layerId: string, label: string): OutputLayer {
  return {
    id: layerId,
    label,
    kind: "point",
    featureCount: entities.length,
    geojson: {
      type: "FeatureCollection",
      features: entities.map((e) => ({
        type: "Feature",
        id: e.id,
        properties: {
          id: e.id,
          name: e.name,
          kind: e.kind,
          severity: e.severity,
          reason: e.reason,
        },
        geometry: { type: "Point", coordinates: [e.lon, e.lat] },
      })),
    },
  };
}

function linesFromRoads(
  hits: Array<{ feature: Feature; index: number }>,
  layerId: string,
  label: string,
): OutputLayer {
  const features = hits.map(({ feature, index }) => ({
    ...feature,
    properties: {
      ...(feature.properties ?? {}),
      experiment_layer: layerId,
      closed: true,
      source_index: index,
    },
  }));
  return {
    id: layerId,
    label,
    kind: "line",
    featureCount: features.length,
    geojson: featuresToCollection(features),
  };
}

function baseTimeline(
  duringSummary: string,
  afterSummary: string,
  duringMetrics: Record<string, number>,
  afterMetrics: Record<string, number>,
  durationH: number,
): TimelineFrame[] {
  return [
    {
      phase: "before",
      label: "Before",
      tMinutes: 0,
      summary: "Baseline twin state — no experiment effects applied.",
      intensityFactor: 0,
      metricDeltas: {},
    },
    {
      phase: "during",
      label: "Peak",
      tMinutes: Math.round(durationH * 30),
      summary: duringSummary,
      intensityFactor: 1,
      metricDeltas: duringMetrics,
    },
    {
      phase: "after",
      label: "Recovery",
      tMinutes: Math.round(durationH * 60),
      summary: afterSummary,
      intensityFactor: 0.35,
      metricDeltas: afterMetrics,
    },
  ];
}

const RAIN_SCENARIO_INTENSITY: Record<string, number> = {
  normal: 25,
  heavy: 60,
  extreme: 120,
  cloudburst: 180,
};

function resolveRainIntensity(params: Record<string, number | string | boolean>): number {
  // Operator intensity_mm_hr always wins when present (UI sends it on every run).
  // Prior logic ignored values that matched other scenario presets (e.g. 60/180),
  // producing identical experiment outputs when intensity changed.
  if (params.intensity_mm_hr != null && params.intensity_mm_hr !== "") {
    const intensity = num(params, "intensity_mm_hr", NaN);
    if (Number.isFinite(intensity)) return intensity;
  }
  const scenario = String(params.rainfall_scenario ?? "extreme");
  return RAIN_SCENARIO_INTENSITY[scenario] ?? 120;
}

function approximateSlopePct(
  hm: NonNullable<TwinFeatureIndex["heightmap"]>,
  lon: number,
  lat: number,
): number | null {
  const h0 = sampleHeight(hm, lon, lat);
  const h1 = sampleHeight(hm, lon + 0.0003, lat);
  const h2 = sampleHeight(hm, lon, lat + 0.0003);
  if (h0 == null || h1 == null || h2 == null) return null;
  const dx = haversineM(lon, lat, lon + 0.0003, lat) || 1;
  const dy = haversineM(lon, lat, lon, lat + 0.0003) || 1;
  const gx = (h1 - h0) / dx;
  const gy = (h2 - h0) / dy;
  return Math.min(80, Math.sqrt(gx * gx + gy * gy) * 100);
}

function runHeavyRain(
  twin: TwinFeatureIndex,
  params: Record<string, number | string | boolean>,
  epicenter: { lon: number; lat: number },
): Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status"> {
  const scenarioKey = String(params.rainfall_scenario ?? "extreme");
  const intensity = resolveRainIntensity(params);
  const durationH = num(params, "duration_h", 4);
  const elevThr = num(params, "low_elevation_threshold_m", 25);
  const windMs = num(params, "wind_ms", 0);
  const windDir = num(params, "wind_dir_deg", 180);
  // Documented: base radius scales with intensity (10→60 m, 220→620 m)
  let radiusM = Math.round(60 + (intensity - 10) * (560 / 210));
  // Documented: longer storms expand impact zone (sqrt scale, capped) — duration must change outputs
  const durationScale = Math.sqrt(Math.max(0.5, Math.min(durationH, 12)) / 4);
  radiusM = Math.round(radiusM * durationScale);
  // Optional explicit override — catalog default 0 means auto (intensity × duration)
  const radiusOverride = num(params, "impact_radius_m", 0);
  if (radiusOverride >= 50) radiusM = Math.round(radiusOverride);
  if (windMs > 0) {
    // Documented: +1.5 m radius per m/s wind (elongation proxy, not CFD)
    radiusM += Math.round(windMs * 1.5);
  }

  // Wind offset of analysis center (downwind of FROM direction)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const downwindBearing = (windDir + 180) % 360;
  const offsetM = windMs > 0 ? Math.min(120, windMs * 2) : 0;
  const center = {
    lon:
      epicenter.lon +
      (offsetM / 111_320) * Math.sin(toRad(downwindBearing)) / Math.cos(toRad(epicenter.lat)),
    lat: epicenter.lat + (offsetM / 110_540) * Math.cos(toRad(downwindBearing)),
  };

  const nearBuildings = withinRadius(twin.buildings, center.lon, center.lat, radiusM);
  const affectedBuildings: AffectedEntity[] = [];
  let lowElevCount = 0;
  let slopeSum = 0;
  let slopeN = 0;
  for (const { feature, dist, index } of nearBuildings) {
    const c = featureCentroid(feature)!;
    const elev = twin.heightmap ? sampleHeight(twin.heightmap, c.lon, c.lat) : null;
    const slope = twin.heightmap ? approximateSlopePct(twin.heightmap, c.lon, c.lat) : null;
    if (slope != null) {
      slopeSum += slope;
      slopeN += 1;
    }
    const low = elev != null && elev <= elevThr;
    if (low) lowElevCount += 1;
    const severity = low
      ? dist < radiusM * 0.35
        ? "critical"
        : "high"
      : dist < radiusM * 0.45
        ? "medium"
        : "low";
    const slopeNote = slope != null ? `; slope≈${slope.toFixed(1)}%` : "";
    const ent = toAffected(
      feature,
      "buildings",
      "building",
      severity,
      elev != null
        ? `Rain impact ${Math.round(dist)} m; DEM ${elev.toFixed(1)} m ${low ? "≤" : ">"}${elevThr} m${slopeNote}`
        : `Rain impact ${Math.round(dist)} m; DEM unavailable${slopeNote}`,
      index,
    );
    if (ent) affectedBuildings.push(ent);
  }

  const nearRoads = withinRadius(twin.roads, center.lon, center.lat, radiusM);
  const affectedRoads: AffectedEntity[] = [];
  for (const { feature, dist, index } of nearRoads) {
    const ent = toAffected(
      feature,
      "roads",
      "road",
      dist < radiusM * 0.35 ? "high" : "medium",
      `Road midpoint in rainfall impact (${Math.round(dist)} m)`,
      index,
    );
    if (ent) affectedRoads.push(ent);
  }

  const hospitals = twin.pois.filter((p) => String(prop(p, "kind")) === "hospital");
  const schools = twin.pois.filter((p) => String(prop(p, "kind")) === "school");
  const criticalKinds = new Set(["hospital", "school", "airport", "railway_station"]);
  const hospitalRisk: AffectedEntity[] = [];
  const schoolRisk: AffectedEntity[] = [];
  const criticalPois: AffectedEntity[] = [];

  for (const [i, h] of hospitals.entries()) {
    const c = featureCentroid(h);
    if (!c) continue;
    const roadHit = affectedRoads.some((r) => haversineM(r.lon, r.lat, c.lon, c.lat) < 180);
    if (roadHit || haversineM(center.lon, center.lat, c.lon, c.lat) <= radiusM) {
      const ent = toAffected(
        h,
        "pois",
        "hospital",
        "critical",
        roadHit
          ? "Hospital access risk — approach roads in rainfall impact zone"
          : "Hospital inside rainfall impact zone",
        i,
      );
      if (ent) {
        hospitalRisk.push(ent);
        criticalPois.push(ent);
      }
    }
  }
  for (const [i, s] of schools.entries()) {
    const c = featureCentroid(s);
    if (!c) continue;
    if (haversineM(center.lon, center.lat, c.lon, c.lat) > radiusM) continue;
    const ent = toAffected(
      s,
      "pois",
      "school",
      "high",
      `School inside rainfall impact zone (${Math.round(haversineM(center.lon, center.lat, c.lon, c.lat))} m)`,
      i,
    );
    if (ent) {
      schoolRisk.push(ent);
      criticalPois.push(ent);
    }
  }
  for (const [i, p] of twin.pois.entries()) {
    const kind = String(prop(p, "kind") ?? "");
    if (!criticalKinds.has(kind) || kind === "hospital" || kind === "school") continue;
    const c = featureCentroid(p);
    if (!c) continue;
    if (haversineM(center.lon, center.lat, c.lon, c.lat) > radiusM) continue;
    const ent = toAffected(p, "pois", kind, "high", `Critical POI in rainfall impact zone`, i);
    if (ent) criticalPois.push(ent);
  }

  // Risk heatmap grid from DEM (accumulation probability proxy — NOT hydro model)
  const heatFeatures: import("geojson").Feature[] = [];
  if (twin.heightmap) {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const lon = center.lon + ((i / steps) * 2 - 1) * (radiusM / 111_320);
        const lat =
          center.lat +
          ((j / steps) * 2 - 1) * (radiusM / 110_540);
        if (haversineM(center.lon, center.lat, lon, lat) > radiusM) continue;
        const elev = sampleHeight(twin.heightmap, lon, lat);
        if (elev == null) continue;
        const slope = approximateSlopePct(twin.heightmap, lon, lat) ?? 5;
        // Low elev + low slope → higher accumulation probability proxy
        const elevFactor = Math.max(0, Math.min(1, (elevThr + 15 - elev) / (elevThr + 15)));
        const slopeFactor = Math.max(0, Math.min(1, 1 - slope / 40));
        const score = Number((0.65 * elevFactor + 0.35 * slopeFactor).toFixed(3));
        if (score < 0.25) continue;
        heatFeatures.push({
          type: "Feature",
          properties: {
            kind: "accumulation_proxy",
            score,
            elev_m: elev,
            slope_pct: slope,
            note: "Documented DEM low-elevation × low-slope proxy — not hydrodynamic inundation depth",
          },
          geometry: { type: "Point", coordinates: [lon, lat] },
        });
      }
    }
  }

  const roadAccessIndex = Math.max(
    0,
    Math.min(100, Math.round(100 - (affectedRoads.length / Math.max(1, twin.roads.length)) * 1000)),
  );
  const emergencyDelay = Math.round(
    4 + affectedRoads.length * 0.15 + hospitalRisk.length * 3 + intensity * 0.02,
  );

  const all = [...affectedBuildings, ...affectedRoads, ...hospitalRisk, ...schoolRisk];
  const metrics = {
    rain_intensity_mm_hr: intensity,
    duration_h: durationH,
    wind_ms: windMs,
    flood_radius_m: radiusM,
    buildings_affected: affectedBuildings.length,
    buildings_low_elevation: lowElevCount,
    roads_affected: affectedRoads.length,
    hospitals_access_risk: hospitalRisk.length,
    schools_exposure: schoolRisk.length,
    critical_poi_exposure: criticalPois.length,
    population_proxy: populationProxy(affectedBuildings.length),
    emergency_delay_proxy_min: emergencyDelay,
    road_accessibility_index: roadAccessIndex,
    mean_slope_proxy_pct: slopeN ? Number((slopeSum / slopeN).toFixed(2)) : -1,
    economic_impact_eur: economicImpactEur({
      buildings: affectedBuildings.length,
      roads: affectedRoads.length,
      criticalPois: criticalPois.length,
    }),
  };

  const riskPropagation: RiskEdge[] = [
    {
      from: "rainfall_impact",
      to: "road_accessibility",
      mechanism: "Road midpoints inside rainfall impact radius",
      entityIds: affectedRoads.slice(0, 40).map((e) => e.id),
    },
    {
      from: "road_accessibility",
      to: "hospital_access",
      mechanism: "Approach roads ≤180 m of hospital POIs intersect impact set",
      entityIds: hospitalRisk.map((e) => e.id),
    },
    {
      from: "low_elevation_buildings",
      to: "population_exposure_proxy",
      mechanism: "Low-elevation building count × documented occupancy factor",
      entityIds: affectedBuildings.filter((e) => e.severity === "critical" || e.severity === "high").slice(0, 40).map((e) => e.id),
    },
  ];

  const warnings: string[] = [
    "NOT a scientific hydrodynamic flood model — digital experiment on twin geometry + DEM proxies.",
  ];
  if (!twin.heightmap) warnings.push("Terrain DEM missing — elevation/slope/accumulation proxies skipped.");
  if (!twin.water.length) warnings.push("Water bodies layer missing — no hydro network routing.");
  if (windMs > 0) warnings.push("Wind uses documented radius/center offset proxy — not atmospheric CFD.");

  const peakBuildings = affectedBuildings.length;
  const peakRoads = affectedRoads.length;
  const timeline: TimelineFrame[] = [
    {
      phase: "before",
      label: "Before",
      tMinutes: 0,
      summary: `Baseline ${twin.scene.cityDisplayName} twin — no rainfall effects applied.`,
      intensityFactor: 0,
      metricDeltas: {},
    },
    {
      phase: "during",
      label: "30 minutes",
      tMinutes: 30,
      summary: `Onset — ~${Math.round(peakBuildings * 0.35)} buildings / ${Math.round(peakRoads * 0.3)} roads entering impact.`,
      intensityFactor: 0.35,
      metricDeltas: {
        buildings_affected: Math.round(peakBuildings * 0.35),
        roads_affected: Math.round(peakRoads * 0.3),
      },
    },
    {
      phase: "during",
      label: "1 hour",
      tMinutes: 60,
      summary: `Building — intensity ${intensity} mm/h (${scenarioKey}); accessibility degrading.`,
      intensityFactor: 0.55,
      metricDeltas: {
        buildings_affected: Math.round(peakBuildings * 0.55),
        roads_affected: Math.round(peakRoads * 0.5),
        hospitals_access_risk: Math.max(0, hospitalRisk.length - 1),
      },
    },
    {
      phase: "during",
      label: "2 hours",
      tMinutes: 120,
      summary: `Near-peak — low-elevation exposure ${lowElevCount}; emergency delay proxy ~${emergencyDelay} min.`,
      intensityFactor: 0.85,
      metricDeltas: {
        buildings_affected: Math.round(peakBuildings * 0.85),
        roads_affected: Math.round(peakRoads * 0.85),
        hospitals_access_risk: hospitalRisk.length,
      },
    },
    {
      phase: "during",
      label: "4 hours",
      tMinutes: 240,
      summary: `Peak frame — ${peakBuildings} buildings, ${peakRoads} roads, ${hospitalRisk.length} hospitals at access risk.`,
      intensityFactor: 1,
      metricDeltas: metrics,
    },
    {
      phase: "after",
      label: "Recovery",
      tMinutes: Math.max(300, Math.round(durationH * 60) + 60),
      summary: `Recovery — residual disruption ~45% buildings / 30% roads; hospital watch continues.`,
      intensityFactor: 0.4,
      metricDeltas: {
        buildings_affected: Math.round(peakBuildings * 0.45),
        roads_affected: Math.round(peakRoads * 0.3),
        hospitals_access_risk: hospitalRisk.length,
      },
    },
  ];

  const outputLayers = [
    {
      id: "flood_zone",
      label: "Rainfall impact zone",
      kind: "polygon" as const,
      featureCount: 1,
      geojson: circlePolygon(center.lon, center.lat, radiusM),
    },
    {
      id: "risk_heatmap",
      label: "Accumulation probability proxy",
      kind: "heatmap" as const,
      featureCount: heatFeatures.length,
      geojson: { type: "FeatureCollection" as const, features: heatFeatures },
    },
    pointsLayer(affectedBuildings, "flooded_buildings", "Affected buildings"),
    linesFromRoads(nearRoads, "flooded_roads", "Affected roads"),
    pointsLayer(hospitalRisk, "hospital_access_risk", "Hospital access risk"),
    pointsLayer(schoolRisk, "school_exposure", "School exposure"),
    pointsLayer(
      criticalPois.filter((e) => e.kind !== "hospital" && e.kind !== "school"),
      "critical_facilities",
      "Other critical facilities",
    ),
  ];

  return {
    kind: "heavy_rain",
    citySlug: twin.scene.citySlug,
    cityDisplayName: twin.scene.cityDisplayName,
    parameters: { ...params, intensity_mm_hr: intensity, rainfall_scenario: scenarioKey },
    assumptions: [
      POPULATION_ASSUMPTION,
      COST_ASSUMPTION,
      "NOT hydrodynamic physics — spatial digital experiment on twin layers.",
      `Scenario '${scenarioKey}' → intensity ${intensity} mm/h (catalog mapping / operator override).`,
      radiusOverride >= 50
        ? `Impact radius_m = operator override ${radiusM} m.`
        : `Impact radius_m = [60+(intensity−10)×(560/210)] × √(duration_h/4)` +
          (windMs > 0 ? ` + wind×1.5 (wind_ms=${windMs})` : "") +
          ` → ${radiusM} m.`,
      `Low-elevation = DEM ≤ ${elevThr} m. Accumulation heatmap = low elev × low slope proxy.`,
      "emergency_delay_proxy_min = 4 + 0.15×roads + 3×hospitals + 0.02×intensity (documented heuristic).",
      "Ontology mapping: Building, RoadSegment, Hospital, School from OSM twin layers.",
    ],
    dataSources: dataSources(twin),
    affectedEntities: all,
    metrics,
    outputLayers,
    riskPropagation,
    warnings,
    timeline,
    epicenter: center,
  };
}

function runRoadClosure(
  twin: TwinFeatureIndex,
  params: Record<string, number | string | boolean>,
  epicenter: { lon: number; lat: number },
): Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status"> {
  const radiusM = num(params, "radius_m", 200);
  const preferPrimary = bool(params, "prefer_primary", true);
  let hits = withinRadius(twin.roads, epicenter.lon, epicenter.lat, radiusM);
  if (preferPrimary) {
    const primary = hits.filter(({ feature }) => {
      const hw = String(prop(feature, "highway") ?? "");
      return ["motorway", "trunk", "primary", "secondary"].includes(hw);
    });
    if (primary.length) hits = primary;
  }

  const closed: AffectedEntity[] = [];
  for (const { feature, dist, index } of hits) {
    const ent = toAffected(
      feature,
      "roads",
      "road",
      "high",
      `Road closed — midpoint ${Math.round(dist)} m from epicenter (radius ${radiusM} m)`,
      index,
    );
    if (ent) closed.push(ent);
  }

  const hospitals = twin.pois.filter((p) => String(prop(p, "kind")) === "hospital");
  const hospitalRisk: AffectedEntity[] = [];
  for (const [i, h] of hospitals.entries()) {
    const c = featureCentroid(h);
    if (!c) continue;
    if (closed.some((r) => haversineM(r.lon, r.lat, c.lon, c.lat) < 150)) {
      const ent = toAffected(
        h,
        "pois",
        "hospital",
        "critical",
        "Hospital within 150 m of a closed road segment",
        i,
      );
      if (ent) hospitalRisk.push(ent);
    }
  }

  const metrics = {
    closure_radius_m: radiusM,
    roads_closed: closed.length,
    hospitals_isolated_risk: hospitalRisk.length,
    detour_pressure: closed.length * Math.max(1, hospitalRisk.length),
    economic_impact_eur: economicImpactEur({ roads: closed.length, criticalPois: hospitalRisk.length }),
  };

  return {
    kind: "road_closure",
    citySlug: twin.scene.citySlug,
    cityDisplayName: twin.scene.cityDisplayName,
    parameters: params,
    assumptions: [
      COST_ASSUMPTION,
      "Closure set = road features whose centroid/midpoint falls inside radius (OSM road geometries from twin).",
      preferPrimary
        ? "prefer_primary=true — if any primary/trunk/motorway/secondary exist in radius, only those close."
        : "prefer_primary=false — all road classes in radius close.",
    ],
    dataSources: dataSources(twin),
    affectedEntities: [...closed, ...hospitalRisk],
    metrics,
    outputLayers: [
      {
        id: "closure_zone",
        label: "Closure zone",
        kind: "polygon",
        featureCount: 1,
        geojson: circlePolygon(epicenter.lon, epicenter.lat, radiusM),
      },
      linesFromRoads(hits, "closed_roads", "Closed roads"),
      pointsLayer(hospitalRisk, "hospital_access_risk", "Hospital access risk"),
    ],
    riskPropagation: [
      {
        from: "road_closure",
        to: "hospital_access",
        mechanism: "Spatial proximity ≤150 m between closed road and hospital POI",
        entityIds: hospitalRisk.map((e) => e.id),
      },
    ],
    warnings: twin.roads.length === 0 ? ["Roads layer empty — cannot close roads."] : [],
    timeline: baseTimeline(
      `${closed.length} roads closed within ${radiusM} m.`,
      `Access risk remains for ${hospitalRisk.length} hospitals until reopen.`,
      metrics,
      { roads_closed: 0, hospitals_isolated_risk: hospitalRisk.length },
      2,
    ),
    epicenter,
  };
}

function runBuildingFire(
  twin: TwinFeatureIndex,
  params: Record<string, number | string | boolean>,
  epicenter: { lon: number; lat: number },
): Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status"> {
  const exposureR = num(params, "exposure_radius_m", 60);
  const nearest = withinRadius(twin.buildings, epicenter.lon, epicenter.lat, 80).sort(
    (a, b) => a.dist - b.dist,
  );
  const ignitionHit = nearest[0];
  const ignition: AffectedEntity[] = [];
  if (ignitionHit) {
    const ent = toAffected(
      ignitionHit.feature,
      "buildings",
      "building",
      "critical",
      `Ignition building — nearest OSM footprint to epicenter (${Math.round(ignitionHit.dist)} m)`,
      ignitionHit.index,
    );
    if (ent) ignition.push(ent);
  }

  const ign = ignition[0];
  const center = ign ? { lon: ign.lon, lat: ign.lat } : epicenter;
  const exposureHits = withinRadius(twin.buildings, center.lon, center.lat, exposureR).filter(
    (h) => !ign || featureCentroid(h.feature)?.lon !== ign.lon,
  );
  const exposure: AffectedEntity[] = [];
  for (const { feature, dist, index } of exposureHits) {
    if (ign && String(prop(feature, "id") ?? feature.id) === ign.id) continue;
    const ent = toAffected(
      feature,
      "buildings",
      "building",
      dist < exposureR * 0.5 ? "high" : "medium",
      `Thermal exposure — ${Math.round(dist)} m from ignition (radius ${exposureR} m)`,
      index,
    );
    if (ent) exposure.push(ent);
  }

  const roadHits = withinRadius(twin.roads, center.lon, center.lat, Math.max(40, exposureR * 0.8));
  const roadsBlocked: AffectedEntity[] = [];
  for (const { feature, dist, index } of roadHits) {
    const ent = toAffected(
      feature,
      "roads",
      "road",
      "high",
      `Emergency perimeter — road ${Math.round(dist)} m from ignition`,
      index,
    );
    if (ent) roadsBlocked.push(ent);
  }

  const metrics = {
    exposure_radius_m: exposureR,
    ignition_buildings: ignition.length,
    exposure_buildings: exposure.length,
    roads_blocked: roadsBlocked.length,
    population_proxy: populationProxy(ignition.length + exposure.length),
    economic_impact_eur: economicImpactEur({
      buildings: ignition.length + exposure.length,
      roads: roadsBlocked.length,
    }),
  };

  const warnings: string[] = [];
  if (!ignition.length) warnings.push("No building footprint within 80 m of epicenter — exposure-only analysis.");

  return {
    kind: "building_fire",
    citySlug: twin.scene.citySlug,
    cityDisplayName: twin.scene.cityDisplayName,
    parameters: params,
    assumptions: [
      POPULATION_ASSUMPTION,
      COST_ASSUMPTION,
      "Ignition = nearest OSM building footprint to epicenter (≤80 m). No synthetic building created.",
      `Exposure = other twin buildings within ${exposureR} m of ignition centroid.`,
    ],
    dataSources: dataSources(twin),
    affectedEntities: [...ignition, ...exposure, ...roadsBlocked],
    metrics,
    outputLayers: [
      {
        id: "fire_zone",
        label: "Fire exposure zone",
        kind: "polygon",
        featureCount: 1,
        geojson: circlePolygon(center.lon, center.lat, exposureR),
      },
      pointsLayer([...ignition, ...exposure], "fire_buildings", "Ignition + exposure buildings"),
      linesFromRoads(roadHits, "fire_perimeter_roads", "Perimeter roads"),
    ],
    riskPropagation: [
      {
        from: "building_fire",
        to: "road_block",
        mechanism: "Emergency perimeter on roads near ignition",
        entityIds: roadsBlocked.slice(0, 30).map((e) => e.id),
      },
    ],
    warnings,
    timeline: baseTimeline(
      `Active fire — ignition ${ignition.length}, exposure ${exposure.length}.`,
      `Contained — residual road blocks ${Math.round(roadsBlocked.length * 0.4)}.`,
      metrics,
      { ignition_buildings: 0, exposure_buildings: Math.round(exposure.length * 0.2) },
      1.5,
    ),
    epicenter: center,
  };
}

function runPowerFailure(
  twin: TwinFeatureIndex,
  params: Record<string, number | string | boolean>,
  epicenter: { lon: number; lat: number },
): Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status"> {
  const radiusM = num(params, "radius_m", 400);
  const bHits = withinRadius(twin.buildings, epicenter.lon, epicenter.lat, radiusM);
  const buildings: AffectedEntity[] = [];
  for (const { feature, dist, index } of bHits) {
    const ent = toAffected(
      feature,
      "buildings",
      "building",
      dist < radiusM * 0.4 ? "high" : "medium",
      `Inside outage polygon (${Math.round(dist)} m) — power graph absent; spatial proxy`,
      index,
    );
    if (ent) buildings.push(ent);
  }

  const criticalKinds = new Set(["hospital", "school", "airport", "railway_station"]);
  const critical: AffectedEntity[] = [];
  for (const [i, p] of twin.pois.entries()) {
    const kind = String(prop(p, "kind") ?? "poi");
    if (!criticalKinds.has(kind)) continue;
    const c = featureCentroid(p);
    if (!c) continue;
    const dist = haversineM(epicenter.lon, epicenter.lat, c.lon, c.lat);
    if (dist > radiusM) continue;
    const ent = toAffected(
      p,
      "pois",
      kind,
      kind === "hospital" ? "critical" : "high",
      `Critical POI inside outage radius (${Math.round(dist)} m)`,
      i,
    );
    if (ent) critical.push(ent);
  }

  const metrics = {
    outage_radius_m: radiusM,
    buildings_without_power: buildings.length,
    critical_pois_affected: critical.length,
    population_proxy: populationProxy(buildings.length),
    economic_impact_eur: economicImpactEur({
      buildings: buildings.length,
      criticalPois: critical.length,
    }),
  };

  return {
    kind: "power_failure",
    citySlug: twin.scene.citySlug,
    cityDisplayName: twin.scene.cityDisplayName,
    parameters: params,
    assumptions: [
      POPULATION_ASSUMPTION,
      COST_ASSUMPTION,
      "ASSUMPTION: Twin has no PowerLine/Substation layer — outage is a circular spatial proxy, not network topology.",
      "Critical POIs = hospital, school, airport, railway_station from OSM POI layer.",
    ],
    dataSources: dataSources(twin),
    affectedEntities: [...buildings, ...critical],
    metrics,
    outputLayers: [
      {
        id: "outage_zone",
        label: "Power outage zone (spatial proxy)",
        kind: "polygon",
        featureCount: 1,
        geojson: circlePolygon(epicenter.lon, epicenter.lat, radiusM),
      },
      pointsLayer(buildings.slice(0, 2000), "unpowered_buildings", "Buildings without power"),
      pointsLayer(critical, "critical_pois_outage", "Critical POIs affected"),
    ],
    riskPropagation: [
      {
        from: "power_failure",
        to: "hospital_ops",
        mechanism: "Hospitals inside outage polygon lose grid power (backup unknown — not in twin)",
        entityIds: critical.filter((e) => e.kind === "hospital").map((e) => e.id),
      },
    ],
    warnings: [
      "Power network geometry not present in Digital Twin — results use spatial outage proxy only.",
    ],
    timeline: baseTimeline(
      `Outage active — ${buildings.length} buildings, ${critical.length} critical POIs.`,
      "Partial restoration assumed for non-critical loads; critical POIs still prioritized.",
      metrics,
      { buildings_without_power: Math.round(buildings.length * 0.25) },
      4,
    ),
    epicenter,
  };
}

function runMedicalEmergency(
  twin: TwinFeatureIndex,
  params: Record<string, number | string | boolean>,
  epicenter: { lon: number; lat: number },
): Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status"> {
  const casualties = num(params, "casualty_estimate", 25);
  const searchR = num(params, "hospital_search_radius_m", 2000);
  const hospitals = twin.pois.filter((p) => String(prop(p, "kind")) === "hospital");
  const ranked = hospitals
    .map((feature, index) => {
      const c = featureCentroid(feature);
      if (!c) return null;
      return { feature, index, dist: haversineM(epicenter.lon, epicenter.lat, c.lon, c.lat), c };
    })
    .filter((x): x is NonNullable<typeof x> => x != null && x.dist <= searchR)
    .sort((a, b) => a.dist - b.dist);

  const hospitalEntities: AffectedEntity[] = [];
  for (const h of ranked) {
    const ent = toAffected(
      h.feature,
      "pois",
      "hospital",
      h.dist === ranked[0]?.dist ? "critical" : "high",
      `Hospital candidate — ${Math.round(h.dist)} m from incident (search ≤${searchR} m)`,
      h.index,
    );
    if (ent) hospitalEntities.push(ent);
  }

  const approachRoads = ranked[0]
    ? withinRadius(twin.roads, ranked[0].c.lon, ranked[0].c.lat, 120)
    : [];
  const roadEntities: AffectedEntity[] = [];
  for (const { feature, dist, index } of approachRoads) {
    const ent = toAffected(
      feature,
      "roads",
      "road",
      "medium",
      `Approach road to nearest hospital (${Math.round(dist)} m from hospital)`,
      index,
    );
    if (ent) roadEntities.push(ent);
  }

  const nearestM = ranked[0]?.dist ?? -1;
  const metrics = {
    casualty_estimate: casualties,
    incident_severity: casualties >= 50 ? 3 : casualties >= 15 ? 2 : 1,
    nearest_hospital_m: nearestM,
    hospitals_in_range: hospitalEntities.length,
    approach_roads: roadEntities.length,
    population_proxy: casualties,
  };

  const warnings: string[] = [];
  if (!hospitalEntities.length) {
    warnings.push(`No hospital POIs within ${searchR} m of epicenter in twin search-index/POI layer.`);
  }
  warnings.push("casualty_estimate is an operator input — not derived from twin population data.");

  return {
    kind: "medical_emergency",
    citySlug: twin.scene.citySlug,
    cityDisplayName: twin.scene.cityDisplayName,
    parameters: params,
    assumptions: [
      "casualty_estimate is operator-supplied input (explicit experiment parameter).",
      "Hospital candidates = OSM amenity=hospital POIs in twin layer.",
      "Approach roads = twin road features within 120 m of nearest hospital centroid.",
    ],
    dataSources: dataSources(twin),
    affectedEntities: [...hospitalEntities, ...roadEntities],
    metrics,
    outputLayers: [
      {
        id: "incident_zone",
        label: "Incident locus",
        kind: "polygon",
        featureCount: 1,
        geojson: circlePolygon(epicenter.lon, epicenter.lat, 80),
      },
      pointsLayer(hospitalEntities, "candidate_hospitals", "Candidate hospitals"),
      linesFromRoads(approachRoads, "approach_roads", "Approach roads"),
    ],
    riskPropagation: [
      {
        from: "medical_emergency",
        to: "hospital_capacity",
        mechanism: "Incident demand routed to nearest in-range hospital POIs",
        entityIds: hospitalEntities.map((e) => e.id),
      },
    ],
    warnings,
    timeline: baseTimeline(
      `Incident active — ${casualties} casualties; ${hospitalEntities.length} hospitals in range.`,
      "Transport complete — monitor hospital load (capacity unknown in twin).",
      metrics,
      { casualty_estimate: 0 },
      1,
    ),
    epicenter,
  };
}

function runExtremeHeat(
  twin: TwinFeatureIndex,
  params: Record<string, number | string | boolean>,
  epicenter: { lon: number; lat: number },
): Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status"> {
  const tempC = num(params, "temperature_c", 40);
  const clusterR = num(params, "cluster_radius_m", 80);
  const minN = num(params, "min_neighbours", 8);
  // Focus analysis near epicenter for performance (sample window)
  const windowR = 600;
  const localBuildings = withinRadius(twin.buildings, epicenter.lon, epicenter.lat, windowR);
  const dense: AffectedEntity[] = [];
  for (const { feature, index } of localBuildings) {
    const c = featureCentroid(feature);
    if (!c) continue;
    const neighbours = withinRadius(twin.buildings, c.lon, c.lat, clusterR).length - 1;
    if (neighbours >= minN) {
      const ent = toAffected(
        feature,
        "buildings",
        "building",
        tempC >= 42 ? "high" : "medium",
        `Dense cluster — ${neighbours} neighbours within ${clusterR} m (heat ${tempC}°C)`,
        index,
      );
      if (ent) dense.push(ent);
    }
  }

  const vulnerableKinds = new Set(["hospital", "school"]);
  const vulnerable: AffectedEntity[] = [];
  for (const [i, p] of twin.pois.entries()) {
    const kind = String(prop(p, "kind") ?? "");
    if (!vulnerableKinds.has(kind)) continue;
    const c = featureCentroid(p);
    if (!c) continue;
    if (haversineM(epicenter.lon, epicenter.lat, c.lon, c.lat) > windowR) continue;
    const ent = toAffected(
      p,
      "pois",
      kind,
      "critical",
      `Vulnerable facility under extreme heat (${tempC}°C)`,
      i,
    );
    if (ent) vulnerable.push(ent);
  }

  const vegNear = withinRadius(twin.vegetation, epicenter.lon, epicenter.lat, windowR);

  const metrics = {
    heat_index_c: tempC,
    analysis_window_m: windowR,
    dense_cluster_buildings: dense.length,
    vulnerable_pois: vulnerable.length,
    vegetation_relief_nearby: vegNear.length,
    population_proxy: populationProxy(dense.length),
    economic_impact_eur: economicImpactEur({
      buildings: dense.length,
      criticalPois: vulnerable.length,
    }),
  };

  return {
    kind: "extreme_heat",
    citySlug: twin.scene.citySlug,
    cityDisplayName: twin.scene.cityDisplayName,
    parameters: params,
    assumptions: [
      POPULATION_ASSUMPTION,
      COST_ASSUMPTION,
      `Heat analysis limited to ${windowR} m window around epicenter for performance — not city-wide.`,
      `Dense = ≥${minN} neighbouring buildings within ${clusterR} m (OSM footprints).`,
      "heat_index_c uses operator temperature input as proxy (no humidity sensor feed in twin).",
    ],
    dataSources: dataSources(twin),
    affectedEntities: [...dense, ...vulnerable],
    metrics,
    outputLayers: [
      {
        id: "heat_window",
        label: "Heat analysis window",
        kind: "polygon",
        featureCount: 1,
        geojson: circlePolygon(epicenter.lon, epicenter.lat, windowR),
      },
      pointsLayer(dense, "heat_dense_buildings", "Dense heat-risk buildings"),
      pointsLayer(vulnerable, "heat_vulnerable_pois", "Vulnerable facilities"),
    ],
    riskPropagation: [
      {
        from: "extreme_heat",
        to: "vulnerable_facilities",
        mechanism: "Schools/hospitals inside analysis window under high temperature input",
        entityIds: vulnerable.map((e) => e.id),
      },
    ],
    warnings:
      vegNear.length === 0
        ? ["No vegetation polygons in analysis window — cooling relief not quantified."]
        : [],
    timeline: baseTimeline(
      `Peak heat ${tempC}°C — ${dense.length} dense buildings, ${vulnerable.length} vulnerable POIs.`,
      "Evening cooling — residual risk at critical facilities.",
      metrics,
      { dense_cluster_buildings: Math.round(dense.length * 0.3) },
      8,
    ),
    epicenter,
  };
}

function runWaterPipeline(
  twin: TwinFeatureIndex,
  params: Record<string, number | string | boolean>,
  epicenter: { lon: number; lat: number },
): Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status"> {
  const radiusM = num(params, "radius_m", 120);
  const bHits = withinRadius(twin.buildings, epicenter.lon, epicenter.lat, radiusM);
  const buildings: AffectedEntity[] = [];
  for (const { feature, dist, index } of bHits) {
    const ent = toAffected(
      feature,
      "buildings",
      "building",
      dist < radiusM * 0.4 ? "high" : "medium",
      `Service loss / local flooding proxy — ${Math.round(dist)} m from burst`,
      index,
    );
    if (ent) buildings.push(ent);
  }
  const rHits = withinRadius(twin.roads, epicenter.lon, epicenter.lat, radiusM);
  const roads: AffectedEntity[] = [];
  for (const { feature, dist, index } of rHits) {
    const ent = toAffected(
      feature,
      "roads",
      "road",
      "high",
      `Road in pipeline impact zone (${Math.round(dist)} m)`,
      index,
    );
    if (ent) roads.push(ent);
  }

  const metrics = {
    burst_radius_m: radiusM,
    buildings_service_loss: buildings.length,
    roads_flooded: roads.length,
    population_proxy: populationProxy(buildings.length),
    economic_impact_eur: economicImpactEur({ buildings: buildings.length, roads: roads.length }),
  };

  return {
    kind: "water_pipeline_failure",
    citySlug: twin.scene.citySlug,
    cityDisplayName: twin.scene.cityDisplayName,
    parameters: params,
    assumptions: [
      POPULATION_ASSUMPTION,
      COST_ASSUMPTION,
      "ASSUMPTION: No water utility graph in twin — failure modelled as circular impact around epicenter.",
      "Water body layer (if present) is not used as pipe network.",
    ],
    dataSources: dataSources(twin),
    affectedEntities: [...buildings, ...roads],
    metrics,
    outputLayers: [
      {
        id: "pipeline_impact",
        label: "Pipeline failure impact zone",
        kind: "polygon",
        featureCount: 1,
        geojson: circlePolygon(epicenter.lon, epicenter.lat, radiusM),
      },
      pointsLayer(buildings, "service_loss_buildings", "Buildings with service loss"),
      linesFromRoads(rHits, "flooded_roads", "Roads in impact zone"),
    ],
    riskPropagation: [
      {
        from: "water_pipeline_failure",
        to: "road_disruption",
        mechanism: "Surface water / repair perimeter intersects road midpoints",
        entityIds: roads.slice(0, 40).map((e) => e.id),
      },
    ],
    warnings: [
      "Water pipeline network not in Digital Twin — spatial proxy only.",
      ...(twin.water.length === 0 ? ["OSM water layer missing for this city."] : []),
    ],
    timeline: baseTimeline(
      `Burst active — ${buildings.length} buildings, ${roads.length} roads impacted.`,
      "Repairs underway — reduced service-loss footprint.",
      metrics,
      { buildings_service_loss: Math.round(buildings.length * 0.35) },
      3,
    ),
    epicenter,
  };
}

export function executeExperiment(
  twin: TwinFeatureIndex,
  request: RunExperimentRequest,
): ExperimentResult {
  const params = mergeDefaults(request.kind, request.parameters);
  const epicenter = request.epicenter ?? {
    lon: twin.scene.camera.lon,
    lat: twin.scene.camera.lat,
  };
  const startedAt = new Date().toISOString();
  const experimentId = randomUUID();

  let body: Omit<ExperimentResult, "id" | "experimentId" | "startedAt" | "completedAt" | "status">;
  switch (request.kind) {
    case "heavy_rain":
      body = runHeavyRain(twin, params, epicenter);
      break;
    case "road_closure":
      body = runRoadClosure(twin, params, epicenter);
      break;
    case "building_fire":
      body = runBuildingFire(twin, params, epicenter);
      break;
    case "power_failure":
      body = runPowerFailure(twin, params, epicenter);
      break;
    case "medical_emergency":
      body = runMedicalEmergency(twin, params, epicenter);
      break;
    case "extreme_heat":
      body = runExtremeHeat(twin, params, epicenter);
      break;
    case "water_pipeline_failure":
      body = runWaterPipeline(twin, params, epicenter);
      break;
    default:
      throw new Error(`Unsupported experiment kind: ${String(request.kind)}`);
  }

  const completedAt = new Date().toISOString();
  return {
    id: randomUUID(),
    experimentId,
    status: "succeeded",
    startedAt,
    completedAt,
    ...body,
  };
}
