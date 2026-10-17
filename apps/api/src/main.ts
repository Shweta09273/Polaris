/**
 * POLARIS Core API — Digital Twin + Experiments + Decision Intelligence V1.
 * Fastify entry: health, twin3d, runtime packages, experiments, decisions.
 * Reloads workspace dist on tsx watch.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import type { HealthResponse, DatasetCatalogItemDto } from "@polaris/contracts";
import { SimulationService } from "@polaris/simulation";
import { DecisionEngineService } from "@polaris/decision-engine";
import { EmptyTwinRegistry } from "@polaris/twin-registry";
import { PolarisRuntime } from "@polaris/runtime";
import { readConnectorCatalog } from "./modules/catalog/read-connector-catalog.js";
import { registerRuntimeRoutes } from "./modules/runtime/routes.js";
import { registerTwin3dRoutes } from "./modules/twin3d/routes.js";
import { registerExperimentRoutes } from "./modules/experiments/routes.js";

const version = "1.0.0";
const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

async function bootstrap() {
  const app = Fastify({ logger: true });
  const webOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.WEB_PUBLIC_URL ?? "http://localhost:3000",
  ].filter((origin, index, all) => Boolean(origin) && all.indexOf(origin) === index);

  await app.register(cors, {
    origin: webOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
  });

  const simulation = new SimulationService();
  const decisions = new DecisionEngineService();
  const twin = new EmptyTwinRegistry();
  const runtime = new PolarisRuntime();

  app.get("/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    service: "polaris-api",
    version,
    features: {
      simulation: simulation.isEnabled(),
      decisionEngine: decisions.isEnabled(),
      experiments: true,
    },
    time: new Date().toISOString(),
  }));

  app.get("/metrics", async (_req, reply) => {
    reply.header("content-type", "text/plain; version=0.0.4");
    return [
      "# HELP polaris_api_up 1 if API process is up",
      "# TYPE polaris_api_up gauge",
      "polaris_api_up 1",
      "",
    ].join("\n");
  });

  app.get("/v1/catalog/connectors", async (): Promise<DatasetCatalogItemDto[]> => {
    return readConnectorCatalog();
  });

  app.get("/v1/twin/assets", async (req) => {
    const q = req.query as { aoiId?: string; limit?: string };
    if (!q.aoiId) {
      return { items: [], note: "aoiId is required." };
    }
    const items = await twin.listAssetsByAoi(q.aoiId as never, Number(q.limit ?? 50));
    return { items };
  });

  app.post("/v1/simulation/runs", async (_req, reply) => {
    try {
      await simulation.run();
    } catch (err) {
      return reply.code(501).send({
        error: "not_implemented",
        message: err instanceof Error ? err.message : "Simulation unavailable",
      });
    }
  });

  app.get("/v1/decisions/capabilities", async () => ({
    enabled: decisions.isEnabled(),
    capabilities: decisions.listCapabilities(),
  }));

  registerRuntimeRoutes(app, runtime);
  registerTwin3dRoutes(app);
  registerExperimentRoutes(app);

  await app.listen({ port, host });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
