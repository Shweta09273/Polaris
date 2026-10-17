import { ulid } from "ulid";
import type { CanonicalEntity, CanonicalEdge } from "../normalize/normalize.js";
import * as turf from "@turf/turf";

/**
 * Ontology-driven edge inference — no hardcoded city graphs.
 * Rules are generic spatial / tag heuristics mapped to RelationType.
 */

function featureOf(e: CanonicalEntity): GeoJSON.Feature | null {
  if (!e.geometry) return null;
  return { type: "Feature", properties: { id: e.id }, geometry: e.geometry };
}

export function inferGraphEdges(entities: CanonicalEntity[], datasetVersionId: string): CanonicalEdge[] {
  const edges: CanonicalEdge[] = [];
  const push = (type: CanonicalEdge["type"], fromId: string, toId: string, properties?: Record<string, unknown>) => {
    edges.push({
      id: ulid(),
      type,
      fromId,
      toId,
      datasetVersionId,
      properties,
    });
  };

  const twin = entities.find((e) => e.entityKind === "TwinScope");
  const admin = entities.filter((e) => e.entityKind === "AdminArea");
  const roads = entities.filter((e) => e.entityKind === "RoadSegment" && e.geometry);
  const hospitals = entities.filter((e) => e.entityKind === "Hospital" && e.geometry);
  const schools = entities.filter((e) => e.entityKind === "School" && e.geometry);
  const fire = entities.filter((e) => e.entityKind === "FireStation" && e.geometry);
  const police = entities.filter((e) => e.entityKind === "PoliceStation" && e.geometry);
  const waterways = entities.filter((e) => e.entityKind === "Waterway" && e.geometry);
  const waterbodies = entities.filter((e) => e.entityKind === "Waterbody" && e.geometry);
  const buildings = entities.filter((e) => e.entityKind === "Building" && e.geometry);

  // LOCATED_IN TwinScope / AdminArea
  for (const e of entities) {
    if (twin && e.id !== twin.id) push("LOCATED_IN", e.id, twin.id, { rule: "aoi_membership" });
    for (const a of admin) {
      if (e.id === a.id) continue;
      const fe = featureOf(e);
      const fa = featureOf(a);
      if (!fe || !fa) continue;
      try {
        if (fe.geometry.type === "Point" && turf.booleanPointInPolygon(fe as GeoJSON.Feature<GeoJSON.Point>, fa as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
          push("LOCATED_IN", e.id, a.id, { rule: "point_in_admin" });
        }
      } catch {
        // ignore topology exceptions
      }
    }
  }

  // Critical facilities near roads → CONNECTED_TO nearest road (approx)
  const linkToNearestRoad = (facility: CanonicalEntity, rel: CanonicalEdge["type"] = "CONNECTED_TO") => {
    const ff = featureOf(facility);
    if (!ff || ff.geometry.type !== "Point") return;
    let best: { id: string; d: number } | null = null;
    for (const r of roads.slice(0, 5000)) {
      const rf = featureOf(r);
      if (!rf) continue;
      try {
        const d = turf.pointToLineDistance(ff as GeoJSON.Feature<GeoJSON.Point>, rf as GeoJSON.Feature<GeoJSON.LineString>, {
          units: "meters",
        });
        if (!best || d < best.d) best = { id: r.id, d };
        if (d < 30) break;
      } catch {
        // skip
      }
    }
    if (best && best.d < 250) {
      push(rel, facility.id, best.id, { rule: "nearest_road_m", distance_m: best.d });
      push("SERVES", best.id, facility.id, { rule: "road_serves_facility", distance_m: best.d });
    }
  };

  for (const h of hospitals) linkToNearestRoad(h);
  for (const s of schools) linkToNearestRoad(s);
  for (const f of fire) linkToNearestRoad(f);
  for (const p of police) linkToNearestRoad(p);

  // Waterway DRAINS_INTO waterbody if endpoint near centroid (no fabricated networks)
  for (const w of waterways) {
    const wf = featureOf(w);
    if (!wf || wf.geometry.type !== "LineString") continue;
    const coords = wf.geometry.coordinates;
    const end = coords[coords.length - 1] as [number, number];
    const endPt = turf.point(end);
    for (const body of waterbodies) {
      const bf = featureOf(body);
      if (!bf) continue;
      try {
        const d2 = turf.distance(endPt, turf.centroid(bf), { units: "meters" });
        if (d2 < 400) {
          push("DRAINS_INTO", w.id, body.id, { rule: "waterway_end_near_waterbody_centroid", distance_m: d2 });
          push("FLOWS_TO", w.id, body.id, { rule: "hydrologic_hint", distance_m: d2 });
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Buildings LOCATED_IN admin already handled; PART_OF not inferred without footprints hierarchy

  // NOTE: POWERS / Substation edges require utility data — intentionally not fabricated.
  // Flood zone OVERLAPS requires flood polygons — not fabricated from discharge alone.

  void buildings; // reserved for future height/overlap rules
  return edges;
}
