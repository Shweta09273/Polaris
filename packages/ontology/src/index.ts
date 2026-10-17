/**
 * @polaris/ontology — Urban Ontology single source of truth.
 *
 * Consumed by: PostGIS schemas, Neo4j labels/rels, APIs, future AI & simulation.
 * Does not execute simulation or ML.
 */

export * from "./domains.js";
export * from "./entities.js";
export * from "./relationships.js";
export * from "./state.js";
export * from "./events.js";
export * from "./resources.js";
export * from "./decisions.js";
export * from "./experiments.js";

export const ONTOLOGY_VERSION = "1.0.0" as const;
export const ONTOLOGY_NAME = "POLARIS Urban Ontology" as const;
