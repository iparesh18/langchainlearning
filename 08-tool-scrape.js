import { RunnableLambda } from "@langchain/core/runnables";
import { z } from "zod";

// 1️⃣ Validate tool input
const schema = z.object({
  url: z.string().url(),
});

// 2️⃣ Scraper tool using RunnableLambda
export const scrapeWebsite = RunnableLambda.from(async (input) => {
  const { url } = schema.parse(input);

  try {
    const res = await fetch(url);

    if (!res.ok) {
      return {
        success: false,
        error: `Failed to fetch URL. Status: ${res.status}`
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

// 3️⃣ Testing
async function main() {
  const result = await scrapeWebsite.invoke({
    url: "https://webreal.in",
  });

  console.log(result);
}

main();
