# Dataset Research — POLARIS Milestone 1

**Policy:** No fake data. No dummy cities. Every connector must target a real public source or declare a missing dependency with an integration interface.

**Primary AOI strategy:** City-agnostic connectors parameterized by bounding box / administrative unit. First production AOI is selected at ingestion time, not hardcoded.

---

## Summary Matrix

| Domain | Primary Source | License | Coverage | Update | API | Format | Reliability | Auto-ingest |
|---|---|---|---|---|---|---|---|---|
| Roads | OSM / Geofabrik / Overture Transport | ODbL | Global | Minutes–daily | Overpass + extracts | PBF / GeoJSON / Parquet | High | Yes |
| Buildings | Overture Buildings + Microsoft ML Footprints | ODbL / CDLA 2.0 | Global | Monthly | S3 / Azure | Parquet / GeoJSONL | High | Yes |
| Hospitals | OSM `amenity=hospital` | ODbL | Global (variable completeness) | Continuous | Overpass | GeoJSON | Medium–High | Yes |
| Schools | OSM `amenity=school/college/university` | ODbL | Global (variable) | Continuous | Overpass | GeoJSON | Medium–High | Yes |
| Police | OSM `amenity=police` | ODbL | Global (variable) | Continuous | Overpass | GeoJSON | Medium | Yes |
| Fire Stations | OSM `amenity=fire_station` | ODbL | Global (variable) | Continuous | Overpass | GeoJSON | Medium | Yes |
| Population | WorldPop | CC BY 4.0 | Global | Annual / multi-year | REST / FTP / GEE | GeoTIFF | High | Yes |
| Admin Boundaries | geoBoundaries (commercial-safe) | CC BY 4.0 | Global | Periodic | REST / download | GeoJSON / Shapefile | High | Yes |
| Elevation | Copernicus DEM GLO-30 | Copernicus License | Global (few tile gaps) | Static release | S3 / STAC | COG GeoTIFF | Very High | Yes |
| Drainage | HydroSHEDS / HydroRIVERS + OSM waterways | Specific / ODbL | Global | Static + continuous | Download / Overpass | Shapefile / GeoJSON | High | Yes |
| Weather | Open-Meteo | CC BY 4.0 | Global | Hourly | REST | JSON | High | Yes* |
| AQI | Open-Meteo Air Quality + WAQI | CC BY / WAQI ToS | Global / station-based | Hourly | REST | JSON | Medium–High | Yes* |
| Metro / Transit | Mobility Database GTFS + OSM PT | Varies / ODbL | City-dependent | Agency cadence | Catalog API + ZIP | GTFS | Medium | Partial |
| Railways | OSM railway=* / OpenRailwayMap tags | ODbL | Global | Continuous | Overpass / PBF | GeoJSON / PBF | High | Yes |
| Airports | OurAirports + OSM aeroway | Public domain / ODbL | Global | Frequent | CSV download | CSV / GeoJSON | High | Yes |
| Utilities | **No complete global public source** | — | — | — | — | — | — | Interface only |
| Flood Zones | GloFAS / Open-Meteo Flood + national FEMA/FIRM where available | Mixed | Global discharge; zones national | Daily / national | REST / portal | JSON / Shapefile | Medium | Partial |
| Land Use | ESA WorldCover | CC BY 4.0 | Global 10 m | Annual product | S3 / GEE | COG | High | Yes |
| Satellite Imagery | Sentinel-2 (Copernicus) | Copernicus License | Global | 5-day revisit | STAC / CDSE | COG / JP2 | Very High | Yes* |
| Historical Rainfall | Open-Meteo Archive (ERA5) | CC BY 4.0 | Global from 1940 | Reanalysis | REST | JSON | High | Yes* |
| Historical Floods | GloFAS reanalysis + national archives | Mixed | Global discharge | Historical | REST | JSON | Medium | Partial |
| Historical Disasters | GDACS + EM-DAT | GDACS open / EM-DAT restricted | Global | Near-real-time / annual | REST / request | JSON / XLS | Medium | Partial |
| Traffic | **No free global real-time traffic** | — | — | — | — | — | — | Interface only |
| Emergency Services | OSM amenities + national open data | ODbL / national | Variable | Continuous | Overpass / portals | GeoJSON | Medium | Partial |
| Gov Open Data | CKAN / Socrata / national portals | Varies | Jurisdiction | Varies | REST | CSV / GeoJSON | Variable | Adapter pattern |

