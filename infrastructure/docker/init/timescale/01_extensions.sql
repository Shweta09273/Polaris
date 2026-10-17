-- POLARIS TimescaleDB bootstrap
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS obs;

COMMENT ON SCHEMA obs IS 'Observation time series (weather, AQI, discharge, sensors)';
