import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { verifySession } from "../auth/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[env.COOKIE_NAME];
  const session = token ? verifySession(token) : null;
  if (!session) {
    reply.code(401).send({ error: "Not authenticated" });
    return;
  }
  request.userId = session.userId;
}
