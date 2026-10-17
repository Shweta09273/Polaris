import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packCity, verifyPackageFile, unpackPackage, POLARIS_MAGIC } from "./index.ts";

describe("polaris package format", () => {
  it("rejects ZIP-like files without PLRS magic", async () => {
    const dir = mkdtempSync(join(tmpdir(), "polaris-pkg-"));
    const fake = join(dir, "fake.polaris");
    writeFileSync(fake, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])); // ZIP local header
    const v = await verifyPackageFile(fake, { allowUnsigned: true });
    assert.equal(v.ok, false);
    assert.match(v.errors[0] ?? "", /PLRS|magic/i);
    rmSync(dir, { recursive: true, force: true });
  });

  it("packs, verifies checksums, unpacks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "polaris-pkg-"));
    const twin = join(dir, "twin");
    mkdirSync(twin);
    writeFileSync(join(twin, "entities.json"), JSON.stringify([{ id: "e1" }]));
    writeFileSync(join(twin, "edges.json"), JSON.stringify([]));
    const dna = join(dir, "city-dna.json");
    const report = join(dir, "bootstrap-report.json");
    writeFileSync(dna, JSON.stringify({ city: "Test" }));
    writeFileSync(report, JSON.stringify({ ok: true }));
    const out = join(dir, "test.polaris");

    const manifest = await packCity({
      citySlug: "test-city",
      cityDisplayName: "Test City",
      twinDir: twin,
      cityDnaPath: dna,
      bootstrapReportPath: report,
      twinReadinessScore: 40,
      cityReadinessScore: 50,
      coverage: { requiredPresent: 1, requiredTotal: 3, optionalPresent: 0, optionalTotal: 2 },
      provenance: { datasetKeys: ["osm"], licenses: [{ spdx: "ODbL-1.0", attribution: "OSM", sourceId: "osm" }] },
      outPath: out,
      signingSecret: "test-secret",
    });

    const buf = readFileSync(out);
    assert.ok(buf.subarray(0, 4).equals(POLARIS_MAGIC));
    assert.equal(manifest.signature.algorithm, "hmac-sha256");

    const ok = await verifyPackageFile(out, { signingSecret: "test-secret" });
    assert.equal(ok.ok, true);

    const bad = await verifyPackageFile(out, { signingSecret: "wrong" });
    assert.equal(bad.ok, false);

    const mount = join(dir, "mount");
    const unpacked = await unpackPackage(out, mount, { signingSecret: "test-secret" });
    assert.equal(unpacked.manifest.citySlug, "test-city");
    assert.ok(readFileSync(join(mount, "twin/entities.json"), "utf8").includes("e1"));

    rmSync(dir, { recursive: true, force: true });
  });
});
