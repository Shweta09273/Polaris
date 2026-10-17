import type { EntityKind } from "@polaris/ontology";
import type { AccessMode, LicenseSpdx } from "@polaris/domain";

/**
 * Dataset registry — every bootstrap layer the twin requires.
 * status.required=true means missing layer reduces Twin Readiness Score.
 */

export type DatasetLayerKey =
  | "admin_boundary"
  | "admin_zones"
  | "roads"
  | "buildings"
  | "land_use"
  | "land_cover"
  | "hospitals"
  | "schools"
  | "police"
  | "fire"
  | "water_bodies"
  | "drainage"
  | "elevation"
  | "population"
  | "metro"
  | "railway"
  | "airport"
  | "weather"
  | "satellite_imagery"
  | "flood_zones"
  | "historical_rainfall"
  | "historical_flood_events"
  | "aqi"
  | "gtfs_transit"
  | "open_government_data";

export interface DatasetRegistryEntry {
  readonly key: DatasetLayerKey;
  readonly displayName: string;
  readonly entityKinds: readonly EntityKind[];
  readonly connectorIds: readonly string[];
  readonly required: boolean;
  readonly licenseExpected: LicenseSpdx | "mixed";
  readonly accessMode: AccessMode | "mixed";
  readonly notes: string;
}