\*Commercial SaaS deployment may require paid API keys (Open-Meteo commercial tier, Copernicus authenticated STAC for some products, WAQI token).

---

## Detailed Catalog

### 1. Roads

| Field | Detail |
|---|---|
| **Source** | OpenStreetMap (primary), Geofabrik regional extracts, Overture Maps `transportation` theme (secondary conflation) |
| **License** | ODbL 1.0 (share-alike for derivative databases; attribution required) |
| **Coverage** | Global; urban completeness generally high in major cities |
| **Update frequency** | Planet/minutely diffs; Geofabrik daily; Overture monthly releases |
| **Access method** | Overpass QL for AOI queries; PBF extracts for bulk city loads |
| **API** | `https://overpass-api.de/api/interpreter` (rate-limited); self-hosted Overpass recommended for production |
| **Format** | OSM XML/JSON, PBF, GeoJSON, GeoParquet (Overture) |
| **Reliability** | High for topology of major roads; attribute quality varies (lanes, surface, speed) |
| **Connector** | `services/connectors/osm` |
| **Tags** | `highway=*`, relations for routes |

**Production note:** Do not hammer public Overpass. Mirror via Geofabrik + osm2pgsql/imposm into PostGIS for city AOIs.

---

### 2. Buildings

| Field | Detail |
|---|---|
| **Source (A)** | Overture Maps Buildings theme (conflates OSM + Esri + Microsoft + Google Open Buildings) |
| **Source (B)** | Microsoft Global ML Building Footprints |
| **License** | Overture: ODbL; Microsoft: CDLA Permissive 2.0 |
| **Coverage** | Global (~billions of footprints in Overture) |
| **Update frequency** | Overture monthly; Microsoft periodic releases |
| **Access** | S3 / Azure blob (Overture); GitHub release index + Azure for Microsoft |
| **API** | Object storage listing + DuckDB/Athena-style query over Parquet |
| **Format** | GeoParquet, GeoJSON Sequence |
| **Reliability** | High footprint coverage; heights/use attributes incomplete without OSM enrichment |
| **Connector** | `services/connectors/overture`, `services/connectors/microsoft-buildings` |

---

### 3–6. Hospitals, Schools, Police, Fire Stations

| Field | Detail |
|---|---|
| **Source** | OpenStreetMap POIs |
| **License** | ODbL |
| **Coverage** | Global; completeness correlates with local mapping community |
| **Update** | Continuous |
| **Access** | Overpass / osmium filtered extracts |
| **API** | Overpass |
| **Format** | GeoJSON / GeoPackage |
| **Reliability** | Medium — must be quality-scored; never assume completeness for emergency planning |
| **Tags** | `amenity=hospital|clinic`, `amenity=school|college|university`, `amenity=police`, `amenity=fire_station` |
| **Connector** | `services/connectors/osm` (POI profiles) |

**Assumption NOT to make:** OSM emergency POIs equal official agency inventories. National registries should overlay when available.

---

### 7. Population

| Field | Detail |
|---|---|
| **Source** | WorldPop (University of Southampton / WorldPop project) |
| **License** | CC BY 4.0 |
| **Coverage** | Global gridded population (typically 100 m) |
| **Update** | Annual / multi-year products; unconstrained & constrained variants |
| **Access** | WorldPop FTP/HTTPS, Google Earth Engine, REST catalog |
| **API** | WorldPop REST + GEE |
| **Format** | GeoTIFF |
| **Reliability** | High for regional planning; local census official data preferred when licensed |
| **Connector** | `services/connectors/worldpop` |

---

