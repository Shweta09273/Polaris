-- POLARIS PostGIS bootstrap
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS twin;
CREATE SCHEMA IF NOT EXISTS ingest;
CREATE SCHEMA IF NOT EXISTS iam;

COMMENT ON SCHEMA catalog IS 'Dataset versions, provenance, licenses';
COMMENT ON SCHEMA twin IS 'Canonical twin assets and networks';
COMMENT ON SCHEMA ingest IS 'Ingestion job state and quarantine';
COMMENT ON SCHEMA iam IS 'Local IAM projections (source of truth is IdP)';
