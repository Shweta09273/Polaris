import assert from "node:assert/strict";
import test from "node:test";
import {
  ENTITY_KINDS,
  ENTITY_KIND_SPECS,
  RELATION_TYPES,
  RELATION_SPECS,
  ASSET_TYPE_TO_ENTITY_KIND,
  isEntityKind,
  URBAN_DOMAINS,
} from "./index.js";

test("every EntityKind has exactly one spec", () => {
  assert.equal(ENTITY_KIND_SPECS.length, ENTITY_KINDS.length);
  const kinds = new Set(ENTITY_KIND_SPECS.map((s) => s.kind));
  assert.equal(kinds.size, ENTITY_KINDS.length);
  for (const kind of ENTITY_KINDS) {
    assert.equal(kinds.has(kind), true, `missing spec for ${kind}`);
  }
});

test("every RelationType has exactly one spec", () => {
  assert.equal(RELATION_SPECS.length, RELATION_TYPES.length);
  const types = new Set(RELATION_SPECS.map((s) => s.type));
  assert.equal(types.size, RELATION_TYPES.length);
});

test("AssetType mapping targets known EntityKinds", () => {
  for (const kind of Object.values(ASSET_TYPE_TO_ENTITY_KIND)) {
    assert.equal(isEntityKind(kind), true, `unknown mapped kind ${kind}`);
  }
});

test("urban domains are non-empty", () => {
  assert.ok(URBAN_DOMAINS.length >= 20);
});
