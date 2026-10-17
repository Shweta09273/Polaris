"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TwinCanvas, type TwinCanvasHandle, type TwinSceneLite } from "./TwinCanvas";
import { MissionIntelligence } from "./MissionIntelligence";
import type {
  DecisionBrief,
  ExperimentResultView,
  PolarTheme,
  ScenarioItem,
  TwinTelemetry,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const THEME_KEY = "polaris.mc.theme";

const SCENARIO_INTENSITY: Record<string, number> = {
  normal: 25,
  heavy: 60,
  extreme: 120,
  cloudburst: 180,
};

interface DemoCity {
  slug: string;
  displayName: string;
  query: string;
}

export function MissionControl() {
  const twinRef = useRef<TwinCanvasHandle>(null);
  const playRef = useRef<number | null>(null);
  const [theme, setTheme] = useState<PolarTheme>("mission-dark");
  const [demoCities, setDemoCities] = useState<DemoCity[]>([]);
  const [catalog, setCatalog] = useState<ScenarioItem[]>([]);
  const [scene, setScene] = useState<TwinSceneLite | null>(null);
  const [selectedKind, setSelectedKind] = useState<string>("heavy_rain");
  const [params, setParams] = useState<Record<string, number | string | boolean>>({});
  const [epicenter, setEpicenter] = useState<{ lon: number; lat: number } | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Booting Mission Control…");
  const [progress, setProgress] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<ExperimentResultView | null>(null);
  const [brief, setBrief] = useState<DecisionBrief | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<
    Array<{ id: string; name: string; kind: string; lon: number; lat: number }>
  >([]);
  const [telemetry, setTelemetry] = useState<TwinTelemetry>({
    fps: 0,
    headingDeg: 0,
    heightM: 0,
    lon: 0,
    lat: 0,
    scaleM: 0,
  });
  const [layersOn, setLayersOn] = useState({
    buildings: true,
    roads: true,
    water: true,
    vegetation: true,
    pois: true,
    experiment: true,
  });
  const layersOnRef = useRef(layersOn);
  layersOnRef.current = layersOn;

  const scenario = catalog.find((c) => c.kind === selectedKind) ?? null;
  const rainfallScenario = catalog.find((c) => c.kind === "heavy_rain");
  const autoOpenedRef = useRef(false);

  const handleViewerReady = useCallback(() => {
    setViewerReady(true);
  }, []);

  const handleTelemetry = useCallback((t: TwinTelemetry) => {
    setTelemetry((prev) => {
      if (
        prev.fps === t.fps &&
        Math.abs(prev.headingDeg - t.headingDeg) < 0.5 &&
        Math.abs(prev.heightM - t.heightM) < 2 &&
        Math.abs(prev.lon - t.lon) < 0.00005 &&
        Math.abs(prev.lat - t.lat) < 0.00005
      ) {
        return prev;
      }
      return t;
    });
  }, []);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(THEME_KEY)) as PolarTheme | null;
    const t =
      saved === "aurora-light" || saved === "cosmic-nebula" || saved === "mission-dark"
        ? saved
        : "mission-dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    void fetch(`${API_BASE}/v1/twin3d/demo-cities`)
      .then((r) => r.json())
      .then((d: { items: DemoCity[] }) => setDemoCities(d.items))
      .catch(() => setStatus("API offline — start @polaris/api"));
    void fetch(`${API_BASE}/v1/experiments/catalog`)
      .then((r) => r.json())
      .then((d: { items: ScenarioItem[] }) => {
        setCatalog(d.items);
        const rain = d.items.find((i) => i.kind === "heavy_rain") ?? d.items[0];
        if (rain) {
          setSelectedKind(rain.kind);
          const defaults: Record<string, number | string | boolean> = {};
          for (const p of rain.parameters) defaults[p.key] = p.default;
          if (defaults.rainfall_scenario) {
            const key = String(defaults.rainfall_scenario);
            if (SCENARIO_INTENSITY[key] != null) defaults.intensity_mm_hr = SCENARIO_INTENSITY[key]!;
          }
          setParams(defaults);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!scenario) return;
    const defaults: Record<string, number | string | boolean> = {};
    for (const p of scenario.parameters) defaults[p.key] = p.default;
    if (defaults.rainfall_scenario) {
      const key = String(defaults.rainfall_scenario);
      if (SCENARIO_INTENSITY[key] != null) defaults.intensity_mm_hr = SCENARIO_INTENSITY[key]!;
    }
    setParams(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKind]);

  useEffect(() => {
    if (!playing || !result) return;
    playRef.current = window.setInterval(() => {
      setFrameIndex((i) => {
        const next = i + 1 >= result.timeline.length ? 0 : i + 1;
        void twinRef.current?.applyExperimentFrame(result, next);
        const frame = result.timeline[next];
        if (frame) setStatus(`${frame.label} · ${frame.summary}`);
        return next;
      });
    }, 1600);
    return () => {
      if (playRef.current) window.clearInterval(playRef.current);
    };
  }, [playing, result]);

  const applyLayerVisibility = useCallback(() => {
    const vis = layersOnRef.current;
    twinRef.current?.setLayerVisible("buildings", vis.buildings);
    twinRef.current?.setLayerVisible("roads", vis.roads);
    twinRef.current?.setLayerVisible("water", vis.water);
    twinRef.current?.setLayerVisible("vegetation", vis.vegetation);
    twinRef.current?.setLayerVisible("pois", vis.pois);
    twinRef.current?.setLayerVisible("experiment", vis.experiment);
  }, []);

  const openCity = useCallback(async (cityName: string) => {
    setBusy(true);
    setProgress(5);
    setStatus(`Opening ${cityName}…`);
    setResult(null);
    setBrief(null);
    setFrameIndex(0);
    setPlaying(false);
    setSearchHits([]);
    setSearchQ("");
    try {
      const res = await fetch(`${API_BASE}/v1/twin3d/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cityName }),
      });
      const data = (await res.json()) as {
        scene?: TwinSceneLite;
        message?: string;
        jobId?: string;
        mode?: string;
      };

      if (res.status === 202 && data.jobId) {
        setStatus(data.message ?? "Compiling Digital Twin…");
        setProgress(10);
        await new Promise<void>((resolve, reject) => {
          const started = Date.now();
          const COMPILE_TIMEOUT_MS = 25 * 60 * 1000;
          let consecutiveErrors = 0;
          const t = window.setInterval(() => {
            if (Date.now() - started > COMPILE_TIMEOUT_MS) {
              clearInterval(t);
              reject(new Error("Twin compile timed out after 25 minutes"));
              return;
            }
            void fetch(`${API_BASE}/v1/twin3d/jobs/${data.jobId}`)
              .then((r) => {
                if (!r.ok) throw new Error(`Job poll HTTP ${r.status}`);
                return r.json();
              })
              .then(async (j: {
                phase: string;
                percent: number;
                message: string;
                error?: string;
                result?: { scene: TwinSceneLite; citySlug: string };
              }) => {
                consecutiveErrors = 0;
                setProgress(Math.max(10, j.percent));
                setStatus(`${j.phase} ${j.percent}% — ${j.message}`);
                if (j.phase === "complete" && j.result?.scene) {
                  clearInterval(t);
                  void (async () => {
                    setScene(j.result!.scene);
                    setEpicenter({ lon: j.result!.scene.camera.lon, lat: j.result!.scene.camera.lat });
                    await twinRef.current?.mountScene(j.result!.scene);
                    applyLayerVisibility();
                    setProgress(100);
                    setStatus(`${j.result!.scene.cityDisplayName} ready`);
                    resolve();
                  })();
                }
                if (j.phase === "failed") {
                  clearInterval(t);
                  reject(new Error(j.error ?? "Twin compile failed"));
                }
              })
              .catch((err) => {
                consecutiveErrors += 1;
                if (consecutiveErrors >= 8) {
                  clearInterval(t);
                  reject(err instanceof Error ? err : new Error("Twin compile poll failed"));
                }
              });
          }, 2000);
        });
      } else if (data.scene) {
        setScene(data.scene);
        setEpicenter({ lon: data.scene.camera.lon, lat: data.scene.camera.lat });
        setProgress(35);
        setStatus(`Mounting ${data.scene.cityDisplayName} Digital Twin…`);
        await twinRef.current?.mountScene(data.scene);
        applyLayerVisibility();
        setProgress(100);
        setStatus(`${data.scene.cityDisplayName} ready — search, pick, or run Extreme Rainfall`);
        // Prefetch search index sample
        void fetch(`${API_BASE}/v1/twin3d/cities/${data.scene.citySlug}/search?q=`)
          .then((r) => r.json())
          .then((d: { items: typeof searchHits }) => setSearchHits(d.items ?? []))
          .catch(() => undefined);
      } else {
        setStatus(data.message ?? "Open failed");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "API unreachable");
    } finally {
      setBusy(false);
    }
  }, [applyLayerVisibility]);

  // Auto-mount Monaco once Viewer is stable — never leave operator on bare globe
  useEffect(() => {
    if (!viewerReady || autoOpenedRef.current || busy || scene) return;
    const monaco =
      demoCities.find((c) => c.slug === "monaco") ??
      demoCities.find((c) => /monaco/i.test(c.displayName) || /monaco/i.test(c.query));
    if (!monaco) return;
    autoOpenedRef.current = true;
    void openCity(monaco.query);
  }, [viewerReady, demoCities, busy, scene, openCity]);

  const runSearch = useCallback(
    async (q: string) => {
      setSearchQ(q);
      if (!scene) return;
      try {
        const res = await fetch(
          `${API_BASE}/v1/twin3d/cities/${scene.citySlug}/search?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) {
          setSearchHits([]);
          return;
        }
        const d = (await res.json()) as { items?: typeof searchHits };
        setSearchHits(d.items ?? []);
      } catch {
        setSearchHits([]);
      }
    },
    [scene],
  );

  const flyToHit = useCallback(
    async (hit: { id: string; name: string; kind: string; lon: number; lat: number }) => {
      await twinRef.current?.selectAndFlyTo({
        id: hit.id,
        lon: hit.lon,
        lat: hit.lat,
        name: hit.name,
        kind: hit.kind,
      });
      setStatus(`Fly-to ${hit.name} (${hit.kind})`);
    },
    [],
  );

  const runExperiment = useCallback(async () => {
    if (!scene) {
      setStatus("Choose Monaco (or another twin) first");
      return;
    }
    setBusy(true);
    setProgress(12);
    setPlaying(false);
    setStatus("Running digital rainfall experiment on twin…");
    try {
      const epi = epicenter ?? twinRef.current?.getEpicenter() ?? null;
      const res = await fetch(`${API_BASE}/v1/experiments/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          citySlug: scene.citySlug,
          kind: selectedKind,
          parameters: params,
          ...(epi ? { epicenter: epi } : {}),
        }),
      });
      const data = (await res.json()) as {
        result?: ExperimentResultView;
        decisionBrief?: DecisionBrief;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.result || !data.decisionBrief) {
        setStatus(data.message ?? data.error ?? "Experiment failed");
        setProgress(0);
        return;
      }
      // Normalize timeline labels for older results
      const normalized: ExperimentResultView = {
        ...data.result,
        timeline: data.result.timeline.map((t, i) => ({
          ...t,
          label: t.label ?? (t.phase === "before" ? "Before" : t.phase === "after" ? "Recovery" : `T${i}`),
          intensityFactor: t.intensityFactor ?? (t.phase === "before" ? 0 : t.phase === "after" ? 0.4 : 1),
        })),
      };
      setProgress(75);
      setResult(normalized);
      setBrief(data.decisionBrief);
      const peakIdx = Math.max(
        0,
        normalized.timeline.findIndex((t) => t.intensityFactor >= 0.99),
      );
      const idx = peakIdx >= 0 ? peakIdx : Math.min(4, normalized.timeline.length - 1);
      setFrameIndex(idx);
      if (layersOn.experiment) await twinRef.current?.applyExperimentFrame(normalized, idx);
      setProgress(100);
      setStatus(
        `Mission Intelligence ready · ${normalized.affectedEntities.length} entities · confidence ${(data.decisionBrief.confidence * 100).toFixed(0)}%`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Experiment request failed");
    } finally {
      setBusy(false);
    }
  }, [epicenter, layersOn.experiment, params, scene, selectedKind]);

  const seekFrame = useCallback(
    async (idx: number) => {
      if (!result) return;
      setFrameIndex(idx);
      const frame = result.timeline[idx];
      if (frame) setStatus(`${frame.label} · ${frame.summary}`);
      if (layersOn.experiment) await twinRef.current?.applyExperimentFrame(result, idx);
      else await twinRef.current?.applyExperimentFrame(null, 0);
    },
    [layersOn.experiment, result],
  );

  const updateParam = (key: string, value: number | string | boolean) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "rainfall_scenario") {
        const preset = SCENARIO_INTENSITY[String(value)];
        if (preset != null) next.intensity_mm_hr = preset;
      }
      return next;
    });
  };

  const frame = result?.timeline[frameIndex];

  return (
    <div className="mc-shell mc-shell-v3">
      <header className="mc-header">
        <div className="mc-brand">
          <strong>POLARIS</strong>
          <span>Mission Control</span>
        </div>
        <div className="mc-status-line">{status}</div>
        <div className="mc-theme-switch" role="group" aria-label="Theme">
          {(
            [
              ["mission-dark", "Mission Dark"],
              ["aurora-light", "Aurora Light"],
              ["cosmic-nebula", "Cosmic Nebula"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={theme === id ? "active" : ""}
              onClick={() => setTheme(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mc-body">
        <aside className="mc-rail">
          <section>
            <div className="mc-label">Cities</div>
            <div style={{ display: "grid", gap: 6 }}>
              {demoCities.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className={`mc-btn ${scene?.citySlug === c.slug ? "active" : ""}`}
                  disabled={busy || !viewerReady}
                  onClick={() => void openCity(c.query)}
                >
                  {c.displayName}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mc-label">Experiments</div>
            <div style={{ display: "grid", gap: 6 }}>
              {(rainfallScenario ? [rainfallScenario, ...catalog.filter((c) => c.kind !== "heavy_rain")] : catalog).map(
                (s) => (
                  <button
                    key={s.kind}
                    type="button"
                    className={`mc-btn ${selectedKind === s.kind ? "active" : ""}`}
                    onClick={() => setSelectedKind(s.kind)}
                  >
                    {s.name}
                  </button>
                ),
              )}
            </div>
            {scenario && (
              <p className="mc-muted" style={{ marginTop: 8, fontSize: 11 }}>
                {scenario.description}
              </p>
            )}
          </section>

          <section>
            <div className="mc-label">Parameters</div>
            <div style={{ display: "grid", gap: 10 }}>
              {scenario?.parameters.map((p) => (
                <label key={p.key} style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  <span>
                    {p.label}
                    {p.unit ? ` (${p.unit})` : ""}
                  </span>
                  {p.type === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(params[p.key])}
                      onChange={(e) => updateParam(p.key, e.target.checked)}
                    />
                  ) : p.type === "enum" && p.options ? (
                    <select
                      className="mc-select"
                      value={String(params[p.key] ?? p.default)}
                      onChange={(e) => updateParam(p.key, e.target.value)}
                    >
                      {p.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mc-input"
                      type="number"
                      min={p.min}
                      max={p.max}
                      step={p.step ?? 1}
                      value={Number(params[p.key] ?? p.default)}
                      onChange={(e) => updateParam(p.key, Number(e.target.value))}
                    />
                  )}
                  <span className="mc-muted" style={{ fontSize: 10 }}>
                    {p.description}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="mc-label">Search</div>
            <input
              className="mc-input"
              value={searchQ}
              disabled={!scene}
              onChange={(e) => void runSearch(e.target.value)}
              placeholder="Hospital, airport, school, road…"
            />
            <div style={{ marginTop: 8, display: "grid", gap: 4, maxHeight: 160, overflow: "auto" }}>
              {searchHits.slice(0, 24).map((h) => (
                <button
                  key={String(h.id)}
                  type="button"
                  className="mc-btn"
                  style={{ fontSize: 12, padding: "6px 8px" }}
                  onClick={() => void flyToHit(h)}
                >
                  <div style={{ fontWeight: 500 }}>{h.name}</div>
                  <div className="mc-muted" style={{ fontSize: 10, textTransform: "uppercase" }}>
                    {h.kind}
                  </div>
                </button>
              ))}
              {scene && searchHits.length === 0 && searchQ && (
                <div className="mc-muted" style={{ fontSize: 11 }}>
                  No matches
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mc-label">Layers</div>
            <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
              {(Object.keys(layersOn) as Array<keyof typeof layersOn>).map((id) => (
                <label key={id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={layersOn[id]}
                    disabled={!scene && id !== "experiment"}
                    onChange={() => {
                      const next = { ...layersOn, [id]: !layersOn[id] };
                      setLayersOn(next);
                      if (id === "experiment") {
                        if (result && next.experiment) {
                          void twinRef.current?.applyExperimentFrame(result, frameIndex);
                        } else {
                          void twinRef.current?.applyExperimentFrame(null, 0);
                        }
                      } else {
                        twinRef.current?.setLayerVisible(id, next[id]);
                      }
                    }}
                  />
                  {id}
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="mc-label">Epicenter</div>
            <button
              type="button"
              className={`mc-btn ${pickMode ? "active" : ""}`}
              onClick={() => setPickMode((v) => !v)}
            >
              {pickMode ? "Epicenter pick on (empty globe)" : "Enable epicenter pick"}
            </button>
            <p className="mc-muted" style={{ fontSize: 10, marginTop: 6 }}>
              Click features to inspect. Enable epicenter pick, then click empty ground for rainfall center.
            </p>
            {epicenter && (
              <div className="mc-muted" style={{ marginTop: 6, fontFamily: "var(--polaris-font-mono)", fontSize: 11 }}>
                {epicenter.lon.toFixed(5)}, {epicenter.lat.toFixed(5)}
              </div>
            )}
          </section>

          <button
            type="button"
            className="mc-btn primary"
            disabled={busy || !scene}
            onClick={() => void runExperiment()}
          >
            Run experiment
          </button>

          {result && (
            <section>
              <div className="mc-label">Timeline · {frame?.label ?? "—"}</div>
              <input
                className="mc-range"
                type="range"
                min={0}
                max={Math.max(0, result.timeline.length - 1)}
                value={frameIndex}
                onChange={(e) => void seekFrame(Number(e.target.value))}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button type="button" className="mc-btn" onClick={() => setPlaying((p) => !p)}>
                  {playing ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  className="mc-btn"
                  onClick={() => void seekFrame(0)}
                >
                  Reset
                </button>
              </div>
              <p className="mc-muted" style={{ marginTop: 8, fontSize: 11 }}>
                {frame?.summary}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {result.timeline.map((t, i) => (
                  <button
                    key={`${t.label}-${i}`}
                    type="button"
                    className={`mc-chip-btn ${i === frameIndex ? "active" : ""}`}
                    onClick={() => void seekFrame(i)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>

        <main className="mc-viewport">
          <TwinCanvas
            ref={twinRef}
            pickEpicenter={pickMode}
            onEpicenter={setEpicenter}
            onStatus={setStatus}
            onReady={handleViewerReady}
            onSelect={setSelected}
            onTelemetry={handleTelemetry}
          />
          <div className="mc-hud" aria-hidden={false}>
            <div className="mc-compass" title="Heading">
              <div className="mc-compass-n">N</div>
              <div
                className="mc-compass-needle"
                style={{ transform: `rotate(${-telemetry.headingDeg}deg)` }}
              />
            </div>
            <div className="mc-hud-readouts">
              <span>{telemetry.fps} FPS</span>
              <span>Hdg {telemetry.headingDeg.toFixed(0)}°</span>
              <span>Alt {Math.round(telemetry.heightM)} m</span>
              <span>
                {telemetry.lat.toFixed(4)}, {telemetry.lon.toFixed(4)}
              </span>
              <span>Scale ~{telemetry.scaleM} m</span>
            </div>
          </div>
          {!scene && (
            <div className="mc-empty">
              <div className="mc-overlay-card">
                <div className="mc-label">Digital Twin SSOT</div>
                <div style={{ fontSize: 17, fontWeight: 600 }}>Load Monaco to begin</div>
                <p className="mc-muted" style={{ marginTop: 8 }}>
                  Explore → Extreme Rainfall Experiment → Mission Intelligence → Export brief.
                </p>
              </div>
            </div>
          )}
        </main>

        <aside className="mc-brief">
          <MissionIntelligence brief={brief} result={result} />
          {selected && (
            <section className="mc-panel">
              <div className="mc-panel-h">Selected object</div>
              <div className="mc-panel-b" style={{ display: "grid", gap: 4 }}>
                {(
                  [
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
                    "provenance",
                    "license",
                  ] as const
                ).map((k) =>
                  selected[k] != null && selected[k] !== "" ? (
                    <div key={k} className="mc-row">
                      <span>{k}</span>
                      <span>{String(selected[k])}</span>
                    </div>
                  ) : null,
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      <footer className="mc-footer">
        <div className="mc-footer-top">
          <span>
            System · Twin {scene ? "online" : "idle"} · GPU tiles streaming ·{" "}
            {telemetry.fps > 0 ? `${telemetry.fps} FPS` : "— FPS"}
          </span>
          <span>
            {result
              ? `${result.kind} · frame ${frame?.label ?? "—"} · ${result.affectedEntities.length} entities`
              : scene
                ? `${scene.layers.filter((l) => l.status === "ready").length} layers ready`
                : "awaiting city"}
          </span>
        </div>
        <div className="mc-progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="mc-footer-meta">
          {scene
            ? `datasets: ${scene.layers.map((l) => `${l.id}:${l.status}`).join(" · ")}${
                scene.missing?.length ? ` · missing: ${scene.missing.join(", ")}` : ""
              } · mem-aware progressive entity load`
            : "Compilation / dataset status idle"}
        </div>
      </footer>
    </div>
  );
}