### 8. Administrative Boundaries

| Field | Detail |
|---|---|
| **Source (recommended for SaaS)** | geoBoundaries |
| **Alternative** | GADM (non-commercial free; commercial license required) |
| **Also** | OSM `admin_level=*` relations (supplemental) |
| **License** | geoBoundaries: CC BY 4.0; GADM: restricted commercial |
| **Coverage** | Global multi-level ADM |
| **Update** | Periodic releases |
| **Access** | HTTPS downloads / API |
| **Format** | GeoJSON, Shapefile, GeoPackage |
| **Reliability** | High for ADM0–ADM2; local disputes possible |
| **Connector** | `services/connectors/geoboundaries` |

**Decision:** Prefer geoBoundaries for commercial SaaS to avoid GADM commercial licensing friction.

---

### 9. Elevation

| Field | Detail |
|---|---|
| **Source** | Copernicus DEM GLO-30 (primary), GLO-90 fallback |
| **License** | Copernicus License (free with attribution / terms) |
| **Coverage** | Near-global 30 m DSM; a small set of GLO-30 tiles historically restricted |
| **Update** | Release-based (not continuous) |
| **Access** | AWS Open Data `s3://copernicus-dem-30m/` (no-sign-request for public tiles); Copernicus Data Space Ecosystem STAC |
| **API** | S3 listing / STAC |
| **Format** | Cloud-Optimized GeoTIFF |
| **Reliability** | Very high for terrain context; DSM includes canopy/buildings — use carefully for bare-earth hydrology |
| **Connector** | `services/connectors/copernicus` |

---

### 10. Drainage / Hydrography

| Field | Detail |
|---|---|
| **Source (global)** | HydroSHEDS / HydroRIVERS |
| **Source (vector detail)** | OSM `waterway=*`, `natural=water` |
| **Source (US)** | USGS NHD / 3DHP (jurisdiction-specific) |
| **License** | HydroSHEDS: project terms (verify commercial use); OSM: ODbL; USGS: public domain |
| **Coverage** | Global rivers + basins; urban storm drains rarely complete publicly |
| **Update** | HydroSHEDS mostly static; OSM continuous |
| **Access** | Download portals; Overpass |
| **Format** | Shapefile, GeoPackage, GeoJSON |
| **Reliability** | Good for major rivers; **urban drainage networks are a known gap** |
| **Connector** | `services/connectors/hydrosheds` + OSM water profile |

---

### 11. Weather

| Field | Detail |
|---|---|
| **Source** | Open-Meteo (aggregates ECMWF, NOAA, DWD, etc.) |
| **License** | Data CC BY 4.0; free API non-commercial ≤10k calls/day; commercial requires paid plan |
| **Coverage** | Global |
| **Update** | Hourly / sub-daily model cadence |
| **Access** | REST `https://api.open-meteo.com/v1/forecast` |
| **API** | Yes |
| **Format** | JSON |
| **Reliability** | High |
| **Connector** | `services/connectors/open-meteo` |

---

### 12. AQI (Air Quality)

| Field | Detail |
|---|---|
| **Source (A)** | Open-Meteo Air Quality API |
| **Source (B)** | World Air Quality Index (WAQI) / AQICN |
| **License** | Open-Meteo CC BY; WAQI requires token & ToS compliance |
| **Coverage** | Modelled global (Open-Meteo); station network (WAQI) |
| **Update** | Hourly |
| **Access** | REST |
| **Format** | JSON |
| **Reliability** | Medium–High; station density uneven |
| **Connector** | `services/connectors/open-meteo`, `services/connectors/waqi` |

---

### 13. Metro / Public Transit

| Field | Detail |
|---|---|
| **Source** | Mobility Database (GTFS catalog) + agency GTFS feeds; OSM public transport relations |
| **License** | Per-agency; many open, some restricted |
| **Coverage** | City-dependent — **not universal** |
| **Update** | Agency schedule cycles; GTFS-Realtime where published |
| **Access** | Catalog API + ZIP download; GTFS-RT protobuf |
| **Format** | GTFS ZIP, GTFS-RT |
| **Reliability** | High where agencies publish; absent where they do not |
| **Connector** | `services/connectors/gtfs` |

