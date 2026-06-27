import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PROVIDER_TYPES } from "../db/models/AgentConfig.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  getAgentConfig,
  saveAgentConfig,
  testAgentConnection,
  listProviderModels,
} from "../services/agentConfigService.js";

const saveSchema = z.object({
  providerType: z.enum(PROVIDER_TYPES),
  baseUrl: z.string().min(1),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
});

const listModelsSchema = z.object({
  providerType: z.enum(PROVIDER_TYPES),
  baseUrl: z.string().optional().default(""),
  apiKey: z.string().optional(),
});

export async function agentConfigRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/api/agent-config", async (request, reply) => {
    const agentConfig = await getAgentConfig(request.userId!);
    return reply.send({ agentConfig });
  });

  app.put("/api/agent-config", async (request, reply) => {
    const parsed = saveSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const agentConfig = await saveAgentConfig(request.userId!, parsed.data);
    return reply.send({ agentConfig });
  });

  app.post("/api/agent-config/test", async (request, reply) => {
    const success = await testAgentConnection(request.userId!);
    return reply.send({ success });
  });

  app.post("/api/agent-config/models", async (request, reply) => {
    const parsed = listModelsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const models = await listProviderModels(request.userId!, parsed.data);
    return reply.send({ models });
  });
}
