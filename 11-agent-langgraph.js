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

// SCRAPER
async function scrapeWebsite(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  } catch (err) {
    return `Scrape error: ${err.message}`;
  }
}

// 1️⃣ DECIDE NODE → extracts URL → pushes into messages
async function decideNode(state) {
  const decision = await model.invoke([
    {
      role: "system",
      content:
        "Extract ONLY the URL from the user message. If none exists, return NOURL.",
    },
    ...state.messages,
  ]);

  const text = decision.content.trim();
  const match = text.match(/https?:\/\/\S+/);
  const url = match ? match[0] : null;

  return {
    messages: [
      ...state.messages,
      { role: "system", content: `URL=${url ?? "NONE"}` },
    ],
  };
}

// 2️⃣ SCRAPE NODE → reads URL from messages
async function scrapeNode(state) {
  const lastMessage = state.messages.at(-1)?.content || "";
  const match = lastMessage.match(/https?:\/\/\S+/);
  const url = match ? match[0] : null;

  const scraped = await scrapeWebsite(url);

  return {
    messages: [
      ...state.messages,
      { role: "system", content: `SCRAPED=${scraped.slice(0, 50)}...` },
      { role: "system", content: `SCRAPED_FULL=${scraped}` },
    ],
  };
}

// 3️⃣ SUMMARIZE NODE → summarises SCRAPED_FULL
async function summarizeNode(state) {
  const full = state.messages
    .find((m) => m.content.startsWith("SCRAPED_FULL="))
    ?.content.replace("SCRAPED_FULL=", "") ?? "";

  const summary = await model.invoke([
    {
      role: "user",
      content: `Summarize this into 5 bullet points:\n${full}`,
    },
  ]);

  return {
    messages: [
      ...state.messages,
      { role: "assistant", content: summary.content },
    ],
  };
}

// GRAPH
const graph = new StateGraph(MessagesAnnotation)
  .addNode("decide", decideNode)
  .addNode("scrape", scrapeNode)
  .addNode("summarize", summarizeNode);

// FLOW
graph.addEdge(START, "decide");

graph.addConditionalEdges("decide", (state) => {
  const last = state.messages.at(-1)?.content || "";
  return last.includes("URL=http") ? "scrape" : END;
});

graph.addEdge("scrape", "summarize");
graph.addEdge("summarize", END);

const agent = graph.compile();

// RUN
async function main() {
  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: "Scrape https://webreal.in and summarize it.",
      },
    ],
  });

  console.log("\n🔥 FINAL OUTPUT:\n");
  console.log(result.messages.at(-1).content);
}

main();