---

### 14. Railways

| Field | Detail |
|---|---|
| **Source** | OSM `railway=*` (OpenRailwayMap tagging scheme) |
| **License** | ODbL |
| **Coverage** | Global; detail varies |
| **Update** | Continuous |
| **Access** | Overpass / PBF |
| **Format** | GeoJSON / PBF |
| **Reliability** | High for mainlines in mapped regions |
| **Connector** | `services/connectors/osm` (rail profile) |

---

### 15. Airports

| Field | Detail |
|---|---|
| **Source** | OurAirports + OSM `aeroway=*` |
| **License** | OurAirports: public domain dedication; OSM: ODbL |
| **Coverage** | Global airports, runways, navaids (OurAirports) |
| **Update** | Frequent CSV refreshes |
| **Access** | HTTPS CSV download |
| **Format** | CSV → GeoJSON in connector |
| **Reliability** | High for aerodrome inventory |
| **Connector** | `services/connectors/ourairports` |

---

### 16. Utilities (Electric / Gas / Water / Telecom)

| Field | Detail |
|---|---|
| **Source** | **No authoritative global public dataset** |
| **Partial** | OSM `power=*`, `man_made=pipeline`, `utility=*` — incomplete and often sensitive |
| **License** | ODbL where present |
| **Coverage** | Sparse; security-sensitive |
| **Reliability** | Low for operational use |
| **POLARIS stance** | **Do not fabricate.** Expose `UtilityNetworkPort` interface for partner / government feeds |
| **Connector** | `services/connectors/_template` → `utility-partner` stub interface only |

---

### 17. Flood Zones

| Field | Detail |
|---|---|
| **Source (global discharge)** | GloFAS via Open-Meteo Flood API |
| **Source (regulatory zones)** | National (e.g., US FEMA NFHL; India NRSC/CWC products; EU flood hazard maps) — **jurisdiction-specific** |
| **License** | Mixed |
| **Coverage** | Discharge global; official floodplain polygons national |
| **Update** | GloFAS daily; national varies |
| **Access** | REST / government portals (often manual download) |
| **Format** | JSON, Shapefile, FileGDB |
| **Reliability** | Medium without national overlays |
| **Connector** | `open-meteo` flood profile + national adapters (future) |

---

### 18. Land Use / Land Cover

| Field | Detail |
|---|---|
| **Source** | ESA WorldCover (10 m) |
| **License** | CC BY 4.0 |
| **Coverage** | Global |
| **Update** | Annual products (e.g., 2020, 2021) |
| **Access** | AWS Open Data / Terrascope / GEE |
| **Format** | COG GeoTIFF |
| **Reliability** | High for 11-class land cover |
| **Connector** | `services/connectors/esa-worldcover` |

---

### 19. Satellite Imagery

| Field | Detail |
|---|---|
| **Source** | Sentinel-2 L2A (Copernicus) |
| **License** | Copernicus License / free & open |
| **Coverage** | Global land |
| **Update** | ~5-day revisit (constellation) |
| **Access** | Copernicus Data Space Ecosystem STAC; Element84 / AWS Open Data |
| **API** | STAC search |
| **Format** | COG / JPEG2000 |
| **Reliability** | Very high |
| **Connector** | `services/connectors/sentinel` |
| **Auth** | CDSE account recommended for production volume |

---

### 20. Historical Rainfall

| Field | Detail |
|---|---|
| **Source** | Open-Meteo Historical Weather (ERA5 reanalysis backbone) |
| **License** | CC BY 4.0; commercial API plan for SaaS |
| **Coverage** | Global, hourly from 1940 |
| **Update** | Reanalysis lag (days–weeks) |
| **Access** | REST archive endpoints |
| **Format** | JSON |
| **Reliability** | High for climate-scale; not a substitute for local rain gauges |
| **Connector** | `services/connectors/open-meteo` (archive profile) |

