"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  applyCitySun,
  createStableViewer,
  LOADING_LABELS,
  sampleHeightmap,
  shouldUseAoiHeightmapForBases,
  upgradeVisualsOptionally,
  type LoadingPhase,
} from "./cesiumVisual";
import {
  applySelectionHighlight,
  styleBoundaryEntity,
  styleBuildingEntity,
  stylePoiEntity,
  styleRoadEntity,
  styleVegetationEntity,
  styleWaterEntity,
} from "./layerStyles";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LayerId = "buildings" | "roads" | "water" | "vegetation" | "pois" | "boundary" | "terrain" | "imagery";

interface DemoCity {
  slug: string;
  displayName: string;
  query: string;
}

interface SceneLayer {
  id: string;
  label: string;
  status: "ready" | "partial" | "missing";
  featureCount: number;
  note?: string;
  provenance?: {
    sourceName: string;
    license: string;
    attribution: string;
    sourceUrl: string;
  };
}

interface TwinScene {
  citySlug: string;
  cityDisplayName: string;
  builtAt: string;
  camera: { lon: number; lat: number; height: number; heading: number; pitch: number };
  fetchBbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  layers: SceneLayer[];
  missing: string[];
  warnings: string[];
  terrain: { status: string; path?: string };
}

interface SearchHit {
  id: string;
  name: string;
  kind: string;
  lon: number;
  lat: number;
  provenance?: string;
  license?: string;
}

interface JobView {
  jobId: string;
  phase: string;
  percent: number;
  message: string;
  error?: string;
  citySlug?: string;
}

type Heightmap = {
  cols: number;
  rows: number;
  west: number;
  south: number;
  east: number;
  north: number;
  heights: number[];
};

const LAYER_DEFAULTS: Record<LayerId, boolean> = {
  buildings: true,
  roads: true,
  water: true,
  vegetation: true,
  pois: true,
  boundary: true,
  terrain: true,
  imagery: true,
};

