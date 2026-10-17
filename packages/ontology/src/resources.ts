/**
 * Resource model — deployable capacity for response and operations.
 */

export const RESOURCE_CLASSES = [
  "ambulance",
  "fire_engine",
  "fire_ladder",
  "rescue_truck",
  "police_unit",
  "mobile_command",
  "pump",
  "generator",
  "water_tanker",
  "sandbag_stock",
  "medical_team",
  "engineering_team",
  "shelter_bed",
  "fuel",
  "boat",
  "drone",
  "heavy_equipment",
  "comms_kit",
  "field_hospital_module",
] as const;

export type ResourceClass = (typeof RESOURCE_CLASSES)[number];

export type AvailabilityState =
  | "available"
  | "reserved"
  | "deployed"
  | "maintenance"
  | "out_of_service"
  | "unknown";

export interface ResourceCapacity {
  readonly amount: number;
  readonly unit: string;
  readonly usable: number;
}

export interface ResourceScheduleWindow {
  readonly startAt: string;
  readonly endAt: string;
  readonly state: AvailabilityState;
  readonly assignmentId?: string;
}

export interface ResourceDeployment {
  readonly id: string;
  readonly resourceId: string;
  readonly targetId: string; // Incident | Facility | TwinScope location
  readonly deployedAt: string;
  readonly etaMinutes?: number;
  readonly status: "en_route" | "on_scene" | "returning" | "completed" | "cancelled";
  readonly crewId?: string;
}

export interface ResourceSpec {
  readonly resourceClass: ResourceClass;
  readonly description: string;
  readonly defaultEntityKind: "VehicleResource" | "Crew" | "EquipmentItem" | "Stockpile" | "ShelterCapacity";
  readonly capacityUnit: string;
  readonly requiresCrew: boolean;
  readonly consumable: boolean;
}

export const RESOURCE_SPECS: readonly ResourceSpec[] = [
  { resourceClass: "ambulance", description: "EMS ambulance.", defaultEntityKind: "VehicleResource", capacityUnit: "patients", requiresCrew: true, consumable: false },
  { resourceClass: "fire_engine", description: "Fire engine / pumper.", defaultEntityKind: "VehicleResource", capacityUnit: "units", requiresCrew: true, consumable: false },
  { resourceClass: "fire_ladder", description: "Aerial ladder truck.", defaultEntityKind: "VehicleResource", capacityUnit: "units", requiresCrew: true, consumable: false },
  { resourceClass: "rescue_truck", description: "Technical rescue apparatus.", defaultEntityKind: "VehicleResource", capacityUnit: "units", requiresCrew: true, consumable: false },
  { resourceClass: "police_unit", description: "Police patrol/response unit.", defaultEntityKind: "VehicleResource", capacityUnit: "units", requiresCrew: true, consumable: false },
  { resourceClass: "mobile_command", description: "Mobile command vehicle.", defaultEntityKind: "VehicleResource", capacityUnit: "units", requiresCrew: true, consumable: false },
  { resourceClass: "pump", description: "Portable/mobile pump.", defaultEntityKind: "EquipmentItem", capacityUnit: "m3/s", requiresCrew: true, consumable: false },
  { resourceClass: "generator", description: "Portable generator.", defaultEntityKind: "EquipmentItem", capacityUnit: "kW", requiresCrew: false, consumable: false },
  { resourceClass: "water_tanker", description: "Water tanker truck.", defaultEntityKind: "VehicleResource", capacityUnit: "liters", requiresCrew: true, consumable: false },
  { resourceClass: "sandbag_stock", description: "Sandbag stockpile.", defaultEntityKind: "Stockpile", capacityUnit: "bags", requiresCrew: false, consumable: true },
  { resourceClass: "medical_team", description: "Deployable medical team.", defaultEntityKind: "Crew", capacityUnit: "persons", requiresCrew: false, consumable: false },
  { resourceClass: "engineering_team", description: "Public works / engineering crew.", defaultEntityKind: "Crew", capacityUnit: "persons", requiresCrew: false, consumable: false },
  { resourceClass: "shelter_bed", description: "Shelter sleeping capacity.", defaultEntityKind: "ShelterCapacity", capacityUnit: "beds", requiresCrew: false, consumable: false },
  { resourceClass: "fuel", description: "Fuel commodity stock.", defaultEntityKind: "Stockpile", capacityUnit: "liters", requiresCrew: false, consumable: true },
  { resourceClass: "boat", description: "Rescue/utility boat.", defaultEntityKind: "VehicleResource", capacityUnit: "persons", requiresCrew: true, consumable: false },
  { resourceClass: "drone", description: "UAV reconnaissance asset.", defaultEntityKind: "EquipmentItem", capacityUnit: "units", requiresCrew: true, consumable: false },
  { resourceClass: "heavy_equipment", description: "Excavator/loader/crane class.", defaultEntityKind: "VehicleResource", capacityUnit: "units", requiresCrew: true, consumable: false },
  { resourceClass: "comms_kit", description: "Portable communications kit.", defaultEntityKind: "EquipmentItem", capacityUnit: "units", requiresCrew: false, consumable: false },
  { resourceClass: "field_hospital_module", description: "Deployable field hospital module.", defaultEntityKind: "EquipmentItem", capacityUnit: "beds", requiresCrew: true, consumable: false },
];

export const RESOURCE_BUSINESS_RULES = [
  "Availability transitions are auditable; unknown is explicit, not null.",
  "Deployments reference real Incidents/Facilities — never synthetic scenes.",
  "Consumables decrement Stockpile.quantity via CONSUMES edges.",
  "Scheduling windows must not overlap in conflicting states for the same resource.",
  "Crew entities contain no PII — only operational unit identifiers.",
] as const;
