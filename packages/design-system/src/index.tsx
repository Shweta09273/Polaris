import type { CSSProperties, ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "critical" | "info" | "neutral";

const toneColor: Record<StatusTone, string> = {
  ok: "var(--polaris-ok)",
  warn: "var(--polaris-warn)",
  critical: "var(--polaris-critical)",
  info: "var(--polaris-info)",
  neutral: "var(--polaris-text-secondary)",
};

export function StatusPill(props: { label: string; tone?: StatusTone }) {
  const tone = props.tone ?? "neutral";
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid var(--polaris-border-strong)",
    color: toneColor[tone],
    fontFamily: "var(--polaris-font-sans)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    background: "var(--polaris-bg-2)",
  };
  return (
    <span style={style}>
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: toneColor[tone],
        }}
      />
      {props.label}
    </span>
  );
}

export function ProvenanceBadge(props: {
  source: string;
  license: string;
  version?: string;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "var(--polaris-radius-sm)",
    border: "1px solid var(--polaris-border-subtle)",
    background: "var(--polaris-bg-3)",
    color: "var(--polaris-text-secondary)",
    fontFamily: "var(--polaris-font-mono)",
    fontSize: 11,
  };
  return (
    <span style={style} title="Dataset provenance">
      <span>{props.source}</span>
      <span aria-hidden>·</span>
      <span>{props.license}</span>
      {props.version ? (
        <>
          <span aria-hidden>·</span>
          <span>{props.version}</span>
        </>
      ) : null}
    </span>
  );
}

export function EmptyTruthState(props: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        placeItems: "start",
        padding: 24,
        border: "1px dashed var(--polaris-border-strong)",
        borderRadius: "var(--polaris-radius-md)",
        background: "var(--polaris-bg-2)",
        color: "var(--polaris-text-primary)",
        fontFamily: "var(--polaris-font-sans)",
        maxWidth: 480,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{props.title}</div>
      <div style={{ fontSize: 13, color: "var(--polaris-text-secondary)", lineHeight: 1.5 }}>
        {props.detail}
      </div>
      {props.action}
    </div>
  );
}

export function Panel(props: { title: string; children: ReactNode; glass?: boolean }) {
  const style: CSSProperties = {
    background: props.glass ? "var(--polaris-glass-bg)" : "var(--polaris-bg-2)",
    backdropFilter: props.glass ? "blur(var(--polaris-glass-blur))" : undefined,
    border: "1px solid var(--polaris-border-subtle)",
    borderRadius: "var(--polaris-radius-md)",
    color: "var(--polaris-text-primary)",
    fontFamily: "var(--polaris-font-sans)",
    overflow: "hidden",
  };
  return (
    <section style={style}>
      <header
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--polaris-border-subtle)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--polaris-text-secondary)",
        }}
      >
        {props.title}
      </header>
      <div style={{ padding: 14 }}>{props.children}</div>
    </section>
  );
}