export const DATASET_REGISTRY: readonly DatasetRegistryEntry[] = [
  {
    key: "admin_boundary",
    displayName: "City / admin boundary",
    entityKinds: ["AdminArea", "TwinScope"],
    connectorIds: ["nominatim", "geoboundaries", "osm"],
    required: true,
    licenseExpected: "CC-BY-4.0",
    accessMode: "api",
    notes: "Resolved from city name; geoBoundaries preferred for ADM polygons.",
  },
  {
    key: "admin_zones",
    displayName: "Administrative zones (ADM2+)",
    entityKinds: ["AdminArea"],
    connectorIds: ["geoboundaries"],
    required: false,
    licenseExpected: "CC-BY-4.0",
    accessMode: "api",
    notes: "Optional finer admin units when available for the country.",
  },
  {
    key: "roads",
    displayName: "Road network",
    entityKinds: ["RoadSegment", "RoadNode", "Bridge", "Tunnel"],
    connectorIds: ["osm"],
    required: true,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "OSM Overpass / extract; production should prefer Geofabrik PBF for large cities.",
  },
  {
    key: "buildings",
    displayName: "Building footprints",
    entityKinds: ["Building"],
    connectorIds: ["osm", "overture"],
    required: true,
    licenseExpected: "ODbL-1.0",
    accessMode: "mixed",
    notes: "OSM first; Overture Parquet when configured for bulk.",
  },
  {
    key: "land_use",
    displayName: "Land use / zoning",
    entityKinds: ["LandUseZone"],
    connectorIds: ["osm"],
    required: false,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "OSM landuse tags are incomplete; official zoning often partner/manual.",
  },
  {
    key: "land_cover",
    displayName: "Land cover raster",
    entityKinds: ["LandCoverCell"],
    connectorIds: ["esa-worldcover"],
    required: true,
    licenseExpected: "CC-BY-4.0",
    accessMode: "s3",
    notes: "ESA WorldCover COG tiles for AOI.",
  },
  {
    key: "hospitals",
    displayName: "Hospitals",
    entityKinds: ["Hospital"],
    connectorIds: ["osm"],
    required: true,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "OSM completeness is not official inventory — confidence capped.",
  },
  {
    key: "schools",
    displayName: "Schools",
    entityKinds: ["School"],
    connectorIds: ["osm"],
    required: true,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "OSM amenity=school/college/university.",
  },
  {
    key: "police",
    displayName: "Police stations",
    entityKinds: ["PoliceStation"],
    connectorIds: ["osm"],
    required: false,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "Variable completeness.",
  },
  {
    key: "fire",
    displayName: "Fire stations",
    entityKinds: ["FireStation"],
    connectorIds: ["osm"],
    required: false,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "Variable completeness.",
  },
  {
    key: "water_bodies",
    displayName: "Water bodies & waterways",
    entityKinds: ["Waterbody", "Waterway"],
    connectorIds: ["osm"],
    required: true,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "OSM natural=water / waterway=*.",
  },
  {
    key: "drainage",
    displayName: "Drainage / hydro network",
    entityKinds: ["DrainageBasin", "StormDrain", "Outfall"],
    connectorIds: ["osm", "hydrosheds"],
    required: false,
    licenseExpected: "mixed",
    accessMode: "mixed",
    notes: "Urban storm drains rarely complete in public data — report gaps.",
  },
  {
    key: "elevation",
    displayName: "Elevation DEM",
    entityKinds: ["ElevationTile"],
    connectorIds: ["copernicus"],
    required: true,
    licenseExpected: "Copernicus",
    accessMode: "s3",
    notes: "Copernicus GLO-30 tiles intersecting AOI.",
  },
  {
    key: "population",
    displayName: "Population surface",
    entityKinds: ["PopulationCell"],
    connectorIds: ["worldpop"],
    required: true,
    licenseExpected: "CC-BY-4.0",
    accessMode: "bulk_download",
    notes: "WorldPop unconstrained/constrained products by country.",
  },
  {
    key: "metro",
    displayName: "Metro / rapid transit",
    entityKinds: ["TransitRoute", "TransitStop"],
    connectorIds: ["osm", "gtfs"],
    required: false,
    licenseExpected: "mixed",
    accessMode: "mixed",
    notes: "OSM route=subway/light_rail + GTFS when catalog has open feed.",
  },
  {
    key: "railway",
    displayName: "Railway network",
    entityKinds: ["RailwaySegment", "RailwayStation"],
    connectorIds: ["osm"],
    required: false,
    licenseExpected: "ODbL-1.0",
    accessMode: "api",
    notes: "OSM railway=*",
  },
  {
    key: "airport",
    displayName: "Airports",
    entityKinds: ["Airport", "Runway"],
    connectorIds: ["ourairports", "osm"],
    required: false,
    licenseExpected: "Public-Domain",
    accessMode: "bulk_download",
    notes: "OurAirports filtered by AOI bbox.",
  },
  {
    key: "weather",
    displayName: "Weather forecast / current",
    entityKinds: ["WeatherStation", "ObservationSeries"],
    connectorIds: ["open-meteo"],
    required: true,
    licenseExpected: "CC-BY-4.0",
    accessMode: "api",
    notes: "Open-Meteo; commercial SaaS needs paid key.",
  },
  {
    key: "satellite_imagery",
    displayName: "Satellite imagery (Sentinel-2)",
    entityKinds: ["DatasetVersion"],
    connectorIds: ["sentinel"],
    required: false,
    licenseExpected: "Copernicus",
    accessMode: "stac",
    notes: "STAC search metadata; full mosaic deferred if credentials missing.",
  },
  {
    key: "flood_zones",
    displayName: "Flood zones / discharge",
    entityKinds: ["Floodplain"],
    connectorIds: ["open-meteo"],
    required: false,
    licenseExpected: "CC-BY-4.0",
    accessMode: "api",
    notes: "GloFAS discharge via Open-Meteo Flood — not regulatory floodplain polygons.",
  },
  {
    key: "historical_rainfall",
    displayName: "Historical rainfall",
    entityKinds: ["ObservationSeries"],
    connectorIds: ["open-meteo"],
    required: true,
    licenseExpected: "CC-BY-4.0",
    accessMode: "api",
    notes: "Open-Meteo archive (ERA5).",
  },
  {
    key: "historical_flood_events",
    displayName: "Historical flood / disaster events",
    entityKinds: ["DisasterEvent"],
    connectorIds: ["gdacs"],
    required: false,
    licenseExpected: "Unknown-Needs-Review",
    accessMode: "api",
    notes: "GDACS alerts near AOI; EM-DAT not auto-ingested (license).",
  },
  {
    key: "aqi",
    displayName: "Air quality",
    entityKinds: ["AirQualityStation", "ObservationSeries"],
    connectorIds: ["open-meteo", "waqi"],
    required: false,
    licenseExpected: "CC-BY-4.0",
    accessMode: "api",
    notes: "Open-Meteo AQ modelled; WAQI optional with token.",
  },
  {
    key: "gtfs_transit",
    displayName: "GTFS transit feeds",
    entityKinds: ["TransitRoute", "TransitStop"],
    connectorIds: ["gtfs"],
    required: false,
    licenseExpected: "mixed",
    accessMode: "api",
    notes: "Mobility Database catalog search; per-feed license recorded.",
  },
  {
    key: "open_government_data",
    displayName: "Government open data portal",
    entityKinds: ["DatasetVersion"],
    connectorIds: [],
    required: false,
    licenseExpected: "mixed",
    accessMode: "manual",
    notes: "Manifest-driven per jurisdiction — not auto for arbitrary cities.",
  },
];

export function registryByKey(key: DatasetLayerKey): DatasetRegistryEntry {
  const entry = DATASET_REGISTRY.find((e) => e.key === key);
  if (!entry) throw new Error(`Unknown dataset layer: ${key}`);
  return entry;
}
