import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const weatherTool = tool(
  async ({ location }) => {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=3`);
      if (!res.ok) throw new Error("Weather service status not OK");
      const text = await res.text();
      return ` ${text.trim()}`;
    } catch {
      return ` Could not retrieve live weather. The mock weather in ${location} is 25°C, mostly sunny with a gentle breeze.`;
    }
  },
  {
    name: "get_weather",
    description: "Get the current weather for a specific location.",
    schema: z.object({
      location: z.string().describe("The city or location to get weather for"),
    }),
  }
);

export const timeTool = tool(
  async () => {
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const date = new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return ` The current local PC time is ${now} on ${date}.`;
  },
  {
    name: "get_time",
    description: "Get the current date and time from the system.",
    schema: z.object({}),
  }
);

export const webSearchTool = tool(
  async ({ query }) => {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search service status not OK");
      const html = await res.text();
      const matches = [...html.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
      const results = matches.slice(0, 3).map((m) => m[1].replace(/<[^>]*>/g, "").trim());
      return ` Search results for "${query}":\n` + (results.length ? results.join("\n\n") : "No results found.");
    } catch (err) {
      return ` Failed to perform web search for "${query}". Error: ${err instanceof Error ? err.message : err}`;
    }
  },
  {
    name: "web_search",
    description: "Search the web for real-time information, definitions, news, or general knowledge.",
    schema: z.object({
      query: z.string().describe("The search query to look up on the web"),
    }),
  }
);

export const jokeTool = tool(
  async () => {
    const jokes = [
      "Why don't scientists trust atoms? Because they make up everything!",
      "Where do schoolrooms keep their signatures? In the log book!",
      "What do you call a factory that makes okay products? A satisfactory.",
      "How does a scientist refresh their breath? With experi-mints!"
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return ` ${joke}`;
  },
  {
    name: "tell_joke",
    description: "Tell a funny joke to the user.",
    schema: z.object({}),
  }
);

export const tools = [weatherTool, timeTool, webSearchTool, jokeTool];
