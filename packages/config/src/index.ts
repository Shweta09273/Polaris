export interface PolarisRuntimeConfig {
  readonly env: "development" | "staging" | "production";
  readonly apiPort: number;
  readonly webUrl: string;
  readonly apiUrl: string;
  readonly featureSimulation: boolean;
  readonly featureDecisionEngine: boolean;
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): PolarisRuntimeConfig {
  const nodeEnv = env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "staging" ? "staging" : "development";
  return {
    env: nodeEnv,
    apiPort: Number(env.API_PORT ?? 4000),
    webUrl: env.WEB_PUBLIC_URL ?? "http://localhost:3000",
    apiUrl: env.API_PUBLIC_URL ?? "http://localhost:4000",
    featureSimulation: env.FEATURE_SIMULATION === "true",
    featureDecisionEngine: env.FEATURE_DECISION_ENGINE !== "false",
  };
}
