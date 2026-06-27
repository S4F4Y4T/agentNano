import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.js";
import { agentConfigRoutes } from "./routes/agent-config.js";
import { conversationsRoutes } from "./routes/conversations.js";
import { attachmentsRoutes } from "./routes/attachments.js";
import { HttpError } from "./utils/httpError.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(multipart);
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "Invalid input", details: err.flatten() });
    }
    app.log.error({ err }, "unhandled error");
    return reply.code(500).send({ error: "Internal server error" });
  });

  await app.register(authRoutes);
  await app.register(agentConfigRoutes);
  await app.register(conversationsRoutes);
  await app.register(attachmentsRoutes);

  app.get("/api/health", async () => ({ ok: true }));

  return app;
}
