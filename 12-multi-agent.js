import { config } from "dotenv";
config();

import { ChatOpenAI } from "@langchain/openai";
import {
  MessagesAnnotation,
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";

// MODEL
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// -----------------------
// FAKE SEARCH TOOL (simple demo)
// -----------------------
async function fakeSearch(query) {
  return `Search results for: ${query}
1) Google 2023 revenue was $307B.
2) Alphabet grew 9%.
(FAKE DEMO DATA)
`;
}

// -----------------------
// SCRAPER TOOL (same as before)
// -----------------------
async function scrapeWebsite(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    return html.replace(/<[^>]+>/g, " ").trim().slice(0, 1500);
  } catch {
    return "Error scraping";
  }
}

// -----------------------
// NODE 1: PLANNER NODE
// -----------------------
async function plannerNode(state) {
  const decision = await model.invoke([
    {
      role: "system",
      content:
        "You are a tool-decider. Output ONLY one of these words: scrape, search, math, summarize.",
    },
    ...state.messages,
  ]);

  const mode = decision.content.trim().toLowerCase();

  return {
    messages: [
      ...state.messages,
      { role: "system", content: `PLAN=${mode}` },
    ],
  };
}

// -----------------------
// NODE 2: SCRAPE
// -----------------------
async function scrapeNode(state) {
  const last = state.messages.at(-1).content;
  const url = last.match(/https?:\/\/\S+/)?.[0];

  const text = await scrapeWebsite(url);

  return {
    messages: [
      ...state.messages,
      { role: "system", content: `SCRAPED=${text}` },
    ],
  };
}

// -----------------------
// NODE 3: SEARCH
// -----------------------
async function searchNode(state) {
  const lastUser = state.messages.find((m) => m.role === "user")?.content;
  const result = await fakeSearch(lastUser);

  return {
    messages: [
      ...state.messages,
      { role: "system", content: `SEARCHED=${result}` },
    ],
  };
}

// -----------------------
// NODE 4: SUMMARIZE
// -----------------------
async function summarizeNode(state) {
  const data = state.messages.find((m) =>
    m.content.startsWith("SCRAPED=") || m.content.startsWith("SEARCHED=")
  )?.content.replace("SCRAPED=", "").replace("SEARCHED=", "");

  const summary = await model.invoke([
    { role: "user", content: `Summarize:\n${data}` },
  ]);

  return {
    messages: [...state.messages, { role: "assistant", content: summary.content }],
  };
}

// -----------------------
// BUILD GRAPH
// -----------------------
const graph = new StateGraph(MessagesAnnotation)
  .addNode("plan", plannerNode)
  .addNode("scrape", scrapeNode)
  .addNode("search", searchNode)
  .addNode("summarize", summarizeNode);

// FLOW
graph.addEdge(START, "plan");

graph.addConditionalEdges("plan", (state) => {
  const last = state.messages.at(-1).content;
  if (last.includes("scrape")) return "scrape";
  if (last.includes("search")) return "search";
  if (last.includes("summarize")) return "summarize";
  return END;
});

graph.addEdge("scrape", "summarize");
graph.addEdge("search", "summarize");
graph.addEdge("summarize", END);

const agent = graph.compile();

// RUN
async function main() {
  const result = await agent.invoke({
    messages: [
      { role: "user", content: "Find Google 2023 revenue" },
    ],
  });

  console.log("\n🔥 FINAL OUTPUT:\n");
  console.log(result.messages.at(-1).content);
}

main();
