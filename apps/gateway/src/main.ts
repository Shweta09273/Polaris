/**
 * Edge BFF / API gateway — Milestone 1 scaffolding.
 * Terminates browser traffic, forwards to core API.
 * Authn middleware (OIDC) lands with Keycloak realm import in M2.
 */

import Fastify from "fastify";
import proxy from "@fastify/http-proxy";

const port = Number(process.env.GATEWAY_PORT ?? 4080);
const apiUpstream = process.env.API_PUBLIC_URL ?? "http://127.0.0.1:4000";

async function bootstrap() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok", service: "polaris-gateway" }));

  await app.register(proxy, {
    upstream: apiUpstream,
    prefix: "/api",
    rewritePrefix: "/",
  });

  await app.listen({ port, host: "0.0.0.0" });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
