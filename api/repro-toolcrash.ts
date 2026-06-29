import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import { answerMessage } from "./src/chat/answerMessage.js";

let call = 0;

(ChatOpenAI.prototype as any).bindTools = function () {
  return {
    invoke: async () => {
      call++;
      if (call === 1) {
        const msg = new AIMessage({ content: "" });
        (msg as any).tool_calls = [
          { name: "schedule_command", args: { cron: "0 7 * * *" }, id: "call_1" },
        ];
        return msg;
      }
      return new AIMessage({ content: "ok, noted (this should be reachable)" });
    },
    stream: async function* () {
      yield new AIMessage({ content: "Sorry, I couldn't schedule that reminder." });
    },
  };
};

async function main() {
  try {
    const result = await answerMessage(
      { providerType: "custom", baseUrl: "http://localhost:9999/v1", apiKey: "fake", model: "fake" },
      "You are a test agent.",
      [{ role: "user", content: "everyday 7am wake me" }],
      (token) => process.stdout.write("[token] " + token + "\n")
    );
    console.log("--- answerMessage resolved without throwing ---");
    console.log("final reply:", JSON.stringify(result));
  } catch (err: any) {
    console.log("--- answerMessage THREW (this would trigger 'Couldn't reach the provider') ---");
    console.log(err.constructor.name, err.message);
  }
  process.exit(0);
}

main();
