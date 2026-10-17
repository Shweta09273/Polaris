# Entity Dictionary

**Canonical source:** `packages/ontology/src/entities.ts` (`ENTITY_KINDS`, `ENTITY_KIND_SPECS`)  
**Rule:** Never create a parallel name for the same concept.

---

## Naming

- PascalCase kind names
- Neo4j label = kind name
- PostGIS `entity_kind` = kind name string

---

## Dictionary (by domain)

### spatial / twin_meta / administrative

| Kind | Description | Geometry |
|---|---|---|
| TwinScope | AOI twin boundary | polygon |
| Campus | Campus-scale twin scope | polygon |
| SmartDistrict | Smart district / nation subunit | polygon |
| AdminArea | Administrative jurisdiction | multipolygon |
| Parcel | Cadastral parcel | polygon |
| DatasetVersion | Immutable ingest version | none |
| TwinSnapshot | Point-in-time twin package | none |
| EntityState | Versioned state vector | none |
| ProvenanceRecord | Lineage record | none |
| TimeInterval | Validity / scenario interval | none |
| Epoch | Named temporal anchor | none |

### transportation

| Kind | Description |
|---|---|
| RoadSegment, RoadNode, Bridge, Tunnel | Road network |
| RailwaySegment, RailwayStation | Rail |
| TransitRoute, TransitStop, TransitVehicle | Public transit |
| Airport, Runway | Aviation |
| Seaport, PortTerminal | Maritime |
| TrafficSegment | ITS traffic observation segment |
| ParkingFacility | Parking |

### buildings / land_use

| Kind | Description |
|---|---|
| Building, BuildingPart, Facility, Floor | Structures |
| LandUseZone, LandCoverCell | Use / cover |

### healthcare / education / emergency / security / public_services

| Kind | Description |
|---|---|
| Hospital, Clinic, Pharmacy | Healthcare |
| School, UniversityCampus | Education |
| FireStation, AmbulanceStation, Shelter, EmergencyOperationsCenter | Emergency |
| PoliceStation, SecurityPerimeter, MilitaryBase | Security |
| PublicServiceCenter | Civic services |

### energy / water / drainage / waste / utilities / communication

| Kind | Description |
|---|---|
| PowerPlant, Substation, PowerLine, PowerTransformer, FuelDepot | Energy |
| WaterTreatmentPlant, WaterReservoir, WaterMain, PumpStation | Water |
| DrainageBasin, StormDrain, SewerSegment, Outfall | Drainage |
| WasteFacility | Waste |
| UtilityServicePoint | Utility customer/service node |
| TelecomTower, FiberSegment, RadioSite, DataCenter | Communications |

### environment / weather / climate / natural / disasters

| Kind | Description |
|---|---|
| AirQualityStation | Environment monitoring |
| WeatherStation | Weather |
| ClimateZone | Climate region |
| ElevationTile, Waterbody, Waterway, Coastline, ForestStand, Wetland, GeologicalUnit | Natural features |
| Floodplain, HazardType, DisasterEvent | Hazards / disasters |

### population / economy / government / policy / infrastructure / construction

| Kind | Description |
|---|---|
| PopulationCell, HouseholdCluster, DemographicSegment | Population (no PII) |
| EmploymentCenter, IndustrialPark, MarketNode, Organization | Economy |
| Agency, GovernmentBody | Government |
| PolicyInstrument, ZoningOrdinance, EmergencyPlan, Permit | Policy |
| CriticalInfrastructureNode, Corridor | Infrastructure |
| ConstructionProject, WorkZone | Construction |

### resources / events / observation / decision / experiment

| Kind | Description |
|---|---|
| ResourceAsset, VehicleResource, Crew, EquipmentItem, Stockpile, Depot, ShelterCapacity | Resources |
| OperationalEvent, Incident | Events |
| Sensor, ObservationSeries, Measurement, Alert | Observation |
| Decision, Action, ExpectedOutcome, Explanation, Evaluation | Decision |
| Experiment, Scenario, ExperimentResult, MetricDefinition | Experiment |

---

## Milestone 1 AssetType mapping

| AssetType (legacy) | EntityKind |
|---|---|
| road | RoadSegment |
| building | Building |
| hospital | Hospital |
| school | School |
| police_station | PoliceStation |
| fire_station | FireStation |
| admin_boundary | AdminArea |
| population_cell | PopulationCell |
| elevation_tile | ElevationTile |
| drainage | StormDrain |
| waterway | Waterway |
| weather_station | WeatherStation |
| aqi_station | AirQualityStation |
| metro_line | TransitRoute |
| transit_stop | TransitStop |
| railway | RailwaySegment |
| airport | Airport |
| utility_node | UtilityServicePoint |
| utility_link | PowerLine |
| flood_zone | Floodplain |
| land_use_cell | LandCoverCell |
| imagery_scene | DatasetVersion |
| disaster_event | DisasterEvent |
| traffic_segment | TrafficSegment |

Do **not** extend `AssetType`. Extend `EntityKind` only.

---

## Attribute & state reference

Each kind’s `coreAttributes`, `stateVariables`, `lifecyclePhases`, and `businessRules` are authoritative in `ENTITY_KIND_SPECS`. Common attributes: `id`, `aoi_id`, `name`, `external_ids`, `lifecycle_phase`, `dataset_version_id`, `confidence`, `health_score`, `version`, validity stamps.
