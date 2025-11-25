import {config} from 'dotenv';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from "@langchain/core/output_parsers";

config()

const model = new ChatGoogleGenerativeAI({
    model:"gemini-2.0-flash",
    apiKey:process.env.GEMINI_API_KEY
})

const prompt = PromptTemplate.fromTemplate(`
    explain me {topic} , like ELI5`
)

const parser = new StringOutputParser()

const chain = prompt.pipe(model).pipe(parser)


async function run(){
    const response = await chain.invoke({topic:"ice cream"})
      console.log("\nFINAL STRING OUTPUT:\n");
  console.log(response); // this is plain string
}

run().catch(console.error)

// Ab text directly ek string hai -> tumhara socket.io / REST response ke liye perfect.

