/**
 * Offline sensitivity check — intensity/duration must change spatial outputs.
 */
import { runExperiment } from "@polaris/experiment-engine";
import { buildDecisionBrief } from "@polaris/decision-engine";

const epi = { lon: 7.4277, lat: 43.7323 };

const a = runExperiment({
  citySlug: "monaco",
  kind: "heavy_rain",
  parameters: {
    rainfall_scenario: "extreme",
    intensity_mm_hr: 60,
    duration_h: 2,
    impact_radius_m: 0,
  },
  epicenter: epi,
});

const b = runExperiment({
  citySlug: "monaco",
  kind: "heavy_rain",
  parameters: {
    rainfall_scenario: "extreme",
    intensity_mm_hr: 180,
    duration_h: 8,
    impact_radius_m: 0,
  },
  epicenter: epi,
});

const c = runExperiment({
  citySlug: "monaco",
  kind: "heavy_rain",
  parameters: {
    rainfall_scenario: "extreme",
    intensity_mm_hr: 120,
    duration_h: 4,
    impact_radius_m: 400,
  },
  epicenter: epi,
});

const ba = buildDecisionBrief(a);
const bb = buildDecisionBrief(b);

const report = {
  low: {
    intensity: a.metrics.rain_intensity_mm_hr,
    radius: a.metrics.flood_radius_m,
    buildings: a.metrics.buildings_affected,
    roads: a.metrics.roads_affected,
    confidence: ba.confidence,
  },
  high: {
    intensity: b.metrics.rain_intensity_mm_hr,
    radius: b.metrics.flood_radius_m,
    buildings: b.metrics.buildings_affected,
    roads: b.metrics.roads_affected,
    confidence: bb.confidence,
  },
  radiusOverride400: {
    intensity: c.metrics.rain_intensity_mm_hr,
    radius: c.metrics.flood_radius_m,
    buildings: c.metrics.buildings_affected,
    roads: c.metrics.roads_affected,
  },
  pass:
    a.metrics.rain_intensity_mm_hr === 60 &&
    b.metrics.rain_intensity_mm_hr === 180 &&
    Number(a.metrics.flood_radius_m) < Number(b.metrics.flood_radius_m) &&
    Number(a.metrics.buildings_affected) < Number(b.metrics.buildings_affected) &&
    Number(c.metrics.flood_radius_m) === 400,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
