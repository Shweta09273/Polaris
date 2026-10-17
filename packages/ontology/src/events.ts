/**
 * Event model — operational and disaster events with propagation semantics.
 */

export const EVENT_TYPES = [
  "rain",
  "flood",
  "flash_flood",
  "fire",
  "wildfire",
  "power_failure",
  "road_closure",
  "accident",
  "earthquake",
  "heatwave",
  "cold_wave",
  "storm",
  "landslide",
  "communication_failure",
  "water_outage",
  "gas_leak",
  "hazardous_spill",
  "crowd_surge",
  "cyber_disruption",
  "construction_disruption",
  "epidemic_alert",
  "air_quality_emergency",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventPhase = "forecast" | "onset" | "peak" | "ongoing" | "recovery" | "closed";

export interface PropagationRule {
  readonly id: string;
  readonly description: string;
  readonly fromRelation: string;
  readonly maxHops: number;
  readonly attenuates: boolean;
  readonly affectedKinds: readonly string[];
}

export interface EventTypeSpec {
  readonly eventType: EventType;
  readonly description: string;
  readonly typicalInputs: readonly string[];
  readonly typicalOutputs: readonly string[];
  readonly primaryAffectedKinds: readonly string[];
  readonly propagationRules: readonly PropagationRule[];
  readonly terminationConditions: readonly string[];
}

export const EVENT_TYPE_SPECS: readonly EventTypeSpec[] = [
  {
    eventType: "rain",
    description: "Precipitation event over an AOI.",
    typicalInputs: ["precip_mm_h", "duration_h", "radar_obs", "forecast_model"],
    typicalOutputs: ["soil_moisture_delta", "runoff_index", "visibility_reduction"],
    primaryAffectedKinds: ["DrainageBasin", "RoadSegment", "Waterway", "PopulationCell"],
    propagationRules: [
      { id: "rain-to-basin", description: "Rain increases basin runoff.", fromRelation: "OCCURS_IN", maxHops: 1, attenuates: false, affectedKinds: ["DrainageBasin"] },
      { id: "rain-to-drain", description: "Runoff loads storm network.", fromRelation: "CONTAINS", maxHops: 2, attenuates: true, affectedKinds: ["StormDrain", "SewerSegment"] },
    ],
    terminationConditions: ["precip_mm_h below threshold for N hours", "forecast ends", "operator close"],
  },
  {
    eventType: "flood",
    description: "Inundation / riverine / urban flood.",
    typicalInputs: ["discharge_m3s", "stage_m", "dem", "floodplain", "pump_status"],
    typicalOutputs: ["inundation_depth_m", "road_impassability", "facility_access_loss"],
    primaryAffectedKinds: ["Floodplain", "RoadSegment", "Building", "Hospital", "PumpStation", "PopulationCell"],
    propagationRules: [
      { id: "flood-blocks-roads", description: "Inundated roads become blocked.", fromRelation: "AFFECTS_ENTITY", maxHops: 1, attenuates: false, affectedKinds: ["RoadSegment"] },
      { id: "flood-cascades-access", description: "Blocked roads reduce facility access.", fromRelation: "BLOCKS", maxHops: 3, attenuates: true, affectedKinds: ["Hospital", "FireStation", "Shelter"] },
      { id: "flood-power", description: "Substations in inundation may fail.", fromRelation: "OVERLAPS", maxHops: 2, attenuates: true, affectedKinds: ["Substation", "PowerTransformer"] },
    ],
    terminationConditions: ["stage below flood threshold", "inundation depth ~0", "all-clear issued"],
  },
  {
    eventType: "flash_flood",
    description: "Rapid-onset urban/flash flood.",
    typicalInputs: ["high_intensity_rain", "impervious_ratio", "drain_capacity"],
    typicalOutputs: ["localized_inundation", "trap_hazards"],
    primaryAffectedKinds: ["StormDrain", "RoadSegment", "PopulationCell"],
    propagationRules: [
      { id: "flash-blocks", description: "Local road/drain failure.", fromRelation: "AFFECTS_ENTITY", maxHops: 2, attenuates: true, affectedKinds: ["RoadSegment", "StormDrain"] },
    ],
    terminationConditions: ["rainfall cessation + drain recovery", "incident closed"],
  },
  {
    eventType: "fire",
    description: "Structural fire incident.",
    typicalInputs: ["incident_report", "building_use", "wind", "hydrant_status"],
    typicalOutputs: ["structure_damage", "road_closure", "casualty_demand"],
    primaryAffectedKinds: ["Building", "RoadSegment", "FireStation", "Hospital"],
    propagationRules: [
      { id: "fire-blocks-access", description: "Scene perimeter blocks roads.", fromRelation: "BLOCKS", maxHops: 1, attenuates: false, affectedKinds: ["RoadSegment"] },
      { id: "fire-demand-ems", description: "Increases EMS/hospital demand.", fromRelation: "AFFECTS", maxHops: 2, attenuates: true, affectedKinds: ["Hospital", "AmbulanceStation"] },
    ],
    terminationConditions: ["fire under control", "overhaul complete", "incident closed"],
  },
  {
    eventType: "wildfire",
    description: "Vegetation wildfire.",
    typicalInputs: ["fire_danger_index", "wind", "fuel_load", "ignition"],
    typicalOutputs: ["burn_scar", "air_quality", "evacuations"],
    primaryAffectedKinds: ["ForestStand", "Building", "RoadSegment", "AirQualityStation", "PopulationCell"],
    propagationRules: [
      { id: "wildfire-aqi", description: "Smoke degrades AQI.", fromRelation: "AFFECTS", maxHops: 2, attenuates: true, affectedKinds: ["AirQualityStation", "PopulationCell"] },
      { id: "wildfire-evac", description: "Triggers sheltering/evacuation decisions.", fromRelation: "TRIGGERS", maxHops: 1, attenuates: false, affectedKinds: ["Incident", "Shelter"] },
    ],
    terminationConditions: ["containment % threshold", "extinguished", "agency close"],
  },
  {
    eventType: "power_failure",
    description: "Electrical outage.",
    typicalInputs: ["fault_location", "feeder_id", "load", "weather"],
    typicalOutputs: ["unpowered_customers", "facility_degradation", "comm_loss_risk"],
    primaryAffectedKinds: ["Substation", "PowerLine", "Building", "Hospital", "TelecomTower", "PumpStation"],
    propagationRules: [
      { id: "outage-downstream", description: "De-energize downstream network.", fromRelation: "POWERS", maxHops: 6, attenuates: false, affectedKinds: ["Building", "Facility", "PumpStation"] },
      { id: "outage-to-water", description: "Pumps offline reduce water/drainage.", fromRelation: "DEPENDS_ON", maxHops: 2, attenuates: false, affectedKinds: ["PumpStation", "WaterTreatmentPlant"] },
      { id: "outage-to-comms", description: "Towers/sites lose power.", fromRelation: "DEPENDS_ON", maxHops: 2, attenuates: true, affectedKinds: ["TelecomTower", "RadioSite", "DataCenter"] },
    ],
    terminationConditions: ["circuit restored", "backup power stable", "operator close"],
  },
  {
    eventType: "road_closure",
    description: "Planned or unplanned road closure.",
    typicalInputs: ["segment_id", "reason", "detour_policy"],
    typicalOutputs: ["impedance_increase", "access_loss"],
    primaryAffectedKinds: ["RoadSegment", "TransitRoute", "Facility"],
    propagationRules: [
      { id: "closure-blocks", description: "Segment blocked.", fromRelation: "BLOCKS", maxHops: 1, attenuates: false, affectedKinds: ["RoadSegment"] },
      { id: "closure-access", description: "Facilities lose primary access path.", fromRelation: "SERVES", maxHops: 3, attenuates: true, affectedKinds: ["Hospital", "FireStation", "School"] },
    ],
    terminationConditions: ["reopened", "scheduled end", "incident closed"],
  },
  {
    eventType: "accident",
    description: "Traffic or industrial accident.",
    typicalInputs: ["location", "severity", "vehicles_involved"],
    typicalOutputs: ["casualties", "closure", "hazmat_flag"],
    primaryAffectedKinds: ["RoadSegment", "Hospital", "PoliceStation", "FireStation"],
    propagationRules: [
      { id: "accident-closure", description: "May trigger road_closure.", fromRelation: "TRIGGERS", maxHops: 1, attenuates: false, affectedKinds: ["OperationalEvent"] },
    ],
    terminationConditions: ["scene cleared", "patients transported", "incident closed"],
  },
  {
    eventType: "earthquake",
    description: "Seismic event.",
    typicalInputs: ["magnitude", "depth_km", "epicenter", "shakemap"],
    typicalOutputs: ["damage_estimates", "bridge_inspection_flags", "cascading_outages"],
    primaryAffectedKinds: ["Building", "Bridge", "Tunnel", "Substation", "PopulationCell"],
    propagationRules: [
      { id: "quake-struct", description: "Structural damage risk to buildings/bridges.", fromRelation: "AFFECTS_ENTITY", maxHops: 1, attenuates: true, affectedKinds: ["Building", "Bridge", "Tunnel"] },
      { id: "quake-energy", description: "Possible power faults.", fromRelation: "CASCADES_TO", maxHops: 3, attenuates: true, affectedKinds: ["Substation", "PowerLine"] },
    ],
    terminationConditions: ["aftershock window policy met", "inspections complete", "EOC deactivate"],
  },
  {
    eventType: "heatwave",
    description: "Extreme heat period.",
    typicalInputs: ["temp_c", "duration_h", "humidity"],
    typicalOutputs: ["heat_health_risk", "grid_load", "water_demand"],
    primaryAffectedKinds: ["PopulationCell", "Hospital", "PowerLine", "WaterMain"],
    propagationRules: [
      { id: "heat-health", description: "Elevates hospital demand.", fromRelation: "AFFECTS", maxHops: 2, attenuates: true, affectedKinds: ["Hospital", "Clinic"] },
      { id: "heat-grid", description: "Increases electrical load risk.", fromRelation: "AFFECTS", maxHops: 2, attenuates: true, affectedKinds: ["Substation", "PowerLine"] },
    ],
    terminationConditions: ["temps below threshold for N days", "advisory cancelled"],
  },
  {
    eventType: "communication_failure",
    description: "Telecom / radio network failure.",
    typicalInputs: ["site_ids", "link_status", "power_status"],
    typicalOutputs: ["coverage_holes", "command_net_degradation"],
    primaryAffectedKinds: ["TelecomTower", "FiberSegment", "RadioSite", "EmergencyOperationsCenter"],
    propagationRules: [
      { id: "comms-downstream", description: "Loss propagates across TRANSMITS links.", fromRelation: "TRANSMITS", maxHops: 4, attenuates: false, affectedKinds: ["Facility", "Agency"] },
    ],
    terminationConditions: ["links restored", "failover verified", "incident closed"],
  },
  {
    eventType: "water_outage",
    description: "Potable water service interruption.",
    typicalInputs: ["main_break", "plant_outage", "contamination_flag"],
    typicalOutputs: ["unserved_demand", "hospital_risk", "boil_water"],
    primaryAffectedKinds: ["WaterMain", "Building", "Hospital", "PopulationCell"],
    propagationRules: [
      { id: "water-supply-loss", description: "Downstream SUPPLIES edges fail.", fromRelation: "SUPPLIES", maxHops: 5, attenuates: false, affectedKinds: ["Building", "Facility"] },
    ],
    terminationConditions: ["pressure restored", "advisory lifted"],
  },
  {
    eventType: "storm",
    description: "Severe storm (wind/rain/lightning).",
    typicalInputs: ["wind_ms", "precip", "warnings"],
    typicalOutputs: ["debris", "outages", "flood_risk"],
    primaryAffectedKinds: ["RoadSegment", "PowerLine", "Building", "Airport"],
    propagationRules: [
      { id: "storm-triggers", description: "May trigger power_failure and flood.", fromRelation: "TRIGGERS", maxHops: 1, attenuates: false, affectedKinds: ["OperationalEvent", "DisasterEvent"] },
    ],
    terminationConditions: ["warning expired", "damage assessments done"],
  },
  {
    eventType: "landslide",
    description: "Slope failure event.",
    typicalInputs: ["slope", "rainfall_history", "geology"],
    typicalOutputs: ["road_rail_blockage", "building_damage"],
    primaryAffectedKinds: ["RoadSegment", "RailwaySegment", "Building", "GeologicalUnit"],
    propagationRules: [
      { id: "slide-blocks", description: "Blocks transport corridors.", fromRelation: "BLOCKS", maxHops: 1, attenuates: false, affectedKinds: ["RoadSegment", "RailwaySegment"] },
    ],
    terminationConditions: ["corridor cleared/stabilized", "incident closed"],
  },
  {
    eventType: "gas_leak",
    description: "Natural gas leak / rupture.",
    typicalInputs: ["sensor_alarm", "odor_reports", "pipe_id"],
    typicalOutputs: ["evacuation_zone", "ignition_risk", "road_closure"],
    primaryAffectedKinds: ["Building", "RoadSegment", "PopulationCell", "FireStation"],
    propagationRules: [
      { id: "gas-evac", description: "Creates security/emergency perimeter.", fromRelation: "TRIGGERS", maxHops: 1, attenuates: false, affectedKinds: ["SecurityPerimeter", "Incident"] },
    ],
    terminationConditions: ["leak secured", "atmosphere clear", "re-entry allowed"],
  },
  {
    eventType: "hazardous_spill",
    description: "HAZMAT spill.",
    typicalInputs: ["material", "volume", "weather", "drainage_path"],
    typicalOutputs: ["exclusion_zone", "water_contamination_risk"],
    primaryAffectedKinds: ["RoadSegment", "Waterway", "PopulationCell", "WasteFacility"],
    propagationRules: [
      { id: "spill-drain", description: "May enter drainage network.", fromRelation: "DRAINS_INTO", maxHops: 4, attenuates: true, affectedKinds: ["StormDrain", "Waterway", "Waterbody"] },
    ],
    terminationConditions: ["contained", "remediation complete"],
  },
  {
    eventType: "crowd_surge",
    description: "Dangerous crowd density event.",
    typicalInputs: ["density", "venue", "ingress_egress"],
    typicalOutputs: ["injury_risk", "transport_surge"],
    primaryAffectedKinds: ["Facility", "TransitStop", "RoadSegment", "Hospital"],
    propagationRules: [
      { id: "crowd-ems", description: "Increases EMS demand.", fromRelation: "AFFECTS", maxHops: 2, attenuates: true, affectedKinds: ["Hospital", "AmbulanceStation"] },
    ],
    terminationConditions: ["density normalized", "event ended"],
  },
  {
    eventType: "cyber_disruption",
    description: "Cyber impact on OT/IT controlling infrastructure.",
    typicalInputs: ["affected_systems", "severity"],
    typicalOutputs: ["loss_of_view", "loss_of_control", "degraded_automation"],
    primaryAffectedKinds: ["DataCenter", "Substation", "EmergencyOperationsCenter", "PumpStation"],
    propagationRules: [
      { id: "cyber-control", description: "CONTROLLED_BY systems lose integrity.", fromRelation: "CONTROLLED_BY", maxHops: 2, attenuates: false, affectedKinds: ["Substation", "PumpStation"] },
    ],
    terminationConditions: ["systems restored", "integrity verified"],
  },
  {
    eventType: "construction_disruption",
    description: "Construction-driven operational disruption.",
    typicalInputs: ["work_zone_id", "lane_impacts", "schedule"],
    typicalOutputs: ["capacity_loss", "noise", "access_changes"],
    primaryAffectedKinds: ["WorkZone", "RoadSegment", "TransitRoute"],
    propagationRules: [
      { id: "construction-blocks", description: "Work zone blocks or constrains segments.", fromRelation: "BLOCKS", maxHops: 1, attenuates: false, affectedKinds: ["RoadSegment"] },
    ],
    terminationConditions: ["work complete", "zone demobilized"],
  },
  {
    eventType: "epidemic_alert",
    description: "Public health epidemic alert.",
    typicalInputs: ["case_rates", "policy", "hospital_occupancy"],
    typicalOutputs: ["facility_load", "school_status", "mobility_constraints"],
    primaryAffectedKinds: ["Hospital", "Clinic", "School", "PopulationCell"],
    propagationRules: [
      { id: "epidemic-policy", description: "May activate PolicyInstruments.", fromRelation: "TRIGGERS", maxHops: 1, attenuates: false, affectedKinds: ["PolicyInstrument", "EmergencyPlan"] },
    ],
    terminationConditions: ["alert level downgraded", "authority close"],
  },
  {
    eventType: "air_quality_emergency",
    description: "Hazardous air quality episode.",
    typicalInputs: ["aqi", "pm25", "source_events"],
    typicalOutputs: ["health_advisories", "outdoor_activity_limits"],
    primaryAffectedKinds: ["AirQualityStation", "PopulationCell", "School", "Hospital"],
    propagationRules: [
      { id: "aqi-health", description: "Affects sensitive populations and schools.", fromRelation: "AFFECTS", maxHops: 2, attenuates: true, affectedKinds: ["School", "Hospital", "PopulationCell"] },
    ],
    terminationConditions: ["AQI below threshold for N hours", "advisory cancelled"],
  },
  {
    eventType: "cold_wave",
    description: "Extreme cold period.",
    typicalInputs: ["temp_c", "duration_h"],
    typicalOutputs: ["shelter_demand", "pipe_freeze_risk", "grid_load"],
    primaryAffectedKinds: ["PopulationCell", "Shelter", "WaterMain", "Hospital"],
    propagationRules: [
      { id: "cold-shelter", description: "Increases shelter demand.", fromRelation: "AFFECTS", maxHops: 2, attenuates: true, affectedKinds: ["Shelter", "Hospital"] },
    ],
    terminationConditions: ["temps above threshold", "advisory cancelled"],
  },
];

export interface EventInstance {
  readonly id: string;
  readonly eventType: EventType;
  readonly phase: EventPhase;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly twinScopeId: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly affectedEntityIds: readonly string[];
  readonly confidence: number;
  readonly datasetVersionIds: readonly string[];
}
