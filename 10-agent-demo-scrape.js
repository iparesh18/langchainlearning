import { config } from "dotenv";
config();

import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

// 1) MODEL
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// 2) CREATE AGENT (NO TOOLS YET)
const agent = createAgent({
  model,
  tools: [],
});

// 3) RUN AGENT
async function main() {
  const result = await agent.invoke({
    messages: [
      { role: "user", content: "Hello agent, who are you?" }
    ]
  });

  console.log("\n=== AGENT RESPONSE ===\n");
  console.log(result.messages.at(-1).content);
}

main();
