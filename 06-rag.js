import { config } from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

config();

// 1️⃣ LLM model (AI brain)
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GEMINI_API_KEY,
});

// 2️⃣ Embedding model
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
    apiKey: process.env.GEMINI_API_KEY,
});

// 3️⃣ Vector memory
const vectorStore = new MemoryVectorStore(embeddings);

async function main() {
  // 4️⃣ Seed memory (Your long-term memory)
  await vectorStore.addDocuments([
    { pageContent: "Paresh is building an Agentic AI Backend OS using LangChain, Puppeteer, and Pinecone." },
    { pageContent: "Paresh is aiming for a 15 LPA package by mastering MERN, AI, agents, and RAG." },
    { pageContent: "LangChain Runnables and Tools help create Perplexity-style AI systems." },
  ]);

  // 5️⃣ User question
  const question = "Who is trying to reach 15 LPA and what is he building? why ?";

  // 6️⃣ Retrieve similar documents
  const similarDocs = await vectorStore.similaritySearch(question, 3);

  // 7️⃣ Combine docs into context
  const context = similarDocs.map(d => d.pageContent).join("\n");

  // 8️⃣ Prompt for RAG
  const prompt = PromptTemplate.fromTemplate(`
Use the context to answer.

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:
`);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  // 9️⃣ Final answer
  const answer = await chain.invoke({ context, question });

  console.log("📌 AI ANSWER:\n");
  console.log(answer);
}

main().catch(console.error);
