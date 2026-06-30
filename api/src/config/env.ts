import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  COOKIE_NAME: z.string().default("agentnano_session"),
  MASTER_ENCRYPTION_KEY: z
    .string()
    .length(64, "MASTER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),
  ATTACHMENTS_ROOT: z.string().default("./storage/attachments"),
  SANDBOXES_ROOT: z.string().default("./storage/sandboxes"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
