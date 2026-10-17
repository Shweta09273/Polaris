/**
 * Runtime / Package / Compiler HTTP adapters for Milestone 3.
 */
import type { FastifyInstance } from "fastify";
import { PolarisRuntime, listLocalPackageFiles } from "@polaris/runtime";
import { compileCityAsync, getCompileJob, listCompileJobs } from "@polaris/compiler";
import { resolve } from "node:path";

export function registerRuntimeRoutes(app: FastifyInstance, runtime: PolarisRuntime): void {
  app.get("/v1/runtime/status", async () => runtime.status());

  app.get("/v1/cities", async () => ({
    items: runtime.listInstalled(),
  }));

  app.get("/v1/cities/search", async (req) => {
    const q = (req.query as { q?: string }).q ?? "";
    const installed = runtime.searchInstalled(q);
    return {
      query: q,
      installed,
      note:
        installed.length === 0
          ? "No installed match. POST /v1/cities/compile to invoke City Compiler (Bootstrap → package → registry)."
          : undefined,
    };
  });

  /**
   * Cloud mode: if installed → mount + open twin metadata; else start compile job.
   */
  app.post("/v1/cities/open", async (req, reply) => {
    const body = req.body as { cityName?: string; citySlug?: string; compileIfMissing?: boolean };
    const query = (body.cityName ?? body.citySlug ?? "").trim();
    if (!query) {
      return reply.code(400).send({ error: "cityName_required" });
    }

    const slugGuess = query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let record =
      runtime.getInstalled(slugGuess) ??
      runtime.searchInstalled(query)[0];

    if (record) {
      const city = await runtime.mountInstalled(record.citySlug);
      const twin = runtime.openTwin(record.citySlug);
      return {
        mode: "cloud-installed" as const,
        city,
        twin,
      };
    }

    if (body.compileIfMissing === false) {
      return reply.code(404).send({
        error: "city_not_installed",
        message: `No installed city matching "${query}"`,
      });
    }

    const jobId = compileCityAsync({ cityName: query });
    return reply.code(202).send({
      mode: "compile" as const,
      jobId,
      message: `City not installed. Compilation started for "${query}". Poll GET /v1/compile/jobs/${jobId}`,
    });
  });

  app.get("/v1/cities/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const record = runtime.getInstalled(slug);
    if (!record) return reply.code(404).send({ error: "not_found" });
    return { city: record, versions: runtime.versionHistory(slug) };
  });

  app.post("/v1/cities/:slug/mount", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    try {
      const city = await runtime.mountInstalled(slug);
      return { city, twin: runtime.openTwin(slug) };
    } catch (err) {
      return reply.code(404).send({
        error: "mount_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get("/v1/cities/:slug/twin", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    try {
      if (!runtime.getMounted(slug)) await runtime.mountInstalled(slug);
      return runtime.openTwin(slug);
    } catch (err) {
      return reply.code(404).send({
        error: "twin_unavailable",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get("/v1/cities/:slug/integrity", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    try {
      if (!runtime.getMounted(slug)) await runtime.mountInstalled(slug);
      return runtime.detectCorruption(slug);
    } catch (err) {
      return reply.code(404).send({
        error: "integrity_check_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post("/v1/cities/:slug/rollback", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    try {
      const city = runtime.rollback(slug);
      return { city };
    } catch (err) {
      return reply.code(400).send({
        error: "rollback_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.delete("/v1/cities/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const deleteFiles = (req.query as { deleteFiles?: string }).deleteFiles === "true";
    try {
      runtime.uninstall(slug, { deleteFiles });
      return { ok: true };
    } catch (err) {
      return reply.code(404).send({
        error: "uninstall_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post("/v1/cities/:slug/export", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as { outPath?: string };
    const record = runtime.getInstalled(slug);
    if (!record) return reply.code(404).send({ error: "not_found" });
    const outPath =
      body.outPath ??
      resolve(process.cwd(), `${record.citySlug}.polaris`);
    try {
      const path = await runtime.exportPackage(slug, outPath);
      return { path, citySlug: slug, cityVersion: record.cityVersion };
    } catch (err) {
      return reply.code(400).send({
        error: "export_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post("/v1/packages/import", async (req, reply) => {
    const body = req.body as { path?: string; allowUnsigned?: boolean };
    if (!body.path) return reply.code(400).send({ error: "path_required" });
    const packagePath = resolve(body.path);
    if (!packagePath.endsWith(".polaris")) {
      return reply.code(400).send({ error: "invalid_extension", message: "Path must end with .polaris" });
    }
    try {
      const city = await runtime.importPackage({
        packagePath,
        ...(body.allowUnsigned !== undefined ? { allowUnsigned: body.allowUnsigned } : {}),
      });
      return { city, twin: runtime.openTwin(city.citySlug) };
    } catch (err) {
      return reply.code(400).send({
        error: "import_failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post("/v1/packages/validate", async (req, reply) => {
    const body = req.body as { path?: string };
    if (!body.path) return reply.code(400).send({ error: "path_required" });
    return runtime.validatePackage(resolve(body.path));
  });

  app.get("/v1/packages", async () => ({
    items: listLocalPackageFiles(),
  }));

  app.post("/v1/cities/compile", async (req, reply) => {
    const body = req.body as { cityName?: string; skipConnectors?: string[] };
    if (!body.cityName?.trim()) {
      return reply.code(400).send({ error: "cityName_required" });
    }
    const jobId = compileCityAsync({
      cityName: body.cityName.trim(),
      ...(body.skipConnectors ? { skipConnectors: body.skipConnectors } : {}),
    });
    return reply.code(202).send({ jobId });
  });

  app.get("/v1/compile/jobs", async () => ({
    items: listCompileJobs().map((j) => ({
      jobId: j.jobId,
      cityName: j.cityName,
      phase: j.phase,
      percent: j.percent,
      message: j.message,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
      error: j.error,
      result: j.result
        ? {
            packagePath: j.result.packagePath,
            citySlug: j.result.installed.citySlug,
            twinReadinessScore: j.result.installed.twinReadinessScore,
          }
        : undefined,
    })),
  }));

  app.get("/v1/compile/jobs/:jobId", async (req, reply) => {
    const { jobId } = req.params as { jobId: string };
    const job = getCompileJob(jobId);
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
            packagePath: job.result.packagePath,
            citySlug: job.result.installed.citySlug,
            cityVersion: job.result.installed.cityVersion,
            twinReadinessScore: job.result.installed.twinReadinessScore,
            packageId: job.result.manifest.packageId,
          }
        : undefined,
    };
  });
}
