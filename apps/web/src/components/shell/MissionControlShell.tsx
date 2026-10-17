"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  EmptyTruthState,
  Panel,
  ProvenanceBadge,
  StatusPill,
} from "@polaris/design-system";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type NavId =
  | "search"
  | "installed"
  | "packages"
  | "twin"
  | "progress"
  | "metadata"
  | "versions"
  | "catalog";

const navItems: Array<{ id: NavId; label: string; locked?: boolean; until?: string }> = [
  { id: "search", label: "Search City" },
  { id: "installed", label: "Installed Cities" },
  { id: "packages", label: "Package Manager" },
  { id: "twin", label: "Twin Status" },
  { id: "progress", label: "Build Progress" },
  { id: "metadata", label: "City Metadata" },
  { id: "versions", label: "Version History" },
  { id: "catalog", label: "Catalog" },
];

interface InstalledCity {
  citySlug: string;
  cityDisplayName: string;
  cityVersion: string;
  twinReadinessScore: number;
  cityReadinessScore: number;
  dataConfidence: number;
  installedSizeBytes: number;
  lastUpdated: string;
  coverage: {
    requiredPresent: number;
    requiredTotal: number;
    optionalPresent: number;
    optionalTotal: number;
  };
}

interface CompileJobView {
  jobId: string;
  cityName: string;
  phase: string;
  percent: number;
  message: string;
  error?: string;
  result?: {
    packagePath: string;
    citySlug: string;
    twinReadinessScore: number;
  };
}

