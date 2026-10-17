# Milestone 2 Architecture Review

**Subject:** Living City Bootstrap Engine  
**Reviewers (roles):** Principal GIS · Data Engineering · Knowledge Graph · CTO · Government GIS · Cloud · Security · Urban Planning · Disaster Science  

This review challenges assumptions and records hardenings applied in-tree.

---

## Verdict

Milestone 2 delivers a **production-shaped bootstrap control plane**: city-name → boundary → connector mesh → ontology twin → graph hints → DNA → honest report.  
It is **not** yet a fully auto-mosaicked multi-GB raster twin for every city. Gaps are explicit (plans + `missingReason`), not faked.

---

## Persona findings

### Principal GIS Engineer

| Challenge | Finding | Hardening |
|---|---|---|
| Nominatim bbox ≠ official municipal boundary | True — quality varies | Prefer polygon_geojson; validate with Turf; report area; geoBoundaries overlay when ISO known |
| Overpass for megacities | Will timeout / rate-limit | Area warning; `POLARIS_OVERPASS_URL`; document Geofabrik PBF path |
| CRS | GeoJSON assumed WGS84 | Validation rejects out-of-range coordinates |

### Principal Data Engineer

| Challenge | Finding | Hardening |
|---|---|---|
| Independent connectors | Orchestrated with isolated failures | Per-connector status in report; pipeline continues |
| Resumable + checksum | Implemented in connector-sdk | `.partial` + `.checkpoint.json` + sha256 |
| Incremental updates | Not full CDC yet | Job folder is immutable per run; re-run creates new AOI workdir (safe). Future: etag/delta per connector |

### Principal Knowledge Graph Engineer

| Challenge | Finding | Hardening |
|---|---|---|
| Hardcoded city edges | Forbidden | `inferGraphEdges` uses ontology RelationTypes + spatial rules only |
| POWERS without utilities | Would be fiction | **Not inferred** — reported as utility coverage null |
| Bridge in flood zone | Needs flood polygons | Not inferred from discharge alone |

### CTO

| Challenge | Finding | Hardening |
|---|---|---|
| Dual storage truth | Filesystem always; DB optional | Storage result enums never claim `written` when skipped |
| Time-to-value | CLI one-liner | `polaris bootstrap city` |
| Modularity | SDK + bootstrap + ontology | Clear package boundaries |

### Government GIS Architect

| Challenge | Finding | Hardening |
|---|---|---|
| Licensing | Must surface | Report `licensing[]` + provenance on artifacts |
| Official registries | OSM incomplete | Confidence caps + operator guide warnings |
| Open government portals | City-specific | Registry entry `open_government_data` = planned/manual |

### Cloud Architect

| Challenge | Finding | Hardening |
|---|---|---|
| Bandwidth bombs | DEM/WorldCover | Gated behind env flags; tile **plans** default |
| Horizontal scale | Single process today | Connectors are independently callable for future queue workers |

### Security Architect

| Challenge | Finding | Hardening |
|---|---|---|
| PII | Population is aggregate only | No household microdata |
| Secrets | API keys via env | Never written into twin JSON |
| User-Agent | Nominatim/Overpass policy | Explicit POLARIS UA strings |

### Urban Planner

| Challenge | Finding | Hardening |
|---|---|---|
| City DNA zeros | Misleading | **null** when unavailable + notes |
| Density without population | Invalid | hospitalDensityPer100k stays null |

### Disaster Scientist

| Challenge | Finding | Hardening |
|---|---|---|
| Flood risk from discharge | Insufficient | floodRisk null; explicit note that inundation needs DEM + zones |
| GDACS ≠ historical extents | Correct | Partial ingest + warning |

---

## Weak components redesigned / constrained

1. **Storage adapters** — honest `skipped` instead of fake success.  
2. **Raster connectors** — plan-first, download opt-in.  
3. **Graph inference** — only edges supportable by public geometry; no utility fantasy.  
4. **DNA metrics** — nullable with explanatory notes.  
5. **Readiness scores** — penalize missing required layers; exit code 2 when twin weak.

---

## Remaining production backlog (M2.1+)

- PostGIS COPY upsert + Neo4j `UNWIND` bulk load drivers
- Geofabrik/osmium PBF path for AOI &gt; ~1.5 deg²
- DuckDB Overture buildings pull
- WorldPop ISO auto-select + COG clip
- Connector-level incremental watermarks in Catalog

---

## Sign-off condition

Bootstrap is **operator-ready for transparent twin assembly** from public data.  
It is **not** simulation-ready until DEM + hydro + population rasters are actually landed for the AOI (reported, not silent).