---

### 21. Historical Floods

| Field | Detail |
|---|---|
| **Source** | GloFAS reanalysis (1984+) via Open-Meteo Flood; Dartmouth Flood Observatory (research); national event archives |
| **License** | Mixed |
| **Coverage** | Global discharge history; event polygons incomplete globally |
| **Reliability** | Medium |
| **Connector** | flood profile + national event adapters |
| **Gap** | Consistent global historical flood *extent* polygons are incomplete — do not invent extents |

---

### 22. Historical Disasters

| Field | Detail |
|---|---|
| **Source (A)** | GDACS (Global Disaster Alert and Coordination System) |
| **Source (B)** | EM-DAT (CRED) — **access restricted / registration; not fully open for redistribution** |
| **License** | GDACS: generally open for use with attribution; EM-DAT: restricted |
| **Coverage** | Global alerts / disaster database |
| **Update** | Near-real-time (GDACS); curated annual (EM-DAT) |
| **Access** | GDACS RSS/API; EM-DAT request portal |
| **Format** | JSON / XML / spreadsheet |
| **Reliability** | Medium (reporting bias) |
| **Connector** | `services/connectors/gdacs`; EM-DAT as **manual/licensed** interface |

---

### 23. Traffic

| Field | Detail |
|---|---|
| **Source** | **No free global real-time traffic dataset equivalent to commercial TomTom/HERE/Google** |
| **Partial** | City open data (sensors, Waze CCP partnerships), OSM historical speeds (limited), Uber Movement (historical, discontinued/limited) |
| **POLARIS stance** | Define `TrafficFeedPort`; integrate city ITS / commercial provider later |
| **Do not** | Synthesize congestion from nothing |

---

### 24. Emergency Services (operational)

| Field | Detail |
|---|---|
| **Source** | OSM amenities (locations) + jurisdiction CAD/AVL feeds (operational status) |
| **Gap** | Live unit availability, dispatch, mutual aid agreements are **not public** |
| **Interface** | `EmergencyOperationsPort` |

---

### 25. Government Open Data

| Field | Detail |
|---|---|
| **Source** | National / city CKAN, Socrata, DKAN, custom portals (data.gov, data.gov.in, data.gov.uk, EU data portal, etc.) |
| **License** | Per-dataset |
| **Strategy** | Generic `OpenDataPortalAdapter` with per-city manifests — never hardcode one city’s schema as global truth |
| **Connector pattern** | Manifest-driven ingestion under `services/connectors/` per jurisdiction |

---

## Recommended Ingestion Priority (Milestone 2)

1. Admin boundaries (geoBoundaries) — defines AOI
2. Elevation (Copernicus DEM) — terrain baseline
3. Land cover (ESA WorldCover)
4. Roads + railways + airports (OSM / OurAirports / Overture)
5. Buildings (Overture)
6. Critical POIs (hospitals, schools, police, fire)
7. Population (WorldPop)
8. Hydrography (HydroSHEDS + OSM water)
9. Weather + AQI + historical rainfall (Open-Meteo)
10. Flood discharge (GloFAS)
11. Transit GTFS (if AOI has open feed)
12. Sentinel-2 basemap mosaic
13. GDACS event stream
14. Partner utilities / traffic / emergency ops (interfaces until credentials)

---

## Licensing Compliance Checklist

- [ ] Maintain `data/schemas/provenance.schema.json` on every asset
- [ ] ODbL share-alike review for any redistributed derivative DB
- [ ] CC BY attribution strings in UI & exports
- [ ] Copernicus terms for DEM & Sentinel products
- [ ] Commercial Open-Meteo key before production SaaS traffic
- [ ] Never redistribute EM-DAT without license
- [ ] geoBoundaries attribution for admin layers

---

## Explicit Non-Goals for Milestone 1

- Downloading multi-GB city extracts into git
- Hardcoding Bengaluru / any city as the product
- Mock hospitals, fake population grids, or synthetic flood polygons
