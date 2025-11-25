import {config} from 'dotenv';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from '@langchain/core/prompts';
config()

const model = new ChatGoogleGenerativeAI({
    model:"gemini-2.0-flash",
    apiKey:process.env.GEMINI_API_KEY
})
// Prompt template - custom template banane ke liye
const prompt = PromptTemplate.fromTemplate(`
    explain me {topic} , like ELI5
    `)
    console.log( "prompt without fill",prompt)
    async function run(){
        const filledPrompt = await prompt.format({topic:"ice cream"}) // it changes the topic in the prompt template
        console.log(filledPrompt)

        const res = await model.invoke(filledPrompt)
        console.log(res.content)
    }
    run().catch(console.error)
