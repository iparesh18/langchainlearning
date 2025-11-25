import {config} from 'dotenv';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
config()

const model = new ChatGoogleGenerativeAI({
    model:"gemini-2.0-flash",
    apiKey: process.env.GEMINI_API_KEY,
})
const prompt = PromptTemplate.fromTemplate(`
    explain the following concept in simple terms: {topic}`
)

const parser = new StringOutputParser()

async function runChain(input){
      // custom step , here we can write any preprocessing logic like tools or validation
  const normalized = {
    ...input,
    topic: input.topic.trim().toLowerCase(),
  };

  const result = await prompt
    .pipe(model)
    .pipe(parser)
    .invoke(normalized)

    return result
}
async function run(){
    const text = await runChain({topic:"hello world"})
    console.log(text)
}

run().catch(console.error)