// POLARIS Knowledge Graph — indexes
// Ontology version: 1.0.0

CREATE INDEX entity_kind IF NOT EXISTS FOR (n:Entity) ON (n.entity_kind);
CREATE INDEX entity_aoi IF NOT EXISTS FOR (n:Entity) ON (n.aoi_id);
CREATE INDEX entity_lifecycle IF NOT EXISTS FOR (n:Entity) ON (n.lifecycle_phase);
CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name);

CREATE INDEX road_open_status IF NOT EXISTS FOR (n:RoadSegment) ON (n.open_status);
CREATE INDEX hospital_divert IF NOT EXISTS FOR (n:Hospital) ON (n.divert_status);
CREATE INDEX building_use IF NOT EXISTS FOR (n:Building) ON (n.use_class);

CREATE INDEX event_type IF NOT EXISTS FOR (n:OperationalEvent) ON (n.event_type);
CREATE INDEX disaster_hazard IF NOT EXISTS FOR (n:DisasterEvent) ON (n.hazard_key);
CREATE INDEX incident_phase IF NOT EXISTS FOR (n:Incident) ON (n.phase);

CREATE INDEX resource_class IF NOT EXISTS FOR (n:ResourceAsset) ON (n.resource_class);
CREATE INDEX resource_availability IF NOT EXISTS FOR (n:ResourceAsset) ON (n.availability);
CREATE INDEX vehicle_availability IF NOT EXISTS FOR (n:VehicleResource) ON (n.availability);

CREATE INDEX decision_status IF NOT EXISTS FOR (n:Decision) ON (n.status);
CREATE INDEX experiment_status IF NOT EXISTS FOR (n:Experiment) ON (n.status);

CREATE INDEX state_kind IF NOT EXISTS FOR (n:EntityState) ON (n.state_kind);
CREATE INDEX state_entity IF NOT EXISTS FOR (n:EntityState) ON (n.entity_id);

CREATE INDEX obs_series_variable IF NOT EXISTS FOR (n:ObservationSeries) ON (n.variable);
CREATE INDEX alert_active IF NOT EXISTS FOR (n:Alert) ON (n.active);
