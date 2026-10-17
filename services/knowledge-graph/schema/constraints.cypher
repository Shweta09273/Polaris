// POLARIS Knowledge Graph — constraints
// Ontology version: 1.0.0
// Apply against Neo4j 5.x

CREATE CONSTRAINT entity_id IF NOT EXISTS
FOR (n:Entity) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT twin_scope_id IF NOT EXISTS
FOR (n:TwinScope) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT admin_area_id IF NOT EXISTS
FOR (n:AdminArea) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT dataset_version_id IF NOT EXISTS
FOR (n:DatasetVersion) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT twin_snapshot_id IF NOT EXISTS
FOR (n:TwinSnapshot) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT entity_state_id IF NOT EXISTS
FOR (n:EntityState) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT decision_id IF NOT EXISTS
FOR (n:Decision) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT experiment_id IF NOT EXISTS
FOR (n:Experiment) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT incident_id IF NOT EXISTS
FOR (n:Incident) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT metric_key IF NOT EXISTS
FOR (n:MetricDefinition) REQUIRE n.metric_key IS UNIQUE;

CREATE CONSTRAINT hazard_key IF NOT EXISTS
FOR (n:HazardType) REQUIRE n.hazard_key IS UNIQUE;
