/**
 * Experiment + Decision Intelligence API routes (V1).
 */
import type { FastifyInstance } from "fastify";
import {
  listScenarios,
  runExperiment,
  type ExperimentKind,
  type ExperimentResult,
} from "@polaris/experiment-engine";
import { buildDecisionBrief, type DecisionBrief } from "@polaris/decision-engine";

const results = new Map<string, ExperimentResult>();
const briefs = new Map<string, DecisionBrief>();

export function registerExperimentRoutes(app: FastifyInstance) {
  app.get("/v1/experiments/catalog", async () => ({
    format: "polaris.experiments.catalog/1",
    items: listScenarios(),
  }));

  app.get("/v1/experiments", async () => ({
    items: [...results.values()].map((r) => ({
      id: r.id,
      experimentId: r.experimentId,
      kind: r.kind,
      citySlug: r.citySlug,
      status: r.status,
      completedAt: r.completedAt,
      entityCount: r.affectedEntities.length,
      metrics: r.metrics,
    })),
  }));

  app.post("/v1/experiments/run", async (req, reply) => {
    const body = req.body as {
      citySlug?: string;
      kind?: ExperimentKind;
      parameters?: Record<string, number | string | boolean>;
      epicenter?: { lon: number; lat: number };
    };

    if (!body.citySlug || !body.kind) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "citySlug and kind are required. Choose a city twin and a catalog scenario.",
      });
    }

    try {
      const result = runExperiment({
        citySlug: body.citySlug,
        kind: body.kind,
        ...(body.parameters ? { parameters: body.parameters } : {}),
        ...(body.epicenter ? { epicenter: body.epicenter } : {}),
      });
      results.set(result.id, result);
      const brief = buildDecisionBrief(result);
      briefs.set(brief.id, brief);
      briefs.set(`result:${result.id}`, brief);

      return {
        format: "polaris.experiments.run/1",
        result,
        decisionBrief: brief,
      };
    } catch (err) {
      return reply.code(400).send({
        error: "experiment_failed",
        message: err instanceof Error ? err.message : "Experiment failed",
      });
    }
  });

  app.get("/v1/experiments/:resultId", async (req, reply) => {
    const { resultId } = req.params as { resultId: string };
    const result = results.get(resultId);
    if (!result) return reply.code(404).send({ error: "not_found" });
    return { result, decisionBrief: briefs.get(`result:${resultId}`) ?? null };
  });

  app.get("/v1/experiments/:resultId/layers/:layerId", async (req, reply) => {
    const { resultId, layerId } = req.params as { resultId: string; layerId: string };
    const result = results.get(resultId);
    if (!result) return reply.code(404).send({ error: "not_found" });
    const layer = result.outputLayers.find((l) => l.id === layerId);
    if (!layer) return reply.code(404).send({ error: "layer_not_found" });
    return layer.geojson;
  });

  app.post("/v1/decisions/briefs", async (req, reply) => {
    const body = req.body as { resultId?: string };
    if (!body.resultId) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "resultId is required. Decisions are produced only from experiment outputs.",
      });
    }
    const result = results.get(body.resultId);
    if (!result) {
      return reply.code(404).send({
        error: "not_found",
        message: "Unknown experiment resultId — run an experiment first.",
      });
    }
    const existing = briefs.get(`result:${body.resultId}`);
    if (existing) return { decisionBrief: existing };
    const brief = buildDecisionBrief(result);
    briefs.set(brief.id, brief);
    briefs.set(`result:${result.id}`, brief);
    return { decisionBrief: brief };
  });
}
