import type { UrbanDomain } from "./domains.js";

/**
 * Canonical entity kinds — one name globally.
 * Storage: Neo4j primary label = EntityKind; PostGIS twin.entity_kind column uses same string.
 */

export const ENTITY_KINDS = [
  // twin_meta / spatial / administrative
  "TwinScope",
  "AdminArea",
  "Agency",
  "Organization",
  "Parcel",

  // transportation
  "RoadSegment",
  "RoadNode",
  "Bridge",
  "Tunnel",
  "RailwaySegment",
  "RailwayStation",
  "TransitRoute",
  "TransitStop",
  "TransitVehicle",
  "Airport",
  "Runway",
  "Seaport",
  "PortTerminal",
  "TrafficSegment",
  "ParkingFacility",

  // buildings / land use
  "Building",
  "BuildingPart",
  "Facility",
  "Floor",
  "LandUseZone",
  "LandCoverCell",

  // healthcare / education / emergency / security / public services
  "Hospital",
  "Clinic",
  "Pharmacy",
  "School",
  "UniversityCampus",
  "FireStation",
  "PoliceStation",
  "EmergencyOperationsCenter",
  "Shelter",
  "AmbulanceStation",
  "PublicServiceCenter",
  "SecurityPerimeter",

  // energy / water / drainage / waste / utilities / communication
  "PowerPlant",
  "Substation",
  "PowerLine",
  "PowerTransformer",
  "FuelDepot",
  "WaterTreatmentPlant",
  "WaterReservoir",
  "WaterMain",
  "PumpStation",
  "DrainageBasin",
  "StormDrain",
  "SewerSegment",
  "Outfall",
  "WasteFacility",
  "UtilityServicePoint",
  "TelecomTower",
  "FiberSegment",
  "RadioSite",
  "DataCenter",

  // environment / weather / climate / natural
  "AirQualityStation",
  "WeatherStation",
  "ClimateZone",
  "ElevationTile",
  "Waterbody",
  "Waterway",
  "Coastline",
  "Floodplain",
  "ForestStand",
  "Wetland",
  "GeologicalUnit",

  // population / economy
  "PopulationCell",
  "HouseholdCluster",
  "DemographicSegment",
  "EmploymentCenter",
  "IndustrialPark",
  "MarketNode",

  // government / policy
  "GovernmentBody",
  "PolicyInstrument",
  "ZoningOrdinance",
  "EmergencyPlan",
  "Permit",

  // infrastructure / construction
  "CriticalInfrastructureNode",
  "Corridor",
  "ConstructionProject",
  "WorkZone",

  // resources
  "ResourceAsset",
  "VehicleResource",
  "Crew",
  "EquipmentItem",
  "Stockpile",
  "Depot",
  "ShelterCapacity",

  // disasters / events
  "HazardType",
  "DisasterEvent",
  "OperationalEvent",
  "Incident",

  // observation / time / twin meta
  "Sensor",
  "ObservationSeries",
  "Measurement",
  "Alert",
  "TimeInterval",
  "Epoch",
  "DatasetVersion",
  "TwinSnapshot",
  "EntityState",
  "ProvenanceRecord",

  // decision / experiment
  "Decision",
  "Action",
  "ExpectedOutcome",
  "Explanation",
  "Evaluation",
  "Experiment",
  "Scenario",
  "ExperimentResult",
  "MetricDefinition",

  // extensibility scopes
  "Campus",
  "MilitaryBase",
  "SmartDistrict",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export type LifecyclePhase =
  | "planned"
  | "under_construction"
  | "commissioning"
  | "active"
  | "degraded"
  | "offline"
  | "decommissioned"
  | "retired"
  | "unknown";

export interface EntityKindSpec {
  readonly kind: EntityKind;
  readonly domain: UrbanDomain;
  readonly description: string;
  readonly neo4jLabels: readonly string[];
  readonly isPhysical: boolean;
  readonly isDeployable: boolean;
  readonly typicalGeometry: "point" | "linestring" | "polygon" | "multipolygon" | "raster" | "none";
  readonly coreAttributes: readonly string[];
  readonly stateVariables: readonly string[];
  readonly lifecyclePhases: readonly LifecyclePhase[];
  readonly businessRules: readonly string[];
}

/** Shared attribute bundles referenced by specs (canonical snake_case). */
export const COMMON_ATTRIBUTES = [
  "id",
  "aoi_id",
  "name",
  "display_name",
  "external_ids",
  "lifecycle_phase",
  "dataset_version_id",
  "created_at",
  "updated_at",
  "valid_from",
  "valid_to",
  "confidence",
  "health_score",
  "version",
] as const;

export const ENTITY_KIND_SPECS: readonly EntityKindSpec[] = [
  { kind: "TwinScope", domain: "spatial", description: "Operational AOI / twin boundary for a workspace.", neo4jLabels: ["TwinScope", "Spatial"], isPhysical: false, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["workspace_id", "name", "crs", "bbox"], stateVariables: ["ingestion_freshness", "coverage_ratio"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["Exactly one primary TwinScope per active AOI twin.", "All physical entities must LOCATED_IN a TwinScope or AdminArea within it."] },
  { kind: "AdminArea", domain: "administrative", description: "Administrative jurisdiction (ADM0–ADMn).", neo4jLabels: ["AdminArea", "Spatial"], isPhysical: false, isDeployable: false, typicalGeometry: "multipolygon", coreAttributes: ["admin_level", "iso_code", "population_ref"], stateVariables: ["governance_status"], lifecyclePhases: ["active", "retired"], businessRules: ["admin_level must be consistent within a hierarchy.", "Prefer geoBoundaries for commercial SaaS."] },
  { kind: "Agency", domain: "government", description: "Public agency with operational remit.", neo4jLabels: ["Agency", "Organization"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["agency_type", "jurisdiction_id", "contact"], stateVariables: ["operational_posture"], lifecyclePhases: ["active", "retired"], businessRules: ["Must GOVERNED_BY or LOCATED_IN an AdminArea."] },
  { kind: "Organization", domain: "economy", description: "Legal organization (public or private).", neo4jLabels: ["Organization"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["org_type", "registration_id"], stateVariables: ["active_status"], lifecyclePhases: ["active", "retired"], businessRules: ["External IDs must be unique per org_type namespace."] },
  { kind: "Parcel", domain: "land_use", description: "Cadastral parcel.", neo4jLabels: ["Parcel", "Spatial"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["parcel_id", "zoning_code", "owner_org_id"], stateVariables: ["development_status"], lifecyclePhases: ["active", "retired"], businessRules: ["Partner/government data often required; do not invent parcels."] },

  { kind: "RoadSegment", domain: "transportation", description: "Directed or undirected road centerline segment.", neo4jLabels: ["RoadSegment", "Transport", "NetworkEdge"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["highway_class", "lanes", "oneway", "speed_limit_kph", "surface"], stateVariables: ["open_status", "congestion_index", "capacity_ratio", "closure_reason"], lifecyclePhases: ["planned", "under_construction", "active", "degraded", "offline", "retired"], businessRules: ["Must CONNECTED_TO RoadNodes at endpoints when topology is known.", "Closure events BLOCK RoadSegment."] },
  { kind: "RoadNode", domain: "transportation", description: "Intersection or topology node.", neo4jLabels: ["RoadNode", "Transport", "NetworkNode"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["node_type"], stateVariables: ["signal_status"], lifecyclePhases: ["active", "retired"], businessRules: ["Degree >= 1 for published topology."] },
  { kind: "Bridge", domain: "transportation", description: "Bridge structure carrying transport.", neo4jLabels: ["Bridge", "Transport", "Infrastructure"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["clearance_m", "load_rating"], stateVariables: ["structural_health", "open_status"], lifecyclePhases: ["planned", "active", "degraded", "offline", "retired"], businessRules: ["VULNERABLE_TO flood/seismic HazardTypes where applicable."] },
  { kind: "Tunnel", domain: "transportation", description: "Tunnel structure.", neo4jLabels: ["Tunnel", "Transport", "Infrastructure"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["length_m", "ventilation"], stateVariables: ["open_status", "air_quality_index"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["DEPENDS_ON power and communication for safe operation."] },
  { kind: "RailwaySegment", domain: "transportation", description: "Rail track segment.", neo4jLabels: ["RailwaySegment", "Transport", "NetworkEdge"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["gauge", "electrified", "max_speed_kph"], stateVariables: ["open_status", "occupancy"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["Topology via CONNECTED_TO / ROUTES_TO."] },
  { kind: "RailwayStation", domain: "transportation", description: "Rail passenger/freight station.", neo4jLabels: ["RailwayStation", "Transport", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["station_code", "platforms"], stateVariables: ["operational_status", "crowd_level"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["SERVES surrounding AdminAreas/PopulationCells."] },
  { kind: "TransitRoute", domain: "transportation", description: "Scheduled transit route (bus/metro/tram).", neo4jLabels: ["TransitRoute", "Transport"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["route_id", "mode", "agency_id"], stateVariables: ["service_status", "headway_minutes"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Requires licensed GTFS or equivalent; license recorded on DatasetVersion."] },
  { kind: "TransitStop", domain: "transportation", description: "Stop/platform boarding point.", neo4jLabels: ["TransitStop", "Transport"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["stop_code", "wheelchair_boarding"], stateVariables: ["in_service"], lifecyclePhases: ["active", "retired"], businessRules: ["PART_OF TransitRoute via ROUTES_TO/SERVES pattern."] },
  { kind: "TransitVehicle", domain: "transportation", description: "In-service transit vehicle instance.", neo4jLabels: ["TransitVehicle", "Transport", "ResourceAsset"], isPhysical: true, isDeployable: true, typicalGeometry: "point", coreAttributes: ["vehicle_id", "mode", "capacity"], stateVariables: ["location", "occupancy", "delay_seconds"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Live positions require real feed; never fabricate."] },
  { kind: "Airport", domain: "transportation", description: "Aerodrome complex.", neo4jLabels: ["Airport", "Transport", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["icao", "iata", "elevation_m"], stateVariables: ["operational_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["COMPOSED_OF Runways and terminal Facilities."] },
  { kind: "Runway", domain: "transportation", description: "Airport runway.", neo4jLabels: ["Runway", "Transport"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["designator", "length_m", "surface"], stateVariables: ["open_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["PART_OF Airport."] },
  { kind: "Seaport", domain: "transportation", description: "Maritime port complex.", neo4jLabels: ["Seaport", "Transport", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["unlocode", "draft_m"], stateVariables: ["operational_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["May CONTAINS PortTerminals."] },
  { kind: "PortTerminal", domain: "transportation", description: "Port terminal facility.", neo4jLabels: ["PortTerminal", "Transport", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["cargo_types", "berths"], stateVariables: ["throughput_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["LOCATED_IN Seaport."] },
  { kind: "TrafficSegment", domain: "transportation", description: "Traffic observation segment (ITS).", neo4jLabels: ["TrafficSegment", "Transport"], isPhysical: false, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["ref_road_segment_id"], stateVariables: ["speed_kph", "volume", "travel_time_s"], lifecyclePhases: ["active", "offline"], businessRules: ["Requires TrafficFeedPort; no synthetic congestion."] },
  { kind: "ParkingFacility", domain: "transportation", description: "Parking structure or lot.", neo4jLabels: ["ParkingFacility", "Transport", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["capacity_spaces"], stateVariables: ["occupancy_ratio"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["SERVES nearby Facilities/Buildings."] },

  { kind: "Building", domain: "buildings", description: "Building footprint / structure.", neo4jLabels: ["Building", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["height_m", "levels", "use_class", "year_built"], stateVariables: ["occupancy_status", "structural_health", "power_status", "water_status"], lifecyclePhases: ["planned", "under_construction", "active", "degraded", "decommissioned", "retired"], businessRules: ["DEPENDS_ON energy and water service points when known.", "Do not invent heights."] },
  { kind: "BuildingPart", domain: "buildings", description: "Part of a building (wing/tower).", neo4jLabels: ["BuildingPart"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["part_role"], stateVariables: ["occupancy_status"], lifecyclePhases: ["active", "retired"], businessRules: ["PART_OF Building."] },
  { kind: "Facility", domain: "buildings", description: "Named facility that may span buildings.", neo4jLabels: ["Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["facility_type"], stateVariables: ["operational_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["May COMPOSED_OF Buildings."] },
  { kind: "Floor", domain: "buildings", description: "Building floor level.", neo4jLabels: ["Floor"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["level_index"], stateVariables: ["accessible"], lifecyclePhases: ["active", "retired"], businessRules: ["PART_OF Building."] },
  { kind: "LandUseZone", domain: "land_use", description: "Zoning / permitted use polygon.", neo4jLabels: ["LandUseZone", "Spatial"], isPhysical: false, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["zone_code", "permitted_uses"], stateVariables: ["policy_status"], lifecyclePhases: ["active", "retired"], businessRules: ["REGULATED_BY ZoningOrdinance when linked."] },
  { kind: "LandCoverCell", domain: "land_use", description: "Raster/vector land cover cell.", neo4jLabels: ["LandCoverCell", "Spatial"], isPhysical: true, isDeployable: false, typicalGeometry: "raster", coreAttributes: ["cover_class", "resolution_m"], stateVariables: ["cover_class"], lifecyclePhases: ["active", "retired"], businessRules: ["Must cite DatasetVersion (e.g., ESA WorldCover)."] },

  { kind: "Hospital", domain: "healthcare", description: "In-patient hospital facility.", neo4jLabels: ["Hospital", "Healthcare", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["beds_total", "trauma_level", "emergency"], stateVariables: ["beds_available", "ed_wait_minutes", "power_status", "divert_status"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["OSM completeness is not official inventory.", "CRITICAL_FOR population catchments it SERVES."] },
  { kind: "Clinic", domain: "healthcare", description: "Out-patient clinic.", neo4jLabels: ["Clinic", "Healthcare", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["specialty"], stateVariables: ["open_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["May SERVE local PopulationCells."] },
  { kind: "Pharmacy", domain: "healthcare", description: "Pharmacy retail/clinical.", neo4jLabels: ["Pharmacy", "Healthcare", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["hours"], stateVariables: ["open_status", "stock_critical_meds"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Stock state requires partner feed."] },
  { kind: "School", domain: "education", description: "Primary/secondary school.", neo4jLabels: ["School", "Education", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["education_level", "capacity_students"], stateVariables: ["open_status", "occupancy"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["May act as Shelter under EmergencyPlan."] },
  { kind: "UniversityCampus", domain: "education", description: "Higher-education campus scope.", neo4jLabels: ["UniversityCampus", "Education", "Campus"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["institution_name"], stateVariables: ["operational_status"], lifecyclePhases: ["active", "retired"], businessRules: ["Extensible TwinScope pattern for campus twins."] },
  { kind: "FireStation", domain: "emergency", description: "Fire & rescue station.", neo4jLabels: ["FireStation", "Emergency", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["apparatus_bays"], stateVariables: ["units_available", "response_readiness"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Unit availability requires EmergencyOperationsPort."] },
  { kind: "PoliceStation", domain: "security", description: "Police station.", neo4jLabels: ["PoliceStation", "Security", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["precinct_id"], stateVariables: ["staffing_level", "open_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Operational CAD state is partner-only."] },
  { kind: "EmergencyOperationsCenter", domain: "emergency", description: "EOC / command facility.", neo4jLabels: ["EmergencyOperationsCenter", "Emergency", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["activation_level_max"], stateVariables: ["activation_level", "staffing"], lifecyclePhases: ["active", "offline"], businessRules: ["CONTROLLED_BY Agency."] },
  { kind: "Shelter", domain: "emergency", description: "Emergency shelter site.", neo4jLabels: ["Shelter", "Emergency", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["capacity_persons", "accessibility"], stateVariables: ["occupancy", "open_status", "supply_days"], lifecyclePhases: ["planned", "active", "offline", "retired"], businessRules: ["Capacity must not be fabricated."] },
  { kind: "AmbulanceStation", domain: "emergency", description: "EMS staging facility.", neo4jLabels: ["AmbulanceStation", "Emergency", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["fleet_size_nominal"], stateVariables: ["ambulances_available"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Links to VehicleResource ambulances."] },
  { kind: "PublicServiceCenter", domain: "public_services", description: "Civic service delivery center.", neo4jLabels: ["PublicServiceCenter", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["services_offered"], stateVariables: ["open_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["SERVES AdminArea population."] },
  { kind: "SecurityPerimeter", domain: "security", description: "Defined security perimeter.", neo4jLabels: ["SecurityPerimeter", "Security", "Spatial"], isPhysical: false, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["security_level"], stateVariables: ["alert_status"], lifecyclePhases: ["active", "retired"], businessRules: ["May GUARDS Facilities."] },

  { kind: "PowerPlant", domain: "energy", description: "Generation facility.", neo4jLabels: ["PowerPlant", "Energy", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["fuel_type", "capacity_mw"], stateVariables: ["output_mw", "online"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["Partner data often required for utilities."] },
  { kind: "Substation", domain: "energy", description: "Electrical substation.", neo4jLabels: ["Substation", "Energy", "NetworkNode"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["voltage_kv"], stateVariables: ["online", "load_ratio"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["POWERS downstream consumers via FEEDS/CONNECTED_TO."] },
  { kind: "PowerLine", domain: "energy", description: "Transmission/distribution line.", neo4jLabels: ["PowerLine", "Energy", "NetworkEdge"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["voltage_kv", "circuits"], stateVariables: ["energized", "fault_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Cascade via CASCADES_TO buildings it POWERS."] },
  { kind: "PowerTransformer", domain: "energy", description: "Transformer asset.", neo4jLabels: ["PowerTransformer", "Energy"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["rating_mva"], stateVariables: ["online", "temperature_c"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["PART_OF Substation when applicable."] },
  { kind: "FuelDepot", domain: "energy", description: "Fuel storage depot.", neo4jLabels: ["FuelDepot", "Energy", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["fuel_types", "capacity_liters"], stateVariables: ["stock_liters", "resupply_eta_h"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["SUPPLIES VehicleResources / generators."] },
  { kind: "WaterTreatmentPlant", domain: "water", description: "Potable water treatment.", neo4jLabels: ["WaterTreatmentPlant", "Water", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["capacity_mld"], stateVariables: ["output_mld", "online"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["DEPENDS_ON power."] },
  { kind: "WaterReservoir", domain: "water", description: "Raw/treated water storage.", neo4jLabels: ["WaterReservoir", "Water"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["capacity_m3"], stateVariables: ["level_m3", "days_supply"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["FEEDS treatment or distribution."] },
  { kind: "WaterMain", domain: "water", description: "Distribution main segment.", neo4jLabels: ["WaterMain", "Water", "NetworkEdge"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["diameter_mm", "material"], stateVariables: ["pressure_bar", "leak_status"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["SUPPLIES UtilityServicePoints."] },
  { kind: "PumpStation", domain: "water", description: "Water or drainage pump station.", neo4jLabels: ["PumpStation", "Water", "Drainage", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["pump_count", "rated_flow_m3s"], stateVariables: ["pumps_online", "power_status"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["CRITICAL_FOR flood mitigation when stormwater."] },
  { kind: "DrainageBasin", domain: "drainage", description: "Catchment / basin.", neo4jLabels: ["DrainageBasin", "Drainage", "Spatial"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["basin_id", "area_km2"], stateVariables: ["soil_moisture", "runoff_index"], lifecyclePhases: ["active"], businessRules: ["Contains StormDrain/Waterway hierarchy."] },
  { kind: "StormDrain", domain: "drainage", description: "Stormwater inlet/conduit node.", neo4jLabels: ["StormDrain", "Drainage", "NetworkNode"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["inlet_type"], stateVariables: ["blocked", "flow_m3s"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["Urban storm drains often missing publicly — interface only if absent."] },
  { kind: "SewerSegment", domain: "drainage", description: "Sewer network segment.", neo4jLabels: ["SewerSegment", "Drainage", "NetworkEdge"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["diameter_mm", "combined_sewer"], stateVariables: ["flow_ratio", "surcharge"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["DRAINS_INTO Outfall or treatment."] },
  { kind: "Outfall", domain: "drainage", description: "Discharge outfall.", neo4jLabels: ["Outfall", "Drainage", "NetworkNode"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["receiving_waterbody_id"], stateVariables: ["discharge_m3s"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["DRAINS_INTO Waterbody/Waterway."] },
  { kind: "WasteFacility", domain: "waste", description: "Waste processing/disposal facility.", neo4jLabels: ["WasteFacility", "Waste", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["waste_streams", "capacity_tpd"], stateVariables: ["throughput_tpd", "online"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["REGULATED_BY environmental PolicyInstruments."] },
  { kind: "UtilityServicePoint", domain: "utilities", description: "Service connection point to a consumer.", neo4jLabels: ["UtilityServicePoint", "Utilities", "NetworkNode"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["utility_kind", "customer_ref"], stateVariables: ["service_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Links Building/Facility via SUPPLIES/SERVES."] },
  { kind: "TelecomTower", domain: "communication", description: "Cellular/radio tower.", neo4jLabels: ["TelecomTower", "Communication", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["technologies", "height_m"], stateVariables: ["online", "load_ratio"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["DEPENDS_ON power."] },
  { kind: "FiberSegment", domain: "communication", description: "Fiber optic segment.", neo4jLabels: ["FiberSegment", "Communication", "NetworkEdge"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["fiber_count"], stateVariables: ["link_up", "latency_ms"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["TRANSMITS between sites."] },
  { kind: "RadioSite", domain: "communication", description: "Public-safety / utility radio site.", neo4jLabels: ["RadioSite", "Communication", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["bands"], stateVariables: ["online"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["CRITICAL_FOR emergency command nets."] },
  { kind: "DataCenter", domain: "communication", description: "Data center facility.", neo4jLabels: ["DataCenter", "Communication", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["tier", "it_load_mw"], stateVariables: ["power_status", "cooling_status"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["DEPENDS_ON redundant power paths when modeled."] },

  { kind: "AirQualityStation", domain: "environment", description: "AQI monitoring station.", neo4jLabels: ["AirQualityStation", "Environment", "Sensor"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["pollutants"], stateVariables: ["aqi", "pm25", "no2"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Label modelled vs station observations distinctly."] },
  { kind: "WeatherStation", domain: "weather", description: "Weather observation site or virtual grid point.", neo4jLabels: ["WeatherStation", "Weather", "Sensor"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["station_kind"], stateVariables: ["temp_c", "precip_mm_h", "wind_ms", "humidity"], lifecyclePhases: ["active", "offline"], businessRules: ["Virtual grid points must declare model provenance."] },
  { kind: "ClimateZone", domain: "climate", description: "Climate classification region.", neo4jLabels: ["ClimateZone", "Climate", "Spatial"], isPhysical: false, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["classification"], stateVariables: ["anomaly_index"], lifecyclePhases: ["active"], businessRules: ["Long-horizon; not a substitute for weather."] },
  { kind: "ElevationTile", domain: "natural_features", description: "DEM tile reference.", neo4jLabels: ["ElevationTile", "Natural", "Raster"], isPhysical: true, isDeployable: false, typicalGeometry: "raster", coreAttributes: ["resolution_m", "dem_product"], stateVariables: ["availability"], lifecyclePhases: ["active", "retired"], businessRules: ["Copernicus DEM is DSM — not bare-earth DTM."] },
  { kind: "Waterbody", domain: "natural_features", description: "Lake/reservoir/sea polygon.", neo4jLabels: ["Waterbody", "Natural", "Hydro"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["waterbody_type"], stateVariables: ["level_m", "flood_stage"], lifecyclePhases: ["active"], businessRules: ["May receive Outfall DRAINS_INTO."] },
  { kind: "Waterway", domain: "natural_features", description: "River/stream centerline.", neo4jLabels: ["Waterway", "Natural", "Hydro", "NetworkEdge"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["stream_order", "name"], stateVariables: ["discharge_m3s", "stage_m"], lifecyclePhases: ["active"], businessRules: ["FLOWS_TO downstream Waterway/Waterbody."] },
  { kind: "Coastline", domain: "natural_features", description: "Coastline feature.", neo4jLabels: ["Coastline", "Natural"], isPhysical: true, isDeployable: false, typicalGeometry: "linestring", coreAttributes: ["shore_type"], stateVariables: ["erosion_index"], lifecyclePhases: ["active"], businessRules: ["VULNERABLE_TO storm surge HazardTypes."] },
  { kind: "Floodplain", domain: "disasters", description: "Regulatory or modelled floodplain.", neo4jLabels: ["Floodplain", "Disaster", "Spatial"], isPhysical: false, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["return_period_years", "source_authority"], stateVariables: ["inundation_depth_m"], lifecyclePhases: ["active", "retired"], businessRules: ["National flood zones often manual; do not invent extents."] },
  { kind: "ForestStand", domain: "natural_features", description: "Forest / vegetation stand.", neo4jLabels: ["ForestStand", "Natural"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["canopy_type"], stateVariables: ["fire_danger_index"], lifecyclePhases: ["active"], businessRules: ["May EXPOSES wildfire risk to Buildings."] },
  { kind: "Wetland", domain: "natural_features", description: "Wetland area.", neo4jLabels: ["Wetland", "Natural"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["wetland_class"], stateVariables: ["saturation"], lifecyclePhases: ["active"], businessRules: ["MITIGATES some flood impacts."] },
  { kind: "GeologicalUnit", domain: "natural_features", description: "Surface geology unit.", neo4jLabels: ["GeologicalUnit", "Natural"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["lithology"], stateVariables: ["liquefaction_susceptibility"], lifecyclePhases: ["active"], businessRules: ["Used for seismic vulnerability context."] },

  { kind: "PopulationCell", domain: "population", description: "Gridded or zonal population unit.", neo4jLabels: ["PopulationCell", "Population", "Spatial"], isPhysical: false, isDeployable: false, typicalGeometry: "raster", coreAttributes: ["population_count", "resolution_m", "year"], stateVariables: ["population_count", "daytime_population"], lifecyclePhases: ["active", "retired"], businessRules: ["Must cite WorldPop or official census DatasetVersion."] },
  { kind: "HouseholdCluster", domain: "population", description: "Aggregated household cluster (privacy-safe).", neo4jLabels: ["HouseholdCluster", "Population"], isPhysical: false, isDeployable: false, typicalGeometry: "point", coreAttributes: ["households"], stateVariables: ["displaced_count"], lifecyclePhases: ["active"], businessRules: ["No PII; aggregation required."] },
  { kind: "DemographicSegment", domain: "population", description: "Demographic cohort within an area.", neo4jLabels: ["DemographicSegment", "Population"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["segment_key", "count"], stateVariables: ["count"], lifecyclePhases: ["active"], businessRules: ["LOCATED_IN AdminArea or PopulationCell."] },
  { kind: "EmploymentCenter", domain: "economy", description: "Employment concentration node.", neo4jLabels: ["EmploymentCenter", "Economy"], isPhysical: false, isDeployable: false, typicalGeometry: "point", coreAttributes: ["jobs_estimate"], stateVariables: ["jobs_estimate", "open_status"], lifecyclePhases: ["active", "retired"], businessRules: ["Estimates require provenance."] },
  { kind: "IndustrialPark", domain: "economy", description: "Industrial park / estate.", neo4jLabels: ["IndustrialPark", "Economy", "Campus"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["sectors"], stateVariables: ["operational_status"], lifecyclePhases: ["active", "retired"], businessRules: ["Extensible twin scope for industrial parks."] },
  { kind: "MarketNode", domain: "economy", description: "Market / commercial node.", neo4jLabels: ["MarketNode", "Economy"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["market_type"], stateVariables: ["activity_index"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["May DEPENDS_ON transport access."] },

  { kind: "GovernmentBody", domain: "government", description: "Governing body / council / ministry unit.", neo4jLabels: ["GovernmentBody", "Government"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["body_type"], stateVariables: ["session_status"], lifecyclePhases: ["active", "retired"], businessRules: ["GOVERNED_BY hierarchy optional."] },
  { kind: "PolicyInstrument", domain: "policy", description: "Law, regulation, plan, or SOP.", neo4jLabels: ["PolicyInstrument", "Policy"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["instrument_type", "citation", "effective_date"], stateVariables: ["in_force"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["REGULATES entities via REGULATED_BY."] },
  { kind: "ZoningOrdinance", domain: "policy", description: "Zoning code instrument.", neo4jLabels: ["ZoningOrdinance", "Policy"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["code_version"], stateVariables: ["in_force"], lifecyclePhases: ["active", "retired"], businessRules: ["Links LandUseZones."] },
  { kind: "EmergencyPlan", domain: "policy", description: "Emergency operations plan.", neo4jLabels: ["EmergencyPlan", "Policy", "Emergency"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["plan_id", "hazard_scope"], stateVariables: ["activation_status"], lifecyclePhases: ["active", "retired"], businessRules: ["May ENABLE Shelter openings and resource deployments."] },
  { kind: "Permit", domain: "policy", description: "Issued permit / authorization.", neo4jLabels: ["Permit", "Policy"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["permit_type", "status"], stateVariables: ["status"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["ACTS_ON ConstructionProject/Building."] },

  { kind: "CriticalInfrastructureNode", domain: "infrastructure", description: "Designated critical infrastructure node.", neo4jLabels: ["CriticalInfrastructureNode", "Infrastructure"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["ci_sector", "criticality"], stateVariables: ["health_score", "threat_level"], lifecyclePhases: ["active", "degraded", "offline", "retired"], businessRules: ["criticality in {1..5}; cascade priority follows criticality."] },
  { kind: "Corridor", domain: "infrastructure", description: "Multi-modal or utility corridor.", neo4jLabels: ["Corridor", "Infrastructure", "Spatial"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["corridor_type"], stateVariables: ["congestion_or_load"], lifecyclePhases: ["active", "retired"], businessRules: ["CONTAINS network assets."] },
  { kind: "ConstructionProject", domain: "construction", description: "Capital or maintenance project.", neo4jLabels: ["ConstructionProject", "Construction"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["project_code", "budget"], stateVariables: ["progress_pct", "schedule_status"], lifecyclePhases: ["planned", "under_construction", "commissioning", "active", "retired"], businessRules: ["May CREATE WorkZones that BLOCK transport."] },
  { kind: "WorkZone", domain: "construction", description: "Temporary work zone disruption.", neo4jLabels: ["WorkZone", "Construction", "Spatial"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["project_id", "lane_impacts"], stateVariables: ["active", "severity"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["BLOCKS RoadSegments while active."] },

  { kind: "ResourceAsset", domain: "resources", description: "Generic deployable resource asset.", neo4jLabels: ["ResourceAsset", "Resource"], isPhysical: true, isDeployable: true, typicalGeometry: "point", coreAttributes: ["resource_class", "capabilities"], stateVariables: ["availability", "condition", "assigned"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["Subclass via VehicleResource/EquipmentItem when known."] },
  { kind: "VehicleResource", domain: "resources", description: "Deployable vehicle (ambulance, fire truck, pump truck).", neo4jLabels: ["VehicleResource", "Resource"], isPhysical: true, isDeployable: true, typicalGeometry: "point", coreAttributes: ["vehicle_class", "capacity"], stateVariables: ["availability", "fuel_level", "location", "assignment_id"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["STAGED_AT Depot/Station; DEPLOYED_TO Incident."] },
  { kind: "Crew", domain: "resources", description: "Human team / crew.", neo4jLabels: ["Crew", "Resource"], isPhysical: false, isDeployable: true, typicalGeometry: "none", coreAttributes: ["crew_type", "size", "skills"], stateVariables: ["availability", "fatigue_index", "location_ref"], lifecyclePhases: ["active", "offline"], businessRules: ["No PII; crew is an operational unit."] },
  { kind: "EquipmentItem", domain: "resources", description: "Equipment unit (pump, generator, radio).", neo4jLabels: ["EquipmentItem", "Resource"], isPhysical: true, isDeployable: true, typicalGeometry: "point", coreAttributes: ["equipment_class", "rated_capacity"], stateVariables: ["availability", "condition"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["EQUIPPED_WITH on vehicles/facilities."] },
  { kind: "Stockpile", domain: "resources", description: "Consumable stockpile (fuel, meds, sandbags).", neo4jLabels: ["Stockpile", "Resource"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["commodity", "unit", "capacity"], stateVariables: ["quantity", "days_of_supply"], lifecyclePhases: ["active", "retired"], businessRules: ["STORED_AT Depot/Facility."] },
  { kind: "Depot", domain: "resources", description: "Logistics depot / warehouse.", neo4jLabels: ["Depot", "Resource", "Facility"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["depot_type"], stateVariables: ["throughput_status"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["STAGES resources."] },
  { kind: "ShelterCapacity", domain: "resources", description: "Bookable shelter capacity pool.", neo4jLabels: ["ShelterCapacity", "Resource"], isPhysical: false, isDeployable: true, typicalGeometry: "none", coreAttributes: ["shelter_id", "capacity_persons"], stateVariables: ["available_persons"], lifecyclePhases: ["active", "offline"], businessRules: ["ALLOCATED_TO displaced populations via decisions."] },

  { kind: "HazardType", domain: "disasters", description: "Hazard taxonomy node (flood, fire, quake).", neo4jLabels: ["HazardType", "Disaster"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["hazard_key", "severity_scale"], stateVariables: [], lifecyclePhases: ["active"], businessRules: ["Canonical keys; do not duplicate synonyms as separate kinds."] },
  { kind: "DisasterEvent", domain: "disasters", description: "Named disaster occurrence.", neo4jLabels: ["DisasterEvent", "Disaster", "Event"], isPhysical: false, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["hazard_key", "severity", "started_at"], stateVariables: ["phase", "severity", "affected_population"], lifecyclePhases: ["active", "retired"], businessRules: ["OCCURS_IN TwinScope/AdminArea; AFFECTS_ENTITY links required for cascade."] },
  { kind: "OperationalEvent", domain: "events", description: "Operational disruption event (closure, outage).", neo4jLabels: ["OperationalEvent", "Event"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["event_type", "started_at"], stateVariables: ["phase", "severity"], lifecyclePhases: ["active", "retired"], businessRules: ["Must declare termination conditions."] },
  { kind: "Incident", domain: "events", description: "Response incident record.", neo4jLabels: ["Incident", "Event", "Emergency"], isPhysical: false, isDeployable: false, typicalGeometry: "point", coreAttributes: ["incident_type", "priority"], stateVariables: ["phase", "resources_on_scene"], lifecyclePhases: ["active", "retired"], businessRules: ["Links Deployments and Decisions."] },

  { kind: "Sensor", domain: "observation", description: "Physical or virtual sensor.", neo4jLabels: ["Sensor", "Observation"], isPhysical: true, isDeployable: false, typicalGeometry: "point", coreAttributes: ["sensor_type", "observed_properties"], stateVariables: ["online", "last_seen_at"], lifecyclePhases: ["active", "offline", "retired"], businessRules: ["MEASURES entities; never invent readings."] },
  { kind: "ObservationSeries", domain: "observation", description: "Time series handle (Timescale hypertable key).", neo4jLabels: ["ObservationSeries", "Observation"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["variable", "unit", "interval"], stateVariables: ["freshness_s", "completeness"], lifecyclePhases: ["active", "retired"], businessRules: ["Points to Timescale series_id; graph holds metadata only."] },
  { kind: "Measurement", domain: "observation", description: "Single measurement event (optional graph materialization).", neo4jLabels: ["Measurement", "Observation"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["value", "unit", "observed_at"], stateVariables: ["value", "quality_flag"], lifecyclePhases: ["active", "retired"], businessRules: ["Prefer Timescale for bulk; graph for notable measurements only."] },
  { kind: "Alert", domain: "observation", description: "Threshold or agency alert.", neo4jLabels: ["Alert", "Observation"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["alert_type", "severity", "issued_at"], stateVariables: ["active", "acknowledged"], lifecyclePhases: ["active", "retired"], businessRules: ["TRIGGERS OperationalEvents/Decisions when rules fire."] },

  { kind: "TimeInterval", domain: "time", description: "Named validity / scenario interval.", neo4jLabels: ["TimeInterval", "Temporal"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["start_at", "end_at"], stateVariables: [], lifecyclePhases: ["active", "retired"], businessRules: ["end_at null means open-ended."] },
  { kind: "Epoch", domain: "time", description: "Named epoch / horizon marker.", neo4jLabels: ["Epoch", "Temporal"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["epoch_key", "instant"], stateVariables: [], lifecyclePhases: ["active"], businessRules: ["Used for current/historical/predicted state anchors."] },

  { kind: "DatasetVersion", domain: "twin_meta", description: "Immutable ingested dataset version.", neo4jLabels: ["DatasetVersion", "TwinMeta"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["dataset_key", "content_hash", "license", "storage_uri"], stateVariables: ["status"], lifecyclePhases: ["active", "retired"], businessRules: ["No twin mutation without DatasetVersion provenance."] },
  { kind: "TwinSnapshot", domain: "twin_meta", description: "Point-in-time twin state package.", neo4jLabels: ["TwinSnapshot", "TwinMeta"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["snapshot_at", "aoi_id", "content_hash"], stateVariables: ["completeness", "confidence"], lifecyclePhases: ["active", "retired"], businessRules: ["Experiments INITIALIZE from TwinSnapshot."] },
  { kind: "EntityState", domain: "twin_meta", description: "Versioned state vector for an entity.", neo4jLabels: ["EntityState", "TwinMeta"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["entity_id", "state_kind", "version"], stateVariables: ["payload", "health_score", "confidence", "risk_score"], lifecyclePhases: ["active", "retired"], businessRules: ["state_kind ∈ {current, historical, predicted, risk}."] },
  { kind: "ProvenanceRecord", domain: "twin_meta", description: "Provenance / lineage record.", neo4jLabels: ["ProvenanceRecord", "TwinMeta"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["source_id", "license", "retrieved_at"], stateVariables: [], lifecyclePhases: ["active", "retired"], businessRules: ["Attached via DERIVED_FROM / EVIDENCED_BY."] },

  { kind: "Decision", domain: "decision", description: "Recommendation object.", neo4jLabels: ["Decision", "DecisionIntel"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["objective", "status", "created_at"], stateVariables: ["confidence", "risk_score", "cost", "eta_minutes"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["Must RECOMMENDS ≥1 Action and EXPLAINS itself.", "No Decision without twin evidence links."] },
  { kind: "Action", domain: "decision", description: "Executable or recommended action.", neo4jLabels: ["Action", "DecisionIntel"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["action_type", "parameters"], stateVariables: ["status"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["ACTS_ON entities; USES_RESOURCE as needed."] },
  { kind: "ExpectedOutcome", domain: "decision", description: "Predicted outcome of a decision/experiment.", neo4jLabels: ["ExpectedOutcome", "DecisionIntel"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["metric_refs", "horizon"], stateVariables: ["expected_values", "confidence"], lifecyclePhases: ["active", "retired"], businessRules: ["Linked via EXPECTED_TO."] },
  { kind: "Explanation", domain: "decision", description: "Human-readable grounded explanation.", neo4jLabels: ["Explanation", "DecisionIntel"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["narrative", "citations"], stateVariables: [], lifecyclePhases: ["active", "retired"], businessRules: ["Citations must reference Entity/DatasetVersion/Experiment IDs."] },
  { kind: "Evaluation", domain: "decision", description: "Post-hoc evaluation of decision/experiment.", neo4jLabels: ["Evaluation", "DecisionIntel"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["method", "scores"], stateVariables: ["scores"], lifecyclePhases: ["active", "retired"], businessRules: ["COMPARED_TO baseline outcomes when available."] },

  { kind: "Experiment", domain: "experiment", description: "Digital experiment run definition.", neo4jLabels: ["Experiment", "Experimentation"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["hypothesis", "status"], stateVariables: ["progress", "confidence"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["INITIALIZES from TwinSnapshot; not a raw 'simulation job' alone."] },
  { kind: "Scenario", domain: "experiment", description: "Scenario configuration for an experiment.", neo4jLabels: ["Scenario", "Experimentation"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["variables", "assumptions"], stateVariables: [], lifecyclePhases: ["active", "retired"], businessRules: ["Assumptions must be explicit; no hidden fake data."] },
  { kind: "ExperimentResult", domain: "experiment", description: "Result package of an experiment.", neo4jLabels: ["ExperimentResult", "Experimentation"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["metrics", "artifacts_uri"], stateVariables: ["confidence"], lifecyclePhases: ["active", "retired"], businessRules: ["PRODUCES_RESULT from Experiment."] },
  { kind: "MetricDefinition", domain: "experiment", description: "Canonical metric definition.", neo4jLabels: ["MetricDefinition", "Experimentation"], isPhysical: false, isDeployable: false, typicalGeometry: "none", coreAttributes: ["metric_key", "unit", "aggregation"], stateVariables: [], lifecyclePhases: ["active", "retired"], businessRules: ["metric_key globally unique."] },

  { kind: "Campus", domain: "spatial", description: "Campus-scale twin scope (university, hospital campus).", neo4jLabels: ["Campus", "Spatial", "TwinScope"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["campus_type"], stateVariables: ["operational_status"], lifecyclePhases: ["active", "retired"], businessRules: ["Specialization of TwinScope for non-city scopes."] },
  { kind: "MilitaryBase", domain: "security", description: "Military base twin scope (restricted).", neo4jLabels: ["MilitaryBase", "Security", "Campus"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["classification"], stateVariables: ["alert_condition"], lifecyclePhases: ["active", "retired"], businessRules: ["Data classification enforced; public OSM insufficient."] },
  { kind: "SmartDistrict", domain: "spatial", description: "Smart district / future smart-nation subunit.", neo4jLabels: ["SmartDistrict", "Spatial", "TwinScope"], isPhysical: true, isDeployable: false, typicalGeometry: "polygon", coreAttributes: ["program_name"], stateVariables: ["digital_maturity"], lifecyclePhases: ["planned", "active", "retired"], businessRules: ["Extensibility hook for national-scale composition."] },
];

export function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}

export function specForEntityKind(kind: EntityKind): EntityKindSpec {
  const found = ENTITY_KIND_SPECS.find((s) => s.kind === kind);
  if (!found) {
    throw new Error(`Missing EntityKindSpec for ${kind}`);
  }
  return found;
}

/**
 * Compatibility map from Milestone 1 coarse AssetType → EntityKind.
 * Do not add new AssetType values; extend EntityKind instead.
 */
export const ASSET_TYPE_TO_ENTITY_KIND = {
  road: "RoadSegment",
  building: "Building",
  hospital: "Hospital",
  school: "School",
  police_station: "PoliceStation",
  fire_station: "FireStation",
  admin_boundary: "AdminArea",
  population_cell: "PopulationCell",
  elevation_tile: "ElevationTile",
  drainage: "StormDrain",
  waterway: "Waterway",
  weather_station: "WeatherStation",
  aqi_station: "AirQualityStation",
  metro_line: "TransitRoute",
  transit_stop: "TransitStop",
  railway: "RailwaySegment",
  airport: "Airport",
  utility_node: "UtilityServicePoint",
  utility_link: "PowerLine",
  flood_zone: "Floodplain",
  land_use_cell: "LandCoverCell",
  imagery_scene: "DatasetVersion",
  disaster_event: "DisasterEvent",
  traffic_segment: "TrafficSegment",
  unknown: "CriticalInfrastructureNode",
} as const;
