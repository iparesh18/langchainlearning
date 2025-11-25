// 13-multi-agent.js
import { config } from "dotenv";
config();

import { ChatOpenAI } from "@langchain/openai";
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
} from "@langchain/langgraph";

// ==========================================
// MODEL
// ==========================================
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// ==========================================
// SCRAPER
// ==========================================
async function scrapeUrl(url) {
  try {
    if (!url) return "NO_URL";

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
    });

    if (!res.ok) return `SCRAPE_FAILED_${res.status}`;

    const html = await res.text();

    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 5000);
  } catch (e) {
    return "SCRAPE_ERROR_" + e.message;
  }
}

// ==========================================
// TAVILY SEARCH
// ==========================================
async function tavilySearch(query) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        include_answer: true,
      }),
    });

    return JSON.stringify(await res.json());
  } catch (e) {
    return "SEARCH_ERROR_" + e.message;
  }
}

// ==========================================
// PLAN NODE
// ==========================================
async function planNode(state) {
  const msgs = state.messages; // FIXED

  const decision = await model.invoke([
    { role: "system", content: "Reply EXACTLY one word: scrape, search, answer." },
    ...msgs,
  ]);

  const ans = decision.content.toLowerCase();

  let plan = "answer";
  if (ans.includes("scrape")) plan = "scrape";
  else if (ans.includes("search")) plan = "search";

  return {
    messages: [...msgs, { role: "system", content: `PLAN=${plan}` }],
  };
}

// ==========================================
// SCRAPE NODE
// ==========================================
async function scrapeNode(state) {
  const msgs = state.messages; // FIXED

  const user = [...msgs].reverse().find((m) => m.role === "user");
  const urlMatch = user?.content?.match(/https?:\/\/\S+/);
  const url = urlMatch ? urlMatch[0] : null;

  const scraped = await scrapeUrl(url);

  return {
    messages: [...msgs, { role: "system", content: `SCRAPED=${scraped}` }],
  };
}

// ==========================================
// SEARCH NODE
// ==========================================
async function searchNode(state) {
  const msgs = state.messages; // FIXED

  const user = [...msgs].reverse().find((m) => m.role === "user");
  const query = user?.content || "";

  const result = await tavilySearch(query);

  return {
    messages: [...msgs, { role: "system", content: `SEARCHED=${result}` }],
  };
}

// ==========================================
// ANSWER NODE
// ==========================================
async function answerNode(state) {
  const msgs = state.messages; // FIXED

  const scrapedMsg = msgs.find((m) => m.content?.startsWith("SCRAPED="));
  const searchedMsg = msgs.find((m) => m.content?.startsWith("SEARCHED="));
  const userMsg = [...msgs].reverse().find((m) => m.role === "user");

  const prompt = `
User: ${userMsg?.content}

Scraped: ${scrapedMsg?.content || "NONE"}
Searched: ${searchedMsg?.content || "NONE"}

Give final best answer.
  `;

  const final = await model.invoke([{ role: "user", content: prompt }]);

  return {
    messages: [...msgs, { role: "assistant", content: final.content }],
  };
}

// ==========================================
// GRAPH BUILD
// ==========================================
const graph = new StateGraph(MessagesAnnotation)
  .addNode("plan", planNode)
  .addNode("scrape", scrapeNode)
  .addNode("search", searchNode)
  .addNode("answer", answerNode);

graph.addEdge(START, "plan");

graph.addConditionalEdges("plan", (state) => {
  const last = state.messages.at(-1)?.content || "";

  if (last.includes("PLAN=scrape")) return "scrape";
  if (last.includes("PLAN=search")) return "search";
  return "answer";
});

graph.addEdge("scrape", "answer");
graph.addEdge("search", "answer");
graph.addEdge("answer", END);

const agent = graph.compile();

// ==========================================
// TEST RUN — FIXED
// ==========================================
async function main() {
  console.log("\n=== SCRAPE TEST ===");
  const r1 = await agent.invoke({
    messages: [
      { role: "user", content: "Scrape https://webreal.in and summarize it" },
    ],
  });
  console.log("\nAI:", r1.messages.at(-1).content);

  console.log("\n=== SEARCH TEST ===");
  const r2 = await agent.invoke({
    messages: [{ role: "user", content: "Who is the CEO of OpenAI?" }],
  });
  console.log("\nAI:", r2.messages.at(-1).content);
}

main().catch(console.error);
