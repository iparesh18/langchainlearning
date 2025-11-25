import { config } from "dotenv";
import { RunnableLambda } from "@langchain/core/runnables"; 
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

config();

// ------------------------------------------------------
// 1️⃣ Scrape Tool (same structure as 08, improved)
// ------------------------------------------------------

const scrapeSchema = z.object({
  url: z.string().url(),
});

const scrapeWebsite = RunnableLambda.from(async (input) => {
  const { url } = scrapeSchema.parse(input);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        success: false,
        error: `Failed to fetch URL. Status: ${res.status}`,
      };
    }

    const html = await res.text();

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      success: true,
      url,
      content: text.slice(0, 3000),
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
});

// ------------------------------------------------------
// 2️⃣ LLM (Gemini)
// ------------------------------------------------------

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GEMINI_API_KEY,
});

// ------------------------------------------------------
// 3️⃣ Summary Prompt
// ------------------------------------------------------

const summarizePrompt = PromptTemplate.fromTemplate(`
You are a helpful AI assistant.

Summarize the following website content in:
- simple English
- 5 bullet points
- highlight what the website does and who it is for

WEBSITE:
{content}

SUMMARY:
`);

// ------------------------------------------------------
// 4️⃣ Chain: prompt → model → parser
// ------------------------------------------------------

const summaryChain = summarizePrompt
  .pipe(model)
  .pipe(new StringOutputParser());

// ------------------------------------------------------
// 5️⃣ Main – Run Tool + LLM
// ------------------------------------------------------

async function main() {
  const url = "https://sheryians.com";

  console.log("🔧 Scraping website...");
  const scraped = await scrapeWebsite.invoke({ url });

  if (!scraped.success) {
    console.log("❌ SCRAPE ERROR:", scraped.error);
    return;
  }

  console.log("🧠 Generating summary...\n");

  const summary = await summaryChain.invoke({
    content: scraped.content,
  });

  console.log("📌 FINAL SUMMARY:\n");
  console.log(summary);
}

main().catch(console.error);
