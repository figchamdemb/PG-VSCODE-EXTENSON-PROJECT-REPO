/**
 * healthRoutes.ts – /health (liveness) + /health/ready (readiness) endpoints.
 *
 * Liveness: always returns 200 if process is alive.
 * Readiness: checks store/database connectivity before returning 200.
 */
import { FastifyInstance, FastifyReply } from "fastify";

export interface HealthDeps {
  storeBackend: string;
  nodeEnv: string;
  startedAt: Date;
  checkStoreReady: () => Promise<boolean>;
}

interface LivenessResponse {
  ok: true;
  uptime_seconds: number;
  node_env: string;
}

interface ReadinessResponse {
  ok: boolean;
  store_backend: string;
  store_connected: boolean;
  uptime_seconds: number;
  node_env: string;
}

export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.get("/health", async (): Promise<LivenessResponse> => ({
    ok: true, uptime_seconds: uptimeSeconds(deps.startedAt), node_env: deps.nodeEnv
  }));
  app.get("/health/ready", async (_request, reply) => handleReadiness(deps, reply));
}

async function handleReadiness(deps: HealthDeps, reply: FastifyReply): Promise<ReadinessResponse> {
  let storeConnected = false;
  try { storeConnected = await deps.checkStoreReady(); } catch { storeConnected = false; }
  const body: ReadinessResponse = {
    ok: storeConnected, store_backend: deps.storeBackend, store_connected: storeConnected,
    uptime_seconds: uptimeSeconds(deps.startedAt), node_env: deps.nodeEnv
  };
  if (!storeConnected) reply.status(503);
  return body;
}

function uptimeSeconds(startedAt: Date): number {
  return Math.round((Date.now() - startedAt.getTime()) / 1000);
}
