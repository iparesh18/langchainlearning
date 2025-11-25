import {config} from "dotenv"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";

config()
const model = new ChatGoogleGenerativeAI({
    model:"gemini-2.0-flash",
    apiKey:process.env.GEMINI_API_KEY
})

const prompt = PromptTemplate.fromTemplate(`
    explain me {topic} , like ELI5`
)

// Create chain: prompt -> model

const chain = prompt.pipe(model)
// chain = (input) => model.invoke( prompt.format(input) )

async function run(){
    const res = await chain.invoke({topic:"ice cream"}) // we did not use .format here , because pipe handles that internally
    console.log("raw response", res)
    console.log("chain content response", res.content)
}
run().catch(console.error)