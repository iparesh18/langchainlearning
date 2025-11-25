import {config} from 'dotenv';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";


config();

// 1️⃣ Embedding model (convert text → vector numbers)
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
  apiKey:process.env.GEMINI_API_KEY
});

// 2️⃣ Vector store (memory-based, fast, no database needed)
const vectorStore = new MemoryVectorStore(embeddings);

async function main() {
  // 3️⃣ Add some documents
  await vectorStore.addDocuments([
    {
      pageContent: "Paresh is building an agentic AI backend powered by LangChain.",
    },
    {
      pageContent: "He wants to reach 15 LPA by building RAG, agents, and e-commerce AI apps.",
    },
    {
      pageContent: "LangChain helps create agents, chains, tools, and vector memory easily.",
    },
    {
      pageContent: "Paresh is 20 years old.",
    },
  ]);

  console.log("Documents added to vector store.\n");

  // 4️⃣ Query → convert to vector → find similar docs
  const result = await vectorStore.similaritySearch(
    "user age ?",
    2 // top 2 similar docs
  );

  console.log("🔍 SEARCH RESULTS:\n");
  console.log(result);
}

main().catch(console.error);
