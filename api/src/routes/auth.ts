import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerUser, loginUser, getUserById } from "../services/authService.js";
import { setSessionCookie, clearSessionCookie } from "../auth/cookie.js";
import { authenticate } from "../middleware/authenticate.js";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  const authRateLimit = {
    config: {
      rateLimit: { max: 10, timeWindow: "1 minute" },
    },
  };

  app.post("/api/auth/register", authRateLimit, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const { user, token } = await registerUser(input);
    setSessionCookie(reply, token);
    return reply.code(201).send({ user });
  });

  app.post("/api/auth/login", authRateLimit, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const { user, token } = await loginUser(input);
    setSessionCookie(reply, token);
    return reply.send({ user });
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const user = await getUserById(request.userId!);
    return reply.send({ user });
  });
}
