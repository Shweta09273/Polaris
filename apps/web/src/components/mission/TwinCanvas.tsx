"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  applyCitySun,
  createStableViewer,
  sampleHeightmap,
  shouldUseAoiHeightmapForBases,
  upgradeVisualsOptionally,
} from "../twin/cesiumVisual";
import {
  applySelectionHighlight,
  styleBoundaryEntity,
  styleBuildingEntity,
  stylePoiEntity,
  styleRoadEntity,
  styleVegetationEntity,
  styleWaterEntity,
} from "../twin/layerStyles";
import type { ExperimentResultView, TwinTelemetry } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AoiHeightmap = {
  cols: number;
  rows: number;
  west: number;
  south: number;
  east: number;
  north: number;
  heights: number[];
};

export interface TwinSceneLite {
  citySlug: string;
  cityDisplayName: string;
  camera: { lon: number; lat: number; height: number; heading: number; pitch: number };
  layers: Array<{ id: string; status: string; featureCount: number }>;
  terrain: { status: string; path?: string };
  missing?: string[];
}

export type TwinCanvasHandle = {
  mountScene: (scene: TwinSceneLite) => Promise<void>;
  applyExperimentFrame: (
    result: ExperimentResultView | null,
    frameIndex: number,
  ) => Promise<void>;
  flyTo: (lon: number, lat: number, height?: number) => Promise<void>;
  getEpicenter: () => { lon: number; lat: number } | null;
  setLayerVisible: (layerId: string, visible: boolean) => void;
  selectAndFlyTo: (opts: {
    id?: string;
    lon: number;
    lat: number;
    name?: string;
    kind?: string;
  }) => Promise<void>;
};

type Props = {
  onStatus?: (s: string) => void;
  onReady?: () => void;
  onSelect?: (props: Record<string, unknown> | null) => void;
  onTelemetry?: (t: TwinTelemetry) => void;
  pickEpicenter?: boolean;
  onEpicenter?: (p: { lon: number; lat: number }) => void;
};

function enrichEntityProps(
  Cesium: typeof import("cesium"),
  entity: import("cesium").Entity,
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    id: entity.id,
    name: entity.name ?? "Unnamed",
  };
  if (entity.properties) {
    for (const n of entity.properties.propertyNames as string[]) {
      try {
        props[n] = entity.properties[n]?.getValue?.(Cesium.JulianDate.now());
      } catch {
        /* skip */
      }
    }
  }

  // Coordinates
  try {
    let cartesian: import("cesium").Cartesian3 | undefined;
    if (entity.position) {
      cartesian = entity.position.getValue(Cesium.JulianDate.now());
    } else if (entity.polygon?.hierarchy) {
      const h = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
      cartesian = h?.positions?.[0];
    } else if (entity.polyline?.positions) {
      const positions = entity.polyline.positions.getValue(Cesium.JulianDate.now());
      cartesian = positions?.[0];
    }
    if (cartesian) {
      const c = Cesium.Cartographic.fromCartesian(cartesian);
      props.lon = Number(Cesium.Math.toDegrees(c.longitude).toFixed(6));
      props.lat = Number(Cesium.Math.toDegrees(c.latitude).toFixed(6));
      props.coordinates = `${props.lon}, ${props.lat}`;
    }
  } catch {
    /* */
  }

  const kind = String(props.kind ?? props.highway ?? (entity.polygon ? "building" : entity.polyline ? "road" : "feature"));
  props.type = kind;
  if (props.visualArchetype) props.visual_classification = String(props.visualArchetype);
  if (props.heightSource === "estimated" || props.heightFromOsm === false) {
    props.height_status = "estimated";
  } else if (props.heightSource || props.heightFromOsm === true) {
    props.height_status = "authoritative";
  }

  if (props.provenance != null) props.dataset_source = String(props.provenance);
  else if (String(props.id ?? entity.id).startsWith("osm-")) {
    props.dataset_source = "OpenStreetMap (twin layer)";
  }

  const osmCandidate = String(props.id ?? entity.id);
  const osmMatch = osmCandidate.match(/^osm-(?:building|road|water|waterway|veg|poi)-(\d+)$/);
  if (osmMatch) props.osm_id = osmMatch[1];

  const hasIdentity = Boolean(props.name || props.kind || props.osm_id || props.provenance);
  if (!hasIdentity) {
    props.metadata_status = "Metadata unavailable for this entity.";
  }

  if (entity.polygon) props.geometry = "Polygon (extruded building or area)";
  else if (entity.polyline) props.geometry = "LineString (road / path)";
  else if (entity.point) props.geometry = "Point (POI)";
  else props.geometry = "Unknown";

  return props;
}

