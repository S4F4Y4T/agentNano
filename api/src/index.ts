import { env } from "./config/env.js";
import { connectDb } from "./db/connection.js";
import { buildServer } from "./server.js";
import { startCommandWorker } from "./services/commandWorker.js";

async function main() {
  await connectDb();
  startCommandWorker();
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
