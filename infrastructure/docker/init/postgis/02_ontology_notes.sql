-- Twin registry entity kind check (ontology v1.0.0)
-- Full enum is maintained in @polaris/ontology ENTITY_KINDS.
-- This comment migration placeholder documents the PostGIS binding.

-- ALTER TABLE twin.entities
--   ADD COLUMN IF NOT EXISTS entity_kind text NOT NULL;
-- CREATE INDEX IF NOT EXISTS entities_entity_kind_idx ON twin.entities (entity_kind);