interface TwinView {
  citySlug: string;
  cityDisplayName: string;
  twinReadinessScore: number;
  coverage: InstalledCity["coverage"];
  entityCount: number;
  edgeCount: number;
  note: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MissionControlShell() {
  const [nav, setNav] = useState<NavId>("search");
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<InstalledCity[]>([]);
  const [packages, setPackages] = useState<Array<{ name: string; path: string; sizeBytes: number }>>([]);
  const [jobs, setJobs] = useState<CompileJobView[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<InstalledCity | null>(null);
  const [twin, setTwin] = useState<TwinView | null>(null);
  const [versions, setVersions] = useState<Array<{ cityVersion: string; packageId: string; active: boolean }>>([]);
  const [importPath, setImportPath] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshCities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/cities`);
      if (!res.ok) throw new Error("cities fetch failed");
      const data = (await res.json()) as { items: InstalledCity[] };
      setCities(data.items);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }, []);

  const refreshPackages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/packages`);
      if (!res.ok) return;
      const data = (await res.json()) as { items: Array<{ name: string; path: string; sizeBytes: number }> };
      setPackages(data.items);
    } catch {
      /* offline */
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/compile/jobs`);
      if (!res.ok) return;
      const data = (await res.json()) as { items: CompileJobView[] };
      setJobs(data.items);
      if (activeJobId) {
        const job = data.items.find((j) => j.jobId === activeJobId);
        if (job?.phase === "complete") {
          await refreshCities();
          const slug = job.result?.citySlug;
          if (slug) {
            const cityRes = await fetch(`${API_BASE}/v1/cities/${slug}`);
            if (cityRes.ok) {
              const detail = (await cityRes.json()) as { city: InstalledCity };
              setSelected(detail.city);
            }
          }
        }
      }
    } catch {
      /* offline */
    }
  }, [activeJobId, refreshCities]);

  useEffect(() => {
    void refreshCities();
    void refreshPackages();
    void refreshJobs();
  }, [refreshCities, refreshPackages, refreshJobs]);

  useEffect(() => {
    if (!activeJobId) return;
    const t = setInterval(() => void refreshJobs(), 2000);
    return () => clearInterval(t);
  }, [activeJobId, refreshJobs]);

  async function openCity() {
    const cityName = query.trim();
    if (!cityName) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${API_BASE}/v1/cities/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cityName, compileIfMissing: true }),
      });
      const data = (await res.json()) as {
        mode?: string;
        jobId?: string;
        message?: string;
        twin?: TwinView;
        city?: { record: InstalledCity; citySlug: string };
        error?: string;
      };
      if (res.status === 202 && data.jobId) {
        setActiveJobId(data.jobId);
        setNav("progress");
        setStatusMsg(data.message ?? "Compilation started");
        await refreshJobs();
      } else if (data.twin) {
        setTwin(data.twin);
        setSelected(cities.find((c) => c.citySlug === data.twin?.citySlug) ?? null);
        setNav("twin");
        setStatusMsg(`Loaded ${data.twin.cityDisplayName}`);
        await refreshCities();
      } else {
        setStatusMsg(data.message ?? data.error ?? "Open failed");
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "API unreachable");
      setApiOnline(false);
    } finally {
      setBusy(false);
    }
  }

  async function selectCity(city: InstalledCity) {
    setSelected(city);
    setNav("metadata");
    try {
      const [twinRes, detailRes] = await Promise.all([
        fetch(`${API_BASE}/v1/cities/${city.citySlug}/twin`),
        fetch(`${API_BASE}/v1/cities/${city.citySlug}`),
      ]);
      if (twinRes.ok) setTwin((await twinRes.json()) as TwinView);
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as {
          versions: Array<{ cityVersion: string; packageId: string; active: boolean }>;
        };
        setVersions(detail.versions);
      }
    } catch {
      setStatusMsg("Failed to load city detail");
    }
  }

  async function exportCity(city: InstalledCity) {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/cities/${city.citySlug}/export`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { path?: string; message?: string };
      setStatusMsg(data.path ? `Exported → ${data.path}` : data.message ?? "Export failed");
      await refreshPackages();
    } finally {
      setBusy(false);
    }
  }

  async function importPackage() {
    if (!importPath.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/packages/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: importPath.trim() }),
      });
      const data = (await res.json()) as { twin?: TwinView; message?: string; error?: string };
      if (res.ok && data.twin) {
        setTwin(data.twin);
        setNav("twin");
        setStatusMsg(`Imported ${data.twin.cityDisplayName}`);
        await refreshCities();
      } else {
        setStatusMsg(data.message ?? data.error ?? "Import failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const activeJob = jobs.find((j) => j.jobId === activeJobId) ?? jobs[0];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "52px 1fr 140px",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid var(--polaris-border-subtle)",
          background: "var(--polaris-bg-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "var(--polaris-text-primary)",
            }}
          >
            POLARIS
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--polaris-text-tertiary)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Mission Control · Runtime
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusPill label="M3 Runtime" tone="info" />
          <StatusPill
            label={apiOnline === false ? "API offline" : apiOnline ? "API online" : "API…"}
            tone={apiOnline === false ? "critical" : apiOnline ? "ok" : "neutral"}
          />
          <StatusPill
            label={selected ? selected.cityDisplayName : "No city mounted"}
            tone={selected ? "ok" : "warn"}
          />
          <StatusPill label="3D twin deferred" tone="neutral" />
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 340px",
          minHeight: 0,
        }}
      >
        <aside
          style={{
            borderRight: "1px solid var(--polaris-border-subtle)",
            background: "var(--polaris-bg-1)",
            padding: 12,
            display: "grid",
            gap: 16,
            alignContent: "start",
          }}
        >
          <nav style={{ display: "grid", gap: 4 }}>
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.locked && setNav(item.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: nav === item.id ? "var(--polaris-accent-muted)" : "transparent",
                  color: item.locked ? "var(--polaris-text-tertiary)" : "var(--polaris-text-primary)",
                  border:
                    nav === item.id
                      ? "1px solid rgba(61, 225, 255, 0.25)"
                      : "1px solid transparent",
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: item.locked ? 0.55 : 1,
                  cursor: item.locked ? "not-allowed" : "pointer",
                  fontFamily: "var(--polaris-font-sans)",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--polaris-text-tertiary)",
                marginBottom: 8,
              }}
            >
              Twin readiness
            </div>
            {selected ? (
              <div style={{ fontSize: 12, color: "var(--polaris-text-secondary)", display: "grid", gap: 6 }}>
                <Row label="Twin" value={`${selected.twinReadinessScore}/100`} />
                <Row
                  label="Coverage"
                  value={`${selected.coverage.requiredPresent}/${selected.coverage.requiredTotal} req`}
                />
                <Row label="Confidence" value={`${selected.dataConfidence}%`} />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--polaris-text-tertiary)" }}>Select or compile a city</div>
            )}
          </div>
        </aside>

        <main
          style={{
            position: "relative",
            minWidth: 0,
            background:
              "linear-gradient(180deg, rgba(18,24,33,0.2), rgba(7,9,13,0.65)), repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,0.02) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,0.02) 32px), var(--polaris-bg-1)",
            overflow: "auto",
            padding: 24,
          }}
        >
          {nav === "search" && (
            <div style={{ maxWidth: 640, display: "grid", gap: 16 }}>
              <Panel title="Cloud mode — search city">
                <div style={{ display: "grid", gap: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--polaris-text-secondary)", lineHeight: 1.5 }}>
                    Search an installed city or compile via Bootstrap → package → registry. Datasets are never
                    downloaded manually by the operator.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void openCity()}
                      placeholder='e.g. "Hyderabad"'
                      style={inputStyle}
                    />
                    <button type="button" disabled={busy} onClick={() => void openCity()} style={btnStyle}>
                      {busy ? "Working…" : "Open / Compile"}
                    </button>
                  </div>
                  {statusMsg ? (
                    <div style={{ fontSize: 12, color: "var(--polaris-text-secondary)", fontFamily: "var(--polaris-font-mono)" }}>
                      {statusMsg}
                    </div>
                  ) : null}
                </div>
              </Panel>
              <EmptyTruthState
                title="3D Digital Twin viewport deferred"
                detail="Mission Control shows registry, compile progress, and twin metadata only. The 3D engine lands in a later milestone."
                action={<ProvenanceBadge source="runtime" license="PLRS packages" version="0.3.0" />}
              />
            </div>
          )}

          {nav === "installed" && (
            <Panel title="Installed cities">
              {cities.length === 0 ? (
                <EmptyTruthState
                  title="No cities installed"
                  detail="Use Search City to compile, or Package Manager to import a .polaris file."
                />
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {cities.map((c) => (
                    <button
                      key={c.citySlug}
                      type="button"
                      onClick={() => void selectCity(c)}
                      style={{
                        ...cardBtn,
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <strong style={{ color: "var(--polaris-text-primary)" }}>{c.cityDisplayName}</strong>
                        <span style={{ fontFamily: "var(--polaris-font-mono)", fontSize: 11 }}>
                          v{c.cityVersion}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "var(--polaris-text-tertiary)" }}>
                        <span>Twin {c.twinReadinessScore}</span>
                        <span>
                          Cov {c.coverage.requiredPresent}/{c.coverage.requiredTotal}
                        </span>
                        <span>Conf {c.dataConfidence}%</span>
                        <span>{formatBytes(c.installedSizeBytes)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {nav === "packages" && (
            <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
              <Panel title="Package manager — import">
                <div style={{ display: "grid", gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--polaris-text-secondary)" }}>
                    Open an existing <code style={{ fontFamily: "var(--polaris-font-mono)" }}>.polaris</code> package
                    (PLRS envelope). Validate → install → load.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={importPath}
                      onChange={(e) => setImportPath(e.target.value)}
                      placeholder="Absolute path to City.polaris"
                      style={inputStyle}
                    />
                    <button type="button" disabled={busy} onClick={() => void importPackage()} style={btnStyle}>
                      Import
                    </button>
                  </div>
                </div>
              </Panel>
              <Panel title="Local packages (data/packages)">
                {packages.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--polaris-text-tertiary)" }}>No .polaris files on disk yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {packages.map((p) => (
                      <div key={p.path} style={{ fontSize: 12, fontFamily: "var(--polaris-font-mono)", color: "var(--polaris-text-secondary)" }}>
                        {p.name} · {formatBytes(p.sizeBytes)}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
              {selected ? (
                <Panel title="Export selected city">
                  <button type="button" disabled={busy} onClick={() => void exportCity(selected)} style={btnStyle}>
                    Export {selected.citySlug}.polaris
                  </button>
                </Panel>
              ) : null}
            </div>
          )}

          {nav === "twin" && (
            <Panel title="Twin status (metadata shell)">
              {!twin ? (
                <EmptyTruthState
                  title="No twin open"
                  detail="Open or compile a city from Search. 3D rendering is not implemented in M3."
                />
              ) : (
                <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--polaris-text-secondary)" }}>
                  <Row label="City" value={twin.cityDisplayName} />
                  <Row label="Slug" value={twin.citySlug} />
                  <Row label="Twin readiness" value={`${twin.twinReadinessScore}/100`} />
                  <Row
                    label="Coverage"
                    value={`${twin.coverage.requiredPresent}/${twin.coverage.requiredTotal} required · ${twin.coverage.optionalPresent}/${twin.coverage.optionalTotal} optional`}
                  />
                  <Row label="Entities" value={String(twin.entityCount)} />
                  <Row label="Edges" value={String(twin.edgeCount)} />
                  <div style={{ marginTop: 8, lineHeight: 1.5 }}>{twin.note}</div>
                </div>
              )}
            </Panel>
          )}

          {nav === "progress" && (
            <Panel title="Build progress">
              {!activeJob ? (
                <EmptyTruthState title="No compile jobs" detail="Start a compile from Search City." />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <Row label="Job" value={activeJob.jobId} />
                  <Row label="City" value={activeJob.cityName} />
                  <Row label="Phase" value={activeJob.phase} />
                  <div>
                    <div style={{ fontSize: 12, color: "var(--polaris-text-tertiary)", marginBottom: 6 }}>
                      {activeJob.percent}% — {activeJob.message}
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: "var(--polaris-bg-3)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, activeJob.percent)}%`,
                          height: "100%",
                          background: "var(--polaris-info)",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                  {activeJob.error ? (
                    <div style={{ color: "var(--polaris-critical)", fontSize: 12 }}>{activeJob.error}</div>
                  ) : null}
                  <div style={{ fontSize: 11, color: "var(--polaris-text-tertiary)" }}>
                    Pipeline: City → Boundary → Connectors → Normalize → Graph → Validate → Twin → Package → Registry
                  </div>
                </div>
              )}
            </Panel>
          )}

          {nav === "metadata" && (
            <Panel title="City metadata">
              {!selected ? (
                <EmptyTruthState title="No city selected" detail="Pick a city from Installed Cities." />
              ) : (
                <div style={{ display: "grid", gap: 8, fontSize: 13, color: "var(--polaris-text-secondary)" }}>
                  <Row label="Display name" value={selected.cityDisplayName} />
                  <Row label="Slug" value={selected.citySlug} />
                  <Row label="Version" value={selected.cityVersion} />
                  <Row label="Twin readiness" value={`${selected.twinReadinessScore}/100`} />
                  <Row label="City readiness" value={`${selected.cityReadinessScore}/100`} />
                  <Row label="Data confidence" value={`${selected.dataConfidence}%`} />
                  <Row label="Installed size" value={formatBytes(selected.installedSizeBytes)} />
                  <Row label="Last updated" value={selected.lastUpdated} />
                </div>
              )}
            </Panel>
          )}

          {nav === "versions" && (
            <Panel title="Version history">
              {!selected ? (
                <EmptyTruthState title="No city selected" detail="Select an installed city first." />
              ) : versions.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--polaris-text-tertiary)" }}>Only the active version is recorded.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {versions.map((v) => (
                    <div
                      key={v.packageId}
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--polaris-font-mono)",
                        color: "var(--polaris-text-secondary)",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        {v.cityVersion} · {v.packageId.slice(0, 10)}…
                      </span>
                      <span>{v.active ? "ACTIVE" : "previous"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {nav === "catalog" && (
            <EmptyTruthState
              title="Connector catalog"
              detail="Dataset connectors remain under /v1/catalog/connectors. Compilation invokes Bootstrap connectors automatically — operators do not download datasets by hand."
              action={<ProvenanceBadge source="bootstrap" license="per-dataset SPDX" version="m2" />}
            />
          )}
        </main>

        <aside
          style={{
            borderLeft: "1px solid var(--polaris-border-subtle)",
            background: "var(--polaris-bg-1)",
            padding: 12,
            display: "grid",
            gap: 12,
            alignContent: "start",
            overflow: "auto",
          }}
        >
          <Panel title="Coverage" glass>
            {selected ? (
              <div style={{ display: "grid", gap: 8, fontSize: 12, color: "var(--polaris-text-secondary)" }}>
                <Row
                  label="Required"
                  value={`${selected.coverage.requiredPresent}/${selected.coverage.requiredTotal}`}
                />
                <Row
                  label="Optional"
                  value={`${selected.coverage.optionalPresent}/${selected.coverage.optionalTotal}`}
                />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--polaris-text-tertiary)" }}>No city selected</div>
            )}
          </Panel>
          <Panel title="System">
            <div style={{ display: "grid", gap: 8, fontSize: 12, color: "var(--polaris-text-secondary)" }}>
              <Row label="Milestone" value="3 — Runtime" />
              <Row label="Package format" value="PLRS 1.0" />
              <Row label="Simulation" value="disabled" />
              <Row label="3D engine" value="deferred" />
              <Row label="Fake data" value="forbidden" />
            </div>
          </Panel>
        </aside>
      </div>

      <footer
        style={{
          borderTop: "1px solid var(--polaris-border-subtle)",
          background: "var(--polaris-bg-1)",
          padding: "10px 16px",
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--polaris-text-tertiary)",
          }}
        >
          Compile jobs
        </div>
        <div
          style={{
            minHeight: 48,
            borderRadius: 6,
            border: "1px dashed var(--polaris-border-strong)",
            padding: 10,
            color: "var(--polaris-text-tertiary)",
            fontSize: 12,
            fontFamily: "var(--polaris-font-mono)",
            overflow: "auto",
          }}
        >
          {jobs.length === 0
            ? "No compile jobs yet"
            : jobs
                .slice(0, 4)
                .map((j) => `${j.phase} ${j.percent}% · ${j.cityName} · ${j.message}`)
                .join("\n")}
        </div>
      </footer>
    </div>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span>{props.label}</span>
      <span style={{ color: "var(--polaris-text-primary)", fontFamily: "var(--polaris-font-mono)", textAlign: "right" }}>
        {props.value}
      </span>
    </div>
  );
}

const inputStyle: CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 6,
  border: "1px solid var(--polaris-border-strong)",
  background: "var(--polaris-bg-3)",
  color: "var(--polaris-text-primary)",
  fontFamily: "var(--polaris-font-sans)",
  fontSize: 14,
};

const btnStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 6,
  border: "1px solid rgba(61, 225, 255, 0.35)",
  background: "var(--polaris-accent-muted)",
  color: "var(--polaris-text-primary)",
  fontFamily: "var(--polaris-font-sans)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const cardBtn: CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid var(--polaris-border-subtle)",
  background: "var(--polaris-bg-2)",
  cursor: "pointer",
  fontFamily: "var(--polaris-font-sans)",
};
