import { RunnableLambda } from "@langchain/core/runnables";

const addTool = RunnableLambda.from((input) => {
  const { a, b } = input;
  return a + b;
});

async function main() {
  const result = await addTool.invoke({ a: 5, b: 7 });
  console.log("RESULT:", result);
}

main();
