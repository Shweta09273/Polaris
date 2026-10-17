import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  buildDigitalTwinAsync,
  getTwin3dJob,
  listTwin3dJobs,
  listCompiledTwinCities,
  readTwinScene,
  twin3dCityDir,
  DEMO_CITIES,
  resolveDemoCity,
} from "@polaris/twin-geometry";

export function registerTwin3dRoutes(app: FastifyInstance): void {
  app.get("/v1/twin3d/demo-cities", async () => ({
    items: DEMO_CITIES.map((c) => ({
      slug: c.slug,
      displayName: c.displayName,
      query: c.query,
    })),
  }));

  app.get("/v1/twin3d/cities", async () => ({
    items: listCompiledTwinCities(),
  }));

  /**
   * Open city: if scene exists → return immediately; else start compile job.
   */
  app.post("/v1/twin3d/open", async (req, reply) => {
    const body = req.body as { cityName?: string; forceRebuild?: boolean };
    const cityName = body.cityName?.trim();
    if (!cityName) return reply.code(400).send({ error: "cityName_required" });

    const demo = resolveDemoCity(cityName);
    const slugGuess = demo?.slug ?? cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const existing = !body.forceRebuild ? readTwinScene(slugGuess) : undefined;
    if (existing) {
      return {
        mode: "ready" as const,
        citySlug: existing.citySlug,
        scene: existing,
      };
    }

    const jobId = buildDigitalTwinAsync({ cityName: demo?.query ?? cityName });
    return reply.code(202).send({
      mode: "compile" as const,
      jobId,
      message: `Building Digital Twin for "${cityName}". Poll GET /v1/twin3d/jobs/${jobId}`,
    });
  });

  app.get("/v1/twin3d/jobs", async () => ({
    items: listTwin3dJobs().map((j) => ({
      jobId: j.jobId,
      cityName: j.cityName,
      phase: j.phase,
      percent: j.percent,
      message: j.message,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
      error: j.error,
      citySlug: j.result?.citySlug,
    })),
  }));

  app.get("/v1/twin3d/jobs/:jobId", async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const job = getTwin3dJob(jobId);
    if (!job) return reply.code(404).send({ error: "job_not_found" });
    return {
      jobId: job.jobId,
      cityName: job.cityName,
      phase: job.phase,
      percent: job.percent,
      message: job.message,
      events: job.events,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      result: job.result
        ? {
            citySlug: job.result.citySlug,
            scene: job.result.manifest,
          }
        : undefined,
    };
  });

  app.get("/v1/twin3d/cities/:slug/scene", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const scene = readTwinScene(slug);
    if (!scene) return reply.code(404).send({ error: "scene_not_found" });
    return scene;
  });

  app.get("/v1/twin3d/cities/:slug/search", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const q = ((req.query as { q?: string }).q ?? "").trim().toLowerCase();
    const indexPath = join(twin3dCityDir(slug), "search-index.json");
    if (!existsSync(indexPath)) return reply.code(404).send({ error: "index_not_found" });
    const index = JSON.parse(readFileSync(indexPath, "utf8")) as Array<{
      searchText: string;
      name: string;
      kind: string;
      lon: number;
      lat: number;
      id: string;
      provenance?: string;
      license?: string;
    }>;
    const items = !q
      ? index.slice(0, 40)
      : index.filter((i) => i.searchText.includes(q) || i.name.toLowerCase().includes(q) || i.kind.includes(q)).slice(0, 40);
    return { query: q, items };
  });

  app.get("/v1/twin3d/cities/:slug/file", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const rel = ((req.query as { path?: string }).path ?? "").replace(/^\/+/, "");
    if (!rel || rel.includes("..") || rel.includes("\\")) {
      return reply.code(400).send({ error: "bad_path" });
    }
    const root = twin3dCityDir(slug);
    const abs = join(root, rel);
    if (!abs.startsWith(root) || !existsSync(abs)) {
      return reply.code(404).send({ error: "not_found" });
    }
    const st = statSync(abs);
    if (!st.isFile()) return reply.code(404).send({ error: "not_a_file" });
    const lower = rel.toLowerCase();
    if (lower.endsWith(".json") || lower.endsWith(".geojson")) {
      reply.header("content-type", "application/json");
    } else if (lower.endsWith(".png")) {
      reply.header("content-type", "image/png");
    }
    return reply.send(createReadStream(abs));
  });
}
