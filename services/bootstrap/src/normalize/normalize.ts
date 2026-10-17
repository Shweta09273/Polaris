import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ulid } from "ulid";
import type { EntityKind, RelationType } from "@polaris/ontology";
import type { BoundingBox } from "@polaris/domain";
import { writeJson, ensureDir } from "@polaris/connector-sdk";
import { join } from "node:path";

export interface CanonicalEntity {
  readonly id: string;
  readonly entityKind: EntityKind;
  readonly aoiId: string;
  readonly name?: string;
  readonly externalIds: Record<string, string>;
  readonly geometry?: GeoJSON.Geometry;
  readonly properties: Record<string, unknown>;
  readonly datasetVersionId: string;
  readonly sourceConnectorId: string;
  readonly confidence: number;
}

export interface CanonicalEdge {
  readonly id: string;
  readonly type: RelationType;
  readonly fromId: string;
  readonly toId: string;
  readonly datasetVersionId: string;
  readonly properties?: Record<string, unknown>;
}

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
}

function osmPoint(el: OsmElement, nodes: Map<number, { lat: number; lon: number }>): GeoJSON.Geometry | undefined {
  if (el.type === "node" && el.lat != null && el.lon != null) {
    return { type: "Point", coordinates: [el.lon, el.lat] };
  }
  if (el.center) {
    return { type: "Point", coordinates: [el.center.lon, el.center.lat] };
  }
  if (el.type === "way" && el.nodes?.length) {
    const coords: [number, number][] = [];
    for (const nid of el.nodes) {
      const n = nodes.get(nid);
      if (n) coords.push([n.lon, n.lat]);
    }
    if (coords.length >= 2) {
      const tags = el.tags ?? {};
      if (tags.building || tags.amenity || tags.landuse || tags.natural === "water") {
        // close ring if needed
        const first = coords[0]!;
        const last = coords[coords.length - 1]!;
        if (first[0] !== last[0] || first[1] !== last[1]) coords.push([...first]);
        if (coords.length >= 4) return { type: "Polygon", coordinates: [coords] };
      }
      return { type: "LineString", coordinates: coords };
    }
  }
  return undefined;
}

function mapOsmTags(tags: Record<string, string>): { kind: EntityKind; confidence: number } | null {
  if (tags.highway) return { kind: "RoadSegment", confidence: 0.85 };
  if (tags.building) return { kind: "Building", confidence: 0.8 };
  if (tags.amenity === "hospital" || tags.healthcare === "hospital") return { kind: "Hospital", confidence: 0.7 };
  if (tags.amenity === "school" || tags.amenity === "college" || tags.amenity === "university")
    return { kind: "School", confidence: 0.7 };
  if (tags.amenity === "police") return { kind: "PoliceStation", confidence: 0.65 };
  if (tags.amenity === "fire_station") return { kind: "FireStation", confidence: 0.65 };
  if (tags.natural === "water" || tags.water) return { kind: "Waterbody", confidence: 0.8 };
  if (tags.waterway) return { kind: "Waterway", confidence: 0.8 };
  if (tags.railway === "station" || tags.railway === "halt") return { kind: "RailwayStation", confidence: 0.75 };
  if (tags.railway) return { kind: "RailwaySegment", confidence: 0.8 };
  if (tags.route === "subway" || tags.route === "light_rail" || tags.route === "tram" || tags.station === "subway")
    return { kind: "TransitRoute", confidence: 0.7 };
  if (tags.landuse) return { kind: "LandUseZone", confidence: 0.6 };
  if (tags.aeroway === "aerodrome" || tags.aeroway === "airport") return { kind: "Airport", confidence: 0.85 };
  return null;
}

export function normalizeOsmFile(
  path: string,
  aoiId: string,
  datasetVersionId: string,
): CanonicalEntity[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as { elements?: OsmElement[] };
  const elements = raw.elements ?? [];
  const nodes = new Map<number, { lat: number; lon: number }>();
  for (const el of elements) {
    if (el.type === "node" && el.lat != null && el.lon != null) {
      nodes.set(el.id, { lat: el.lat, lon: el.lon });
    }
  }

  const out: CanonicalEntity[] = [];
  for (const el of elements) {
    const tags = el.tags;
    if (!tags) continue;
    const mapped = mapOsmTags(tags);
    if (!mapped) continue;
    const geometry = osmPoint(el, nodes);
    out.push({
      id: ulid(),
      entityKind: mapped.kind,
      aoiId,
      name: tags.name,
      externalIds: { osm: `${el.type}/${el.id}` },
      geometry,
      properties: { ...tags },
      datasetVersionId,
      sourceConnectorId: "osm",
      confidence: mapped.confidence,
    });
  }
  return out;
}

export function normalizeAirportsGeoJson(
  path: string,
  aoiId: string,
  datasetVersionId: string,
): CanonicalEntity[] {
  const fc = JSON.parse(readFileSync(path, "utf8")) as GeoJSON.FeatureCollection;
  return (fc.features ?? []).map((f) => ({
    id: ulid(),
    entityKind: "Airport" as const,
    aoiId,
    name: String(f.properties?.name ?? f.properties?.ident ?? "airport"),
    externalIds: { ourairports: String(f.properties?.ident ?? "") },
    geometry: f.geometry ?? undefined,
    properties: { ...(f.properties as object) },
    datasetVersionId,
    sourceConnectorId: "ourairports",
    confidence: 0.9,
  }));
}

export function normalizeBoundary(
  path: string,
  aoiId: string,
  datasetVersionId: string,
  displayName: string,
): CanonicalEntity[] {
  const doc = JSON.parse(readFileSync(path, "utf8")) as GeoJSON.FeatureCollection | GeoJSON.Feature;
  const feature = "features" in doc ? doc.features[0] : doc;
  if (!feature) return [];
  return [
    {
      id: aoiId,
      entityKind: "TwinScope",
      aoiId,
      name: displayName,
      externalIds: { bootstrap: "twin-scope" },
      geometry: feature.geometry,
      properties: { role: "city_boundary" },
      datasetVersionId,
      sourceConnectorId: "nominatim",
      confidence: 0.85,
    },
    {
      id: ulid(),
      entityKind: "AdminArea",
      aoiId,
      name: displayName,
      externalIds: { nominatim: displayName },
      geometry: feature.geometry,
      properties: { admin_level: "city" },
      datasetVersionId,
      sourceConnectorId: "nominatim",
      confidence: 0.8,
    },
  ];
}

export function writeCanonicalTwin(
  workDir: string,
  entities: CanonicalEntity[],
  edges: CanonicalEdge[],
): { entitiesPath: string; edgesPath: string } {
  const dir = join(workDir, "normalized");
  ensureDir(dir);
  const entitiesPath = join(dir, "entities.json");
  const edgesPath = join(dir, "edges.json");
  writeJson(entitiesPath, { count: entities.length, entities });
  writeJson(edgesPath, { count: edges.length, edges });
  return { entitiesPath, edgesPath };
}

export function contentHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export type { BoundingBox };