export const TwinCanvas = forwardRef<TwinCanvasHandle, Props>(function TwinCanvas(
  { onStatus, onReady, onSelect, onTelemetry, pickEpicenter, onEpicenter },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const dataSourcesRef = useRef<Map<string, import("cesium").DataSource>>(new Map());
  const experimentDsRef = useRef<Map<string, import("cesium").DataSource>>(new Map());
  const heightmapRef = useRef<AoiHeightmap | null>(null);
  const epicenterRef = useRef<{ lon: number; lat: number } | null>(null);
  const pickRef = useRef(Boolean(pickEpicenter));
  const onEpicenterRef = useRef(onEpicenter);
  const onStatusRef = useRef(onStatus);
  const onSelectRef = useRef(onSelect);
  const onTelemetryRef = useRef(onTelemetry);
  const onReadyRef = useRef(onReady);
  const [ready, setReady] = useState(false);
  const [popup, setPopup] = useState<{ x: number; y: number; title: string; body: string } | null>(
    null,
  );

  pickRef.current = Boolean(pickEpicenter);
  onEpicenterRef.current = onEpicenter;
  onStatusRef.current = onStatus;
  onSelectRef.current = onSelect;
  onTelemetryRef.current = onTelemetry;
  onReadyRef.current = onReady;

  // Viewer must be created exactly once. Never put callbacks in deps — parent
  // re-renders (telemetry HUD) would destroy/recreate WebGL and flicker the globe.
  useEffect(() => {
    let cancelled = false;
    let removeTick: (() => void) | undefined;
    let handler: import("cesium").ScreenSpaceEventHandler | undefined;
    async function boot() {
      if (!containerRef.current || viewerRef.current) return;
      const Cesium = await import("cesium");
      (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium";
      if (cancelled || !containerRef.current) return;
      // Leftover Cesium DOM from a destroyed Viewer would make the next construct fail.
      if (containerRef.current.querySelector(".cesium-viewer, .cesium-widget")) {
        containerRef.current.replaceChildren();
      }

      let viewer: import("cesium").Viewer;
      let imageryLabel = "OpenStreetMap";
      try {
        const created = await createStableViewer(Cesium, containerRef.current);
        if (cancelled) {
          created.viewer.destroy();
          return;
        }
        viewer = created.viewer;
        imageryLabel = created.imageryLabel;
        onStatusRef.current?.(
          `Twin viewport ready · ${created.imageryLabel} · ${created.terrainLabel}`,
        );
      } catch (err) {
        console.error("[polaris.cesium] Viewer construction failed", err);
        onStatusRef.current?.(
          `Viewer failed: ${err instanceof Error ? err.message : "WebGL init error"}`,
        );
        return;
      }

      viewer.selectedEntityChanged.addEventListener(() => {
        const e = viewer.selectedEntity;
        if (!e) {
          onSelectRef.current?.(null);
          setPopup(null);
          return;
        }
        applySelectionHighlight(Cesium, e);
        const props = enrichEntityProps(Cesium, e);
        onSelectRef.current?.(props);
        const ordered = [
          "name",
          "type",
          "coordinates",
          "lon",
          "lat",
          "dataset_source",
          "osm_id",
          "geometry",
          "id",
          "kind",
          "visualArchetype",
          "visualMaterial",
          "visualConfidence",
          "visualClassification",
          "heightResolved",
          "heightSource",
          "heightNote",
          "highway",
          "height",
          "provenance",
          "license",
          "reason",
          "severity",
          "metadata_status",
        ];
        const lines: string[] = [];
        for (const k of ordered) {
          if (props[k] != null && props[k] !== "") lines.push(`${k}: ${String(props[k])}`);
        }
        for (const [k, v] of Object.entries(props)) {
          if (ordered.includes(k) || v == null || v === "") continue;
          if (lines.length >= 14) break;
          lines.push(`${k}: ${String(v)}`);
        }
        setPopup({
          x: Math.min(viewer.canvas.clientWidth * 0.55, viewer.canvas.clientWidth - 160),
          y: Math.min(viewer.canvas.clientHeight * 0.35, viewer.canvas.clientHeight - 80),
          title: String(props.name ?? props.id),
          body: lines.join("\n"),
        });
      });

      // Custom click: prefer entity pick; epicenter only on empty globe when pick mode on
      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: { position: import("cesium").Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked) && picked && typeof picked === "object" && "id" in picked) {
          const ent = (picked as { id: import("cesium").Entity }).id;
          if (ent && ent instanceof Cesium.Entity) {
            viewer.selectedEntity = ent;
            return;
          }
        }
        if (!pickRef.current) return;
        const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        if (!cartesian) return;
        const c = Cesium.Cartographic.fromCartesian(cartesian);
        const p = {
          lon: Cesium.Math.toDegrees(c.longitude),
          lat: Cesium.Math.toDegrees(c.latitude),
        };
        epicenterRef.current = p;
        onEpicenterRef.current?.(p);
        onStatusRef.current?.(`Epicenter ${p.lon.toFixed(5)}, ${p.lat.toFixed(5)}`);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      let frames = 0;
      let last = performance.now();
      const tick = () => {
        frames += 1;
        const now = performance.now();
        if (now - last >= 1000) {
          const fps = Math.round((frames * 1000) / (now - last));
          frames = 0;
          last = now;
          const carto = viewer.camera.positionCartographic;
          const heading = Cesium.Math.toDegrees(viewer.camera.heading);
          const height = carto.height;
          const scaleM = Math.max(1, Math.round(height * 0.12));
          onTelemetryRef.current?.({
            fps,
            headingDeg: ((heading % 360) + 360) % 360,
            heightM: height,
            lon: Cesium.Math.toDegrees(carto.longitude),
            lat: Cesium.Math.toDegrees(carto.latitude),
            scaleM,
          });
        }
      };
      viewer.scene.postRender.addEventListener(tick);
      removeTick = () => viewer.scene.postRender.removeEventListener(tick);

      viewerRef.current = viewer;
      setReady(true);
      onReadyRef.current?.();
      onStatusRef.current?.(`Twin viewport ready · ${imageryLabel}`);
      void upgradeVisualsOptionally(Cesium, viewer, { imagery: true, terrain: false }).then((up) => {
        if (up.imageryLabel) {
          onStatusRef.current?.(`Imagery · ${up.imageryLabel}`);
        }
      });
    }
    void boot();
    return () => {
      cancelled = true;
      removeTick?.();
      try {
        handler?.destroy();
      } catch {
        /* */
      }
      const existing = viewerRef.current;
      viewerRef.current = null;
      heightmapRef.current = null;
      if (existing) {
        try {
          existing.destroy();
        } catch {
          /* Viewer already torn down */
        }
      }
    };
  }, []);

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
    count = 0,
  ) {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const prev = dataSourcesRef.current.get(layerId);
    if (prev) {
      viewer.dataSources.remove(prev, true);
      dataSourcesRef.current.delete(layerId);
    }
    const url = `${API_BASE}/v1/twin3d/cities/${slug}/file?path=${encodeURIComponent(`layers/${layerId}.geojson`)}`;
    const res = await fetch(url);
    if (!res.ok) {
      onStatusRef.current?.(`Layer ${layerId} unavailable (HTTP ${res.status})`);
      return;
    }
    const fc = (await res.json()) as { features?: Array<Record<string, unknown>> };
    const features = fc.features ?? [];
    if (features.length === 0) {
      onStatusRef.current?.(`Layer ${layerId} empty — skipping`);
      return;
    }
    const ds = new Cesium.CustomDataSource(layerId);
    const useOutlines = style === "buildings" && count <= 4000;
    await viewer.dataSources.add(ds);
    dataSourcesRef.current.set(layerId, ds);
    const CHUNK = 1200;
    for (let i = 0; i < features.length; i += CHUNK) {
      const slice = features.slice(i, i + CHUNK);
      const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: slice })], {
        type: "application/json",
      });
      const blobUrl = URL.createObjectURL(blob);
      try {
        const part = await Cesium.GeoJsonDataSource.load(blobUrl, {
          clampToGround: style !== "buildings",
        });
        for (const entity of part.entities.values) {
          if (style === "buildings") {
            styleBuildingEntity(Cesium, entity, {
              useOutlines,
              groundHeight: groundHeightForEntity(Cesium, entity),
            });
          }
          else if (style === "roads") styleRoadEntity(Cesium, entity);
          else if (style === "water") styleWaterEntity(Cesium, entity);
          else if (style === "vegetation") styleVegetationEntity(Cesium, entity);
          else if (style === "boundary") styleBoundaryEntity(Cesium, entity);
          else if (style === "pois") stylePoiEntity(Cesium, entity);
          ds.entities.add(entity);
        }
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      onStatusRef.current?.(
        `Loading ${layerId} ${Math.min(features.length, i + CHUNK)}/${features.length}`,
      );
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  useImperativeHandle(ref, () => ({
    async mountScene(scene) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const Cesium = await import("cesium");
      for (const ds of dataSourcesRef.current.values()) viewer.dataSources.remove(ds, true);
      dataSourcesRef.current.clear();
      for (const ds of experimentDsRef.current.values()) viewer.dataSources.remove(ds, true);
      experimentDsRef.current.clear();
      heightmapRef.current = null;
      setPopup(null);
      viewer.selectedEntity = undefined;

      if (scene.terrain.status === "ready" && scene.terrain.path) {
        try {
          const hmRes = await fetch(
            `${API_BASE}/v1/twin3d/cities/${scene.citySlug}/file?path=${encodeURIComponent(scene.terrain.path)}`,
          );
          if (hmRes.ok) {
            const hm = (await hmRes.json()) as AoiHeightmap;
            if (hm.heights?.length) heightmapRef.current = hm;
          } else {
            onStatusRef.current?.("Terrain DEM unavailable — ellipsoid fallback");
          }
        } catch {
          onStatusRef.current?.("Terrain DEM unavailable — ellipsoid fallback");
        }
      }

      epicenterRef.current = { lon: scene.camera.lon, lat: scene.camera.lat };
      applyCitySun(Cesium, viewer, scene.camera.lon);
      // Immediate city framing — never leave user on global Earth
      const cityHeight = Math.min(Math.max(scene.camera.height * 0.08, 800), 3500);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(scene.camera.lon, scene.camera.lat, cityHeight),
        orientation: {
          heading: Cesium.Math.toRadians(scene.camera.heading || 20),
          pitch: Cesium.Math.toRadians(-40),
          roll: 0,
        },
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });

      const order: Array<[string, "buildings" | "roads" | "water" | "vegetation" | "pois" | "boundary"]> = [
        ["boundary", "boundary"],
        ["water", "water"],
        ["vegetation", "vegetation"],
        ["roads", "roads"],
        ["buildings", "buildings"],
        ["pois", "pois"],
      ];
      for (const [id, style] of order) {
        const meta = scene.layers.find((l) => l.id === id);
        if (!meta || meta.status === "missing" || meta.featureCount === 0) continue;
        try {
          await loadLayer(Cesium, scene.citySlug, id, style, meta.featureCount);
        } catch (e) {
          console.warn(e);
        }
      }

      // Re-affirm city camera after layers stream in
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(scene.camera.lon, scene.camera.lat, cityHeight),
        orientation: {
          heading: Cesium.Math.toRadians(scene.camera.heading || 20),
          pitch: Cesium.Math.toRadians(-38),
          roll: 0,
        },
        duration: 1.2,
      });
      onStatusRef.current?.(`${scene.cityDisplayName} twin mounted`);
    },

    async applyExperimentFrame(result, frameIndex) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const Cesium = await import("cesium");
      for (const ds of experimentDsRef.current.values()) viewer.dataSources.remove(ds, true);
      experimentDsRef.current.clear();
      if (!result) return;
      const frame = result.timeline[frameIndex] ?? result.timeline[0];
      if (!frame || frame.intensityFactor <= 0) return;

      const opacity = Math.max(0.25, frame.intensityFactor);
      for (const layer of result.outputLayers) {
        if (layer.kind === "heatmap" && frame.intensityFactor < 0.3) continue;
        const ds = await Cesium.GeoJsonDataSource.load(layer.geojson as never, { clampToGround: true });
        for (const entity of ds.entities.values) {
          if (entity.polygon) {
            const rainAlpha = 0.15 + 0.25 * opacity;
            entity.polygon.material = new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString("#2ec5ff").withAlpha(rainAlpha),
            );
            entity.polygon.outline = new Cesium.ConstantProperty(true);
            entity.polygon.outlineColor = new Cesium.ConstantProperty(
              Cesium.Color.fromCssColorString("#7ee7ff").withAlpha(0.95 * opacity),
            );
          }
          if (entity.polyline) {
            entity.polyline.width = new Cesium.ConstantProperty(3 + 2 * opacity);
            entity.polyline.material = new Cesium.ColorMaterialProperty(
              Cesium.Color.fromCssColorString("#ff5c5c").withAlpha(0.85 * opacity),
            );
          }
          if (!entity.polygon && !entity.polyline) {
            const score = Number(entity.properties?.score?.getValue?.() ?? 0);
            const sev = String(entity.properties?.severity?.getValue?.() ?? "medium");
            const color =
              score > 0
                ? Cesium.Color.fromCssColorString("#4dabf7").withAlpha(0.3 + score * 0.6 * opacity)
                : sev === "critical"
                  ? Cesium.Color.fromCssColorString("#ff5c5c")
                  : sev === "high"
                    ? Cesium.Color.fromCssColorString("#f5c542")
                    : Cesium.Color.fromCssColorString("#3de1ff");
            entity.point = new Cesium.PointGraphics({
              pixelSize: score > 0 ? 6 + score * 10 * opacity : 9,
              color: color.withAlpha(opacity),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            });
          }
        }
        await viewer.dataSources.add(ds);
        experimentDsRef.current.set(layer.id, ds);
      }

      if (frameIndex === 0 || frame.label === "Before") return;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(result.epicenter.lon, result.epicenter.lat, 850),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-42), roll: 0 },
        duration: 1.0,
      });
    },

    async flyTo(lon, lat, height = 450) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const Cesium = await import("cesium");
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-40), roll: 0 },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    },

    getEpicenter() {
      return epicenterRef.current;
    },

    setLayerVisible(layerId, visible) {
      const ds = dataSourcesRef.current.get(layerId);
      if (ds) ds.show = visible;
      if (layerId === "experiment") {
        for (const eds of experimentDsRef.current.values()) eds.show = visible;
      }
    },

    async selectAndFlyTo(opts) {
      const viewer = viewerRef.current;
      if (!viewer) return;
      const Cesium = await import("cesium");
      let found: import("cesium").Entity | undefined;
      if (opts.id) {
        for (const ds of dataSourcesRef.current.values()) {
          const e = ds.entities.getById(opts.id);
          if (e) {
            found = e;
            break;
          }
          for (const ent of ds.entities.values) {
            try {
              const pid = ent.properties?.id?.getValue?.(Cesium.JulianDate.now());
              if (String(ent.id) === opts.id || String(pid) === opts.id) {
                found = ent;
                break;
              }
            } catch {
              /* */
            }
          }
          if (found) break;
        }
      }
      if (found) {
        viewer.selectedEntity = found;
        applySelectionHighlight(Cesium, found);
      } else {
        viewer.selectedEntity = undefined;
        onSelectRef.current?.({
          name: opts.name ?? "Search hit",
          type: opts.kind ?? "feature",
          lon: opts.lon,
          lat: opts.lat,
          coordinates: `${opts.lon.toFixed(6)}, ${opts.lat.toFixed(6)}`,
          dataset_source: "OpenStreetMap search index",
          id: opts.id,
        });
      }
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(opts.lon, opts.lat, 380),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-42), roll: 0 },
        duration: 1.6,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    },
  }));

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            color: "var(--mc-text-muted)",
          }}
        >
          Initializing twin viewport…
        </div>
      )}
      {popup && (
        <div
          className="mc-context-popup"
          style={{ left: popup.x, top: popup.y }}
          role="dialog"
          aria-label="Selected feature"
        >
          <strong>{popup.title}</strong>
          <pre>{popup.body}</pre>
          <button type="button" onClick={() => setPopup(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
});