export function TwinMissionControl() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const dataSourcesRef = useRef<Map<string, import("cesium").DataSource>>(new Map());
  const heightmapRef = useRef<Heightmap | null>(null);
  const homeCameraRef = useRef<TwinScene["camera"] | null>(null);
  const hoveredRef = useRef<import("cesium").Entity | null>(null);
  const hoverRestoreRef = useRef<{ outline?: boolean; color?: import("cesium").Color } | null>(null);

  const [demoCities, setDemoCities] = useState<DemoCity[]>([]);
  const [compiled, setCompiled] = useState<Array<{ citySlug: string; cityDisplayName: string; layersReady: number }>>([]);
  const [scene, setScene] = useState<TwinScene | null>(null);
  const [layersOn, setLayersOn] = useState(LAYER_DEFAULTS);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [status, setStatus] = useState("Idle");
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState<{ lon: number; lat: number; height: number } | null>(null);
  const [loadPhase, setLoadPhase] = useState<LoadingPhase>("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const [imageryLabel, setImageryLabel] = useState("—");
  const [terrainLabel, setTerrainLabel] = useState("—");
  const [terrainExaggeration, setTerrainExaggeration] = useState(1);
  const [dayNight, setDayNight] = useState<"day" | "dusk" | "night">("day");
  const [viewerReady, setViewerReady] = useState(false);

  const fileUrl = useCallback((slug: string, rel: string) => {
    return `${API_BASE}/v1/twin3d/cities/${slug}/file?path=${encodeURIComponent(rel)}`;
  }, []);

  useEffect(() => {
    void fetch(`${API_BASE}/v1/twin3d/demo-cities`)
      .then((r) => r.json())
      .then((d: { items: DemoCity[] }) => setDemoCities(d.items))
      .catch(() => setStatus("API offline — start @polaris/api"));
    void fetch(`${API_BASE}/v1/twin3d/cities`)
      .then((r) => r.json())
      .then((d: { items: typeof compiled }) => setCompiled(d.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootCesium() {
      if (!containerRef.current || viewerRef.current) return;
      const Cesium = await import("cesium");
      (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium";

      let viewer: import("cesium").Viewer;
      let bootImageryLabel = "OpenStreetMap raster";
      try {
        const created = await createStableViewer(Cesium, containerRef.current);
        if (cancelled) {
          created.viewer.destroy();
          return;
        }
        viewer = created.viewer;
        bootImageryLabel = created.imageryLabel;
        setImageryLabel(created.imageryLabel);
        setTerrainLabel(created.terrainLabel);
      } catch (err) {
        console.error("[polaris.cesium] Viewer construction failed", err);
        setLoadPhase("error");
        return;
      }

      viewer.selectedEntityChanged.addEventListener(() => {
        const e = viewer.selectedEntity;
        if (!e) {
          setSelected(null);
          return;
        }
        applySelectionHighlight(Cesium, e);
        const props: Record<string, unknown> = { id: e.id, name: e.name };
        if (e.properties) {
          const names = e.properties.propertyNames as string[];
          for (const n of names) {
            try {
              props[n] = e.properties[n]?.getValue?.(Cesium.JulianDate.now());
            } catch {
              /* skip */
            }
          }
        }
        setSelected(props);
      });

      // Hover highlight (buildings / polygons)
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { endPosition: import("cesium").Cartesian2 }) => {
        const picked = viewer.scene.pick(movement.endPosition);
        const entity =
          picked && typeof picked === "object" && "id" in picked
            ? (picked as { id: import("cesium").Entity }).id
            : undefined;

        if (hoveredRef.current && hoveredRef.current !== entity && hoveredRef.current !== viewer.selectedEntity) {
          const prev = hoveredRef.current;
          if (prev.polygon && hoverRestoreRef.current) {
            prev.polygon.outline = new Cesium.ConstantProperty(hoverRestoreRef.current.outline ?? false);
            if (hoverRestoreRef.current.color) {
              prev.polygon.outlineColor = new Cesium.ConstantProperty(hoverRestoreRef.current.color);
            }
          }
          hoveredRef.current = null;
          hoverRestoreRef.current = null;
        }

        if (entity?.polygon && entity !== viewer.selectedEntity && entity !== hoveredRef.current) {
          hoverRestoreRef.current = {
            outline: Boolean(entity.polygon.outline?.getValue?.(Cesium.JulianDate.now())),
            color: entity.polygon.outlineColor?.getValue?.(Cesium.JulianDate.now()),
          };
          entity.polygon.outline = new Cesium.ConstantProperty(true);
          entity.polygon.outlineColor = new Cesium.ConstantProperty(
            Cesium.Color.fromCssColorString("#7ee7ff").withAlpha(0.95),
          );
          hoveredRef.current = entity;
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      viewer.canvas.addEventListener("mousemove", (ev) => {
        const cartesian = viewer.camera.pickEllipsoid(
          new Cesium.Cartesian2(ev.offsetX, ev.offsetY),
          viewer.scene.globe.ellipsoid,
        );
        if (!cartesian) return;
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        setCursor({
          lon: Cesium.Math.toDegrees(carto.longitude),
          lat: Cesium.Math.toDegrees(carto.latitude),
          height: carto.height,
        });
      });

      if (!cancelled) {
        viewerRef.current = viewer;
        setViewerReady(true);
        setStatus(`Viewer ready · ${bootImageryLabel}`);
        void upgradeVisualsOptionally(Cesium, viewer, { imagery: true, terrain: false }).then((up) => {
          if (up.imageryLabel) setImageryLabel(up.imageryLabel);
        });
      } else {
        viewer.destroy();
      }
    }
    void bootCesium();
    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  async function loadHeightmap(slug: string, sceneData: TwinScene): Promise<Heightmap | null> {
    if (sceneData.terrain.status !== "ready" || !sceneData.terrain.path) return null;
    try {
      const hm = (await fetch(fileUrl(slug, sceneData.terrain.path)).then((r) => r.json())) as Heightmap;
      if (!hm.heights?.length) return null;
      heightmapRef.current = hm;
      return hm;
    } catch {
      return null;
    }
  }

  function groundHeightForEntity(
    Cesium: typeof import("cesium"),
    entity: import("cesium").Entity,
  ): number {
    const hm = heightmapRef.current;
    const viewer = viewerRef.current;
    if (!hm || !viewer || !shouldUseAoiHeightmapForBases(viewer, Cesium)) return 0;
    try {
      const pos = entity.polygon?.hierarchy?.getValue?.(Cesium.JulianDate.now())?.positions?.[0];
      if (!pos) return 0;
      const c = Cesium.Cartographic.fromCartesian(pos);
      const lon = Cesium.Math.toDegrees(c.longitude);
      const lat = Cesium.Math.toDegrees(c.latitude);
      return sampleHeightmap(hm, lon, lat) ?? 0;
    } catch {
      return 0;
    }
  }

  async function loadLayer(
    Cesium: typeof import("cesium"),
    slug: string,
    layerId: string,
    style: "buildings" | "roads" | "water" | "vegetation" | "pois" | "boundary",
    featureCountHint = 0,
  ) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const prev = dataSourcesRef.current.get(layerId);
    if (prev) {
      viewer.dataSources.remove(prev, true);
      dataSourcesRef.current.delete(layerId);
    }
    const url = fileUrl(slug, `layers/${layerId}.geojson`);
    const fc = (await fetch(url).then((r) => r.json())) as {
      type: string;
      features: Array<Record<string, unknown>>;
    };
    const features = fc.features ?? [];
    const CHUNK = 1500;
    const useOutlines = style === "buildings" && featureCountHint <= 4000;
    const ds = new Cesium.CustomDataSource(layerId);

    const styleEntity = (entity: import("cesium").Entity) => {
      if (style === "buildings") {
        styleBuildingEntity(Cesium, entity, {
          useOutlines,
          groundHeight: groundHeightForEntity(Cesium, entity),
        });
      } else if (style === "roads") styleRoadEntity(Cesium, entity);
      else if (style === "water") styleWaterEntity(Cesium, entity);
      else if (style === "vegetation") styleVegetationEntity(Cesium, entity);
      else if (style === "boundary") styleBoundaryEntity(Cesium, entity);
      else if (style === "pois") stylePoiEntity(Cesium, entity);
    };

    await viewer.dataSources.add(ds);
    dataSourcesRef.current.set(layerId, ds);

    for (let i = 0; i < features.length; i += CHUNK) {
      const slice = features.slice(i, i + CHUNK);
      const partial = { type: "FeatureCollection", features: slice };
      const blob = new Blob([JSON.stringify(partial)], { type: "application/json" });
      const blobUrl = URL.createObjectURL(blob);
      try {
        const part = await Cesium.GeoJsonDataSource.load(blobUrl, {
          clampToGround: style !== "buildings",
          markerSize: 24,
        });
        for (const entity of part.entities.values) {
          styleEntity(entity);
          ds.entities.add(entity);
        }
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      const done = Math.min(features.length, i + CHUNK);
      setStatus(`Loading ${layerId} ${done}/${features.length}`);
      setLoadProgress(Math.round((done / Math.max(features.length, 1)) * 100));
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  async function flyHome(Cesium: typeof import("cesium"), cam: TwinScene["camera"], duration = 1.8) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    // Prefer a cinematic lower altitude for aerials (sharper mipmaps)
    const height = Math.min(Math.max(cam.height * 0.55, 450), 4_500);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, height),
      orientation: {
        heading: Cesium.Math.toRadians(cam.heading),
        pitch: Cesium.Math.toRadians(Math.min(cam.pitch, -28)),
        roll: 0,
      },
      duration,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }

  async function mountScene(sceneData: TwinScene) {
    const viewer = viewerRef.current;
    if (!viewer) {
      setStatus("Viewer not ready");
      return;
    }
    const Cesium = await import("cesium");
    setScene(sceneData);
    homeCameraRef.current = sceneData.camera;
    setLoadPhase("datasets");
    setLoadProgress(5);
    setStatus(`Opening ${sceneData.cityDisplayName}…`);

    for (const ds of dataSourcesRef.current.values()) {
      viewer.dataSources.remove(ds, true);
    }
    dataSourcesRef.current.clear();
    heightmapRef.current = null;

    setLoadPhase("imagery");
    setLoadProgress(12);
    viewer.imageryLayers.get(0)!.show = layersOn.imagery;

    setLoadPhase("terrain");
    setLoadProgress(22);
    const hm = await loadHeightmap(sceneData.citySlug, sceneData);
    if (hm) {
      const mid = hm.heights[Math.floor(hm.heights.length / 2)] ?? 0;
      setStatus(`Terrain DEM ready · mid≈${mid.toFixed(1)} m · ${terrainLabel}`);
    }

    await flyHome(Cesium, sceneData.camera);
    applyCitySun(Cesium, viewer, sceneData.camera.lon);

    const order: Array<[string, "buildings" | "roads" | "water" | "vegetation" | "pois" | "boundary", LoadingPhase]> = [
      ["boundary", "boundary", "scene"],
      ["water", "water", "water"],
      ["vegetation", "vegetation", "vegetation"],
      ["roads", "roads", "roads"],
      ["buildings", "buildings", "buildings"],
      ["pois", "pois", "pois"],
    ];

    let step = 0;
    for (const [id, style, phase] of order) {
      const meta = sceneData.layers.find((l) => l.id === id);
      if (!meta || meta.status === "missing" || meta.featureCount === 0) continue;
      if (!layersOn[id as LayerId]) continue;
      setLoadPhase(phase);
      setLoadProgress(30 + Math.round((step / order.length) * 60));
      try {
        await loadLayer(Cesium, sceneData.citySlug, id, style, meta.featureCount);
      } catch (e) {
        console.warn(`Layer ${id} failed`, e);
      }
      step += 1;
    }

    setLoadPhase("meshes");
    setLoadProgress(95);
    // Brief settle for globe tiles
    await new Promise((r) => setTimeout(r, 200));

    setLoadPhase("complete");
    setLoadProgress(100);
    setStatus(`${sceneData.cityDisplayName} · ${imageryLabel}`);
    const hits = await fetch(`${API_BASE}/v1/twin3d/cities/${sceneData.citySlug}/search?q=`).then((r) =>
      r.json(),
    );
    setSearchHits((hits as { items: SearchHit[] }).items ?? []);

    window.setTimeout(() => {
      setLoadPhase("idle");
    }, 900);
  }

  async function openCity(cityName: string) {
    setBusy(true);
    setLoadPhase("datasets");
    setLoadProgress(2);
    setStatus(`Opening ${cityName}…`);
    try {
      const res = await fetch(`${API_BASE}/v1/twin3d/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cityName }),
      });
      const data = (await res.json()) as {
        mode?: string;
        jobId?: string;
        scene?: TwinScene;
        citySlug?: string;
        message?: string;
      };
      if (res.status === 202 && data.jobId) {
        setJob({ jobId: data.jobId, phase: "queued", percent: 0, message: data.message ?? "Compiling" });
        setStatus(data.message ?? "Compiling twin…");
        pollJob(data.jobId);
      } else if (data.scene) {
        await mountScene(data.scene);
        void refreshCompiled();
      } else {
        setStatus(data.message ?? "Open failed");
        setLoadPhase("error");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "API unreachable");
      setLoadPhase("error");
    } finally {
      setBusy(false);
    }
  }

  function pollJob(jobId: string) {
    const t = setInterval(() => {
      void fetch(`${API_BASE}/v1/twin3d/jobs/${jobId}`)
        .then((r) => r.json())
        .then(async (j: JobView & { result?: { scene: TwinScene; citySlug: string } }) => {
          setJob(j);
          setStatus(`${j.phase} ${j.percent}% — ${j.message}`);
          setLoadProgress(j.percent);
          if (j.phase === "complete" && j.result?.scene) {
            clearInterval(t);
            await mountScene(j.result.scene);
            void refreshCompiled();
          }
          if (j.phase === "failed") {
            clearInterval(t);
            setStatus(j.error ?? "Build failed");
            setLoadPhase("error");
          }
        })
        .catch(() => undefined);
    }, 2000);
  }

  async function refreshCompiled() {
    const d = await fetch(`${API_BASE}/v1/twin3d/cities`).then((r) => r.json());
    setCompiled((d as { items: typeof compiled }).items);
  }

  async function runSearch(q: string) {
    setSearchQ(q);
    if (!scene) return;
    const d = await fetch(
      `${API_BASE}/v1/twin3d/cities/${scene.citySlug}/search?q=${encodeURIComponent(q)}`,
    ).then((r) => r.json());
    setSearchHits((d as { items: SearchHit[] }).items ?? []);
  }

  async function flyToHit(hit: SearchHit) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const Cesium = await import("cesium");
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(hit.lon, hit.lat, 380),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-42),
        roll: 0,
      },
      duration: 1.8,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
    setSelected({
      id: hit.id,
      name: hit.name,
      kind: hit.kind,
      lon: hit.lon,
      lat: hit.lat,
      provenance: hit.provenance,
      license: hit.license,
    });
  }

  async function applyCameraPreset(preset: "overview" | "street" | "orbit" | "reset") {
    const viewer = viewerRef.current;
    const cam = homeCameraRef.current;
    if (!viewer || !cam) return;
    const Cesium = await import("cesium");
    if (preset === "reset" || preset === "overview") {
      await flyHome(Cesium, cam, preset === "reset" ? 1.2 : 2.0);
      return;
    }
    if (preset === "street") {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 180),
        orientation: {
          heading: Cesium.Math.toRadians(cam.heading + 25),
          pitch: Cesium.Math.toRadians(-22),
          roll: 0,
        },
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
      return;
    }
    // orbit: elevate slightly and yaw
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(cam.lon + 0.004, cam.lat - 0.003, 900),
      orientation: {
        heading: Cesium.Math.toRadians(cam.heading + 90),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 2.4,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }

  function setExaggeration(value: number) {
    setTerrainExaggeration(value);
    const viewer = viewerRef.current;
    if (viewer) viewer.scene.verticalExaggeration = value;
  }

  async function setLightingMode(mode: "day" | "dusk" | "night") {
    setDayNight(mode);
    const viewer = viewerRef.current;
    if (!viewer) return;
    const Cesium = await import("cesium");
    const lon = homeCameraRef.current?.lon ?? 0;
    const localHour = mode === "day" ? 14 : mode === "dusk" ? 18.5 : 21.5;
    applyCitySun(Cesium, viewer, lon, localHour);
    try {
      viewer.scene.light = new Cesium.SunLight({
        intensity: mode === "night" ? 0.55 : mode === "dusk" ? 1.6 : 2.6,
      });
    } catch {
      /* */
    }
  }

  async function toggleLayer(id: LayerId) {
    const next = { ...layersOn, [id]: !layersOn[id] };
    setLayersOn(next);
    const viewer = viewerRef.current;
    if (!viewer || !scene) return;
    const Cesium = await import("cesium");
    if (id === "imagery") {
      viewer.imageryLayers.get(0)!.show = next.imagery;
      return;
    }
    if (id === "terrain") {
      // Visual only — hide terrain lighting exaggeration when off
      viewer.scene.verticalExaggeration = next.terrain ? terrainExaggeration : 1.0;
      return;
    }
    const ds = dataSourcesRef.current.get(id);
    if (!next[id]) {
      if (ds) {
        viewer.dataSources.remove(ds, true);
        dataSourcesRef.current.delete(id);
      }
      return;
    }
    const styleMap: Record<string, "buildings" | "roads" | "water" | "vegetation" | "pois" | "boundary"> = {
      buildings: "buildings",
      roads: "roads",
      water: "water",
      vegetation: "vegetation",
      pois: "pois",
      boundary: "boundary",
    };
    if (styleMap[id]) {
      const meta = scene.layers.find((l) => l.id === id);
      await loadLayer(Cesium, scene.citySlug, id, styleMap[id]!, meta?.featureCount ?? 0);
    }
  }

  const showLoadingOverlay =
    loadPhase !== "idle" && loadPhase !== "complete" && (busy || loadPhase !== "error");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "48px 1fr 110px",
        height: "100vh",
        width: "100vw",
        background: "#07090d",
        color: "#e8eef5",
        fontFamily: "var(--polaris-font-sans), 'IBM Plex Sans', sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "#0b0e14",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <span style={{ letterSpacing: "0.14em", fontWeight: 600, fontSize: 16 }}>POLARIS</span>
          <span style={{ fontSize: 11, opacity: 0.55, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Digital Twin
          </span>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "var(--polaris-font-mono), monospace" }}>
          {status}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 300px", minHeight: 0 }}>
        <aside
          style={{
            borderRight: "1px solid rgba(255,255,255,0.08)",
            background: "#0b0e14",
            padding: 12,
            display: "grid",
            gap: 16,
            alignContent: "start",
            overflow: "auto",
          }}
        >
          <section>
            <Label>Cities</Label>
            <div style={{ display: "grid", gap: 6 }}>
              {demoCities.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  disabled={busy || !viewerReady}
                  onClick={() => void openCity(c.query)}
                  style={btn(scene?.citySlug === c.slug)}
                >
                  {c.displayName}
                </button>
              ))}
            </div>
            {compiled.length > 0 && (
              <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                <Label>Compiled</Label>
                {compiled.map((c) => (
                  <button
                    key={c.citySlug}
                    type="button"
                    onClick={() => void openCity(c.citySlug)}
                    style={{ ...btn(false), fontSize: 12, opacity: 0.85 }}
                  >
                    {c.cityDisplayName} · {c.layersReady} layers
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <Label>Camera</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(
                [
                  ["overview", "Overview"],
                  ["street", "Street"],
                  ["orbit", "Orbit"],
                  ["reset", "Reset"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" disabled={!scene} onClick={() => void applyCameraPreset(id)} style={btn(false)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label>Lighting</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {(["day", "dusk", "night"] as const).map((m) => (
                <button key={m} type="button" onClick={() => void setLightingMode(m)} style={btn(dayNight === m)}>
                  {m}
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label>Terrain exaggeration · {terrainExaggeration.toFixed(1)}×</Label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={terrainExaggeration}
              disabled={!scene}
              onChange={(e) => setExaggeration(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </section>

          <section>
            <Label>Search</Label>
            <input
              value={searchQ}
              onChange={(e) => void runSearch(e.target.value)}
              placeholder="Airport, hospital, school…"
              style={input}
            />
            <div style={{ marginTop: 8, display: "grid", gap: 4, maxHeight: 180, overflow: "auto" }}>
              {searchHits.map((h) => (
                <button key={String(h.id)} type="button" onClick={() => void flyToHit(h)} style={hitBtn}>
                  <div style={{ fontWeight: 500 }}>{h.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.55, textTransform: "uppercase" }}>{h.kind}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Label>Layers</Label>
            <div style={{ display: "grid", gap: 6 }}>
              {(Object.keys(LAYER_DEFAULTS) as LayerId[]).map((id) => {
                const meta = scene?.layers.find((l) => l.id === id);
                return (
                  <label
                    key={id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 12,
                      opacity: meta?.status === "missing" ? 0.4 : 1,
                    }}
                  >
                    <span>
                      <input
                        type="checkbox"
                        checked={layersOn[id]}
                        disabled={meta?.status === "missing"}
                        onChange={() => void toggleLayer(id)}
                      />{" "}
                      {meta?.label ?? id}
                    </span>
                    <span style={{ fontFamily: "monospace", opacity: 0.5 }}>
                      {meta ? meta.featureCount : "—"}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </aside>

        <main style={{ position: "relative", minWidth: 0, background: "#05070a" }}>
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
          {!scene && loadPhase === "idle" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
                background: "radial-gradient(ellipse at center, rgba(11,14,20,0.15), rgba(7,9,13,0.82))",
              }}
            >
              <div style={{ textAlign: "center", maxWidth: 380 }}>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.06em" }}>Select a city</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>
                  Monaco · Singapore · Amsterdam — real OSM + DEM. Aerial imagery preferred; missing layers reported, never fabricated.
                </div>
              </div>
            </div>
          )}
          {(showLoadingOverlay || loadPhase === "complete") && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
                background:
                  loadPhase === "complete"
                    ? "transparent"
                    : "radial-gradient(ellipse at center, rgba(7,9,13,0.35), rgba(7,9,13,0.72))",
                transition: "opacity 0.4s ease",
                opacity: loadPhase === "complete" ? 0 : 1,
              }}
            >
              <div
                style={{
                  minWidth: 280,
                  padding: "20px 24px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(11,14,20,0.88)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>
                  Digital Twin
                </div>
                <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600 }}>
                  {LOADING_LABELS[loadPhase === "complete" ? "complete" : loadPhase]}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${loadProgress}%`,
                      height: "100%",
                      background: "#3de1ff",
                      transition: "width 0.25s ease",
                    }}
                  />
                </div>
                <div style={{ marginTop: 8, fontSize: 11, opacity: 0.55, fontFamily: "monospace" }}>
                  {loadProgress}%
                </div>
              </div>
            </div>
          )}
        </main>

        <aside
          style={{
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            background: "#0b0e14",
            padding: 12,
            display: "grid",
            gap: 12,
            alignContent: "start",
            overflow: "auto",
          }}
        >
          <Panel title="Selected object">
            {!selected ? (
              <Muted>Click a feature in the twin</Muted>
            ) : (
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                {Object.entries(selected).map(([k, v]) => (
                  <Row key={k} k={k} v={String(v ?? "")} />
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Render stack">
            <div style={{ fontSize: 11, display: "grid", gap: 6, lineHeight: 1.4 }}>
              <Row k="imagery" v={imageryLabel} />
              <Row k="terrain" v={terrainLabel} />
              <Row k="exaggeration" v={`${terrainExaggeration.toFixed(1)}×`} />
              <Row k="lighting" v={dayNight} />
            </div>
          </Panel>
          <Panel title="Coordinates">
            {cursor ? (
              <div style={{ fontFamily: "monospace", fontSize: 11, display: "grid", gap: 4 }}>
                <span>lon {cursor.lon.toFixed(6)}</span>
                <span>lat {cursor.lat.toFixed(6)}</span>
              </div>
            ) : (
              <Muted>Move cursor over globe</Muted>
            )}
          </Panel>
          <Panel title="Dataset provenance">
            {!scene ? (
              <Muted>Load a city</Muted>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {scene.layers
                  .filter((l) => l.provenance)
                  .map((l) => (
                    <div key={l.id} style={{ fontSize: 11, lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 600 }}>{l.label}</div>
                      <div style={{ opacity: 0.65 }}>
                        {l.provenance!.sourceName} · {l.provenance!.license}
                      </div>
                      <div style={{ opacity: 0.45 }}>{l.provenance!.attribution}</div>
                      {l.note ? <div style={{ opacity: 0.5, marginTop: 2 }}>{l.note}</div> : null}
                    </div>
                  ))}
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>
                  Building heights: OSM <code>height</code> / <code>building:levels</code>; else documented 10 m fallback.
                </div>
              </div>
            )}
          </Panel>
          {scene?.missing?.length ? (
            <Panel title="Missing / deferred">
              <div style={{ fontSize: 11, opacity: 0.7, display: "grid", gap: 4 }}>
                {scene.missing.map((m) => (
                  <div key={m}>· {m}</div>
                ))}
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>

      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "#0b0e14",
          padding: "10px 16px",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.55 }}>
          <span>Compilation / datasets</span>
          <span>{job ? `${job.phase} ${job.percent}%` : scene ? "ready" : "idle"}</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${job?.percent ?? (scene ? 100 : loadProgress)}%`,
              height: "100%",
              background: "#3de1ff",
              transition: "width 0.35s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.65, minHeight: 28 }}>
          {job?.message ??
            (scene
              ? scene.layers.map((l) => `${l.id}:${l.status}`).join(" · ")
              : "Awaiting city selection")}
          {job?.error ? ` — ${job.error}` : ""}
        </div>
      </footer>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 0.45,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{
          padding: "8px 10px",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: 0.5,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {title}
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </section>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, opacity: 0.45 }}>{children}</div>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ opacity: 0.55 }}>{k}</span>
      <span style={{ fontFamily: "monospace", textAlign: "right", wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}

const btn = (active: boolean): CSSProperties => ({
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 6,
  border: active ? "1px solid rgba(61,225,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
  background: active ? "rgba(61,225,255,0.1)" : "transparent",
  color: "#e8eef5",
  cursor: "pointer",
  fontSize: 13,
});

const hitBtn: CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid transparent",
  background: "transparent",
  color: "#e8eef5",
  cursor: "pointer",
};

const input: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#12161f",
  color: "#e8eef5",
  fontSize: 13,
};
