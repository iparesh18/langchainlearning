import { config } from "dotenv";
config();

import readline from "readline";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END } from "@langchain/langgraph";
import { z } from "zod";
import { scrapeReact } from "./scrape.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("ERROR: Set OPENAI_API_KEY in .env");
  process.exit(1);
}
if (!TAVILY_API_KEY) {
  console.warn("WARNING: TAVILY_API_KEY not set — search will be disabled.");
}

// ------------------ Model ------------------
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: OPENAI_API_KEY,
  // you can add streaming or other settings later
});

// ------------------ State schema (Zod) ------------------
const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const State = z.object({
  messages: z.array(MessageSchema),
});

// ------------------ Utilities ------------------
function findLastUserMessage(state) {
  return [...state.messages].reverse().find((m) => m.role === "user");
}

// Tavily search wrapper
async function tavilySearch(query) {
  if (!TAVILY_API_KEY) return "NO_TAVILY_KEY";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        include_answer: true,
      }),
      // timeout handling omitted for brevity
    });
    const json = await res.json();
    return JSON.stringify(json);
  } catch (err) {
    return "SEARCH_ERROR_" + (err.message || String(err));
  }
}

// ------------------ NODE: PLAN (hard router + LLM fallback) ------------------
async function planNode(state) {
  const userMsg = findLastUserMessage(state)?.content || "";

  // HARD router: if any URL exists -> SCRAPE (no LLM decision)
  if (userMsg.match(/https?:\/\/\S+/i)) {
    return {
      messages: [
        ...state.messages,
        { role: "system", content: "PLAN=scrape" },
      ],
    };
  }

  // else use small LLM decision for search vs answer -- but keep directive strict
  const decisionResp = await model.invoke([
    {
      role: "system",
      content: `
You are a STRICT router. Output ONLY one word: "search" or "answer".
If the user explicitly requests recent/up-to-date facts, prices, or "today", "now", "current", etc., output "search".
Otherwise output "answer".
Do NOT explain, do NOT return anything else.
`.trim(),
    },
    ...state.messages,
  ]);

  const d = (decisionResp.content || "").toLowerCase().trim();
  const plan = d.includes("search") ? "search" : "answer";

  return {
    messages: [
      ...state.messages,
      { role: "system", content: `PLAN=${plan}` },
    ],
  };
}

// ------------------ NODE: SCRAPE ------------------
async function scrapeNode(state) {
  const userMsg = findLastUserMessage(state)?.content || "";
  const urlMatch = userMsg.match(/https?:\/\/\S+/i);
  const url = urlMatch ? urlMatch[0] : null;
  if (!url) {
    return {
      messages: [
        ...state.messages,
        { role: "system", content: "SCRAPED=NO_URL_PROVIDED" },
      ],
    };
  }

  // call puppeteer scraper
  const scraped = await scrapeReact(url);
  return {
    messages: [
      ...state.messages,
      { role: "system", content: `SCRAPED=${scraped}` },
    ],
  };
}

// ------------------ NODE: SEARCH ------------------
async function searchNode(state) {
  const userMsg = findLastUserMessage(state)?.content || "";
  const q = userMsg || "";
  const result = await tavilySearch(q);
  return {
    messages: [
      ...state.messages,
      { role: "system", content: `SEARCHED=${result}` },
    ],
  };
}

// ------------------ NODE: ANSWER ------------------
async function answerNode(state) {
  const scrapedEntry = state.messages.find((m) =>
    m.content?.startsWith("SCRAPED=")
  );
  const searchedEntry = state.messages.find((m) =>
    m.content?.startsWith("SEARCHED=")
  );
  const userMsg = findLastUserMessage(state)?.content || "";

  // IMPORTANT: force the LLM not to refuse. Emphasize that the scraping/search has already happened.
  const prompt = `
IMPORTANT INSTRUCTIONS:
- Do NOT say "I cannot browse" or "I cannot scrape".
- The web scraping / search has already been performed by backend tools. Use that data.
- Use only the provided Scraped and Searched content for web facts.
- If Scraped / Searched is NO_URL or SEARCH_ERROR_*, handle gracefully and tell the user.

User: ${userMsg}

Scraped: ${scrapedEntry ? scrapedEntry.content.replace(/^SCRAPED=/, "") : "NONE"}
Searched: ${searchedEntry ? searchedEntry.content.replace(/^SEARCHED=/, "") : "NONE"}

Give a concise final answer for the user. Use the scraped/searched data when available.
`;

  const out = await model.invoke([{ role: "user", content: prompt }]);
  return {
    messages: [
      ...state.messages,
      { role: "assistant", content: out.content },
    ],
  };
}

// ------------------ Graph build ------------------
const graph = new StateGraph(State)
  .addNode("plan", planNode)
  .addNode("scrape", scrapeNode)
  .addNode("search", searchNode)
  .addNode("answer", answerNode);

graph.addEdge(START, "plan");

graph.addConditionalEdges("plan", (state) => {
  const txt = state.messages.at(-1)?.content || "";
  if (txt.includes("PLAN=scrape")) return "scrape";
  if (txt.includes("PLAN=search")) return "search";
  return "answer";
});

graph.addEdge("scrape", "answer");
graph.addEdge("search", "answer");
graph.addEdge("answer", END);

const agent = graph.compile();

// ------------------ REPL / interactive ------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

console.log("\nMultiAgent V3 REPL ready. Type a question (or 'exit'):\n");

async function askAgent(text) {
  const initialState = {
    messages: [
      { role: "user", content: text },
    ],
  };

  try {
    const result = await agent.invoke(initialState);
    const final = result.messages.at(-1)?.content || "No response";
    console.log("\nAI:", final, "\n");
  } catch (err) {
    console.error("Agent error:", err);
  }
}

rl.on("line", async (line) => {
  const t = line.trim();
  if (!t) return;
  if (t.toLowerCase() === "exit") {
    rl.close();
    process.exit(0);
  }
  await askAgent(t);
  process.stdout.write("> ");
});

process.stdout.write("> ");
