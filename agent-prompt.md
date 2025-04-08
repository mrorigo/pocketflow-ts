---
layout: default
title: "Agentic Coding (TypeScript)"
---

# Agentic Coding: Humans Design, Agents Code! (TypeScript Edition)

> If you are an AI agent involved in building LLM Systems with the TypeScript PocketFlow framework, read this guide **VERY, VERY** carefully! This is the most important chapter in the entire document. Throughout development, you should always (1) start with a small and simple solution, (2) design at a high level (`docs/design.md`) before implementation, and (3) frequently ask humans for feedback and clarification.
{: .warning }

## Agentic Coding Steps

Agentic Coding should be a collaboration between Human System Design and Agent Implementation:

| Steps                  | Human      | AI        | Comment                                                                 |
|:-----------------------|:----------:|:---------:|:------------------------------------------------------------------------|
| 1. Requirements        | ★★★ High  | ★☆☆ Low   | Humans understand the requirements and context.                         |
| 2. Flow Design         | ★★☆ Medium | ★★☆ Medium | Humans specify the high-level design, and the AI fills in the details.  |
| 3. Utilities           | ★★☆ Medium | ★★☆ Medium | Humans provide external APIs, AI helps implement TS utilities.         |
| 4. Node Design         | ★☆☆ Low   | ★★★ High  | AI helps design node types & data handling using `SharedState`/`Params`. |
| 5. Implementation      | ★☆☆ Low   | ★★★ High  | AI implements the flow in TypeScript based on the design.               |
| 6. Optimization        | ★★☆ Medium | ★★☆ Medium | Humans evaluate results, AI helps optimize prompts/logic.             |
| 7. Reliability         | ★☆☆ Low   | ★★★ High  | AI writes test cases and addresses corner cases using retries/fallbacks. |

1.  **Requirements**: Clarify the requirements for your project, and evaluate whether an AI system is a good fit.
    *   Understand AI systems' strengths and limitations:
        *   **Good for**: Routine tasks requiring common sense (filling forms, replying to emails)
        *   **Good for**: Creative tasks with well-defined inputs (building slides, writing SQL)
        *   **Not good for**: Ambiguous problems requiring complex decision-making (business strategy, startup planning)
    *   **Keep It User-Centric:** Explain the "problem" from the user's perspective rather than just listing features.
    *   **Balance complexity vs. impact**: Aim to deliver the highest value features with minimal complexity early.

2.  **Flow Design**: Outline at a high level, describe how your AI system orchestrates nodes.
    *   Identify applicable design patterns (e.g., Map Reduce, Agent, RAG).
        *   For each node in the flow, start with a high-level one-line description of what it does.
        *   If using **Map Reduce**, specify how to map (what to split, often using `BatchNode` or `ParallelBatchNode`) and how to reduce (how to combine).
        *   If using **Agent**, specify inputs (context) and possible actions (returned from `post` to drive flow transitions).
        *   If using **RAG**, specify what to embed (offline indexing) and how retrieval works (online query flow).
    *   Outline the flow and draw it in a mermaid diagram. For example:
        ```mermaid
        flowchart LR
            start[Start] --> batch[Batch Process]
            batch --> check[Check Results]
            check -- OK --> process[Process Further]
            check -- Error --> fix[Attempt Fix]
            fix --> check

            subgraph process
              direction LR
              step1[Step 1] --> step2[Step 2]
            end

            process --> endNode[End]
        ```
    *   **Connect Nodes in TypeScript:** Use the `.connectTo()` method for the default transition or `.connectAction("actionName", targetNode)` for named transitions.
        ```typescript
        // Example connection
        const nodeA = new MyNodeA();
        const nodeB = new MyNodeB();
        const nodeC = new MyNodeC();

        nodeA.connectTo(nodeB); // Default transition if nodeA.post() returns null/undefined/'default'
        nodeA.connectAction("needs_retry", nodeA); // Loop back on specific action
        nodeB.connectAction("special_case", nodeC); // Named action transition
        ```
    *   > **If Humans can't specify the flow, AI Agents can't automate it!** Before building an LLM system, thoroughly understand the problem and potential solution by manually solving example inputs to develop intuition.
        {: .best-practice }

3.  **Utilities**: Based on the Flow Design, identify and implement necessary utility functions in TypeScript.
    *   Think of your AI system as the brain. It needs a body—these *external utility functions*—to interact with the real world:
        <div align="center"><img src="https://github.com/the-pocket/.github/raw/main/assets/utility.png?raw=true" width="400"/></div>

        *   Reading inputs (e.g., retrieving Slack messages, reading emails)
        *   Writing outputs (e.g., generating reports, sending emails)
        *   Using external tools (e.g., calling LLMs, searching the web)
        *   **NOTE**: *LLM-based tasks* (e.g., summarizing text) are **NOT** utility functions; rather, they are *core functions* implemented within Nodes.
    *   For each utility function, implement it in TypeScript (typically as an `async` function) and write a simple test.
    *   Document their input/output types and necessity. For example:
        *   `name`: `callLlm` (`utils/callLlm.ts`)
        *   `input`: `prompt: string`
        *   `output`: `Promise<string>` (the LLM response)
        *   `necessity`: Used by the `AnswerNode` to generate answers.
    *   Example utility implementation:
        ```typescript
        // utils/callLlm.ts
        import OpenAI from 'openai'; // Assuming 'openai' package is installed

        // Store API keys securely (e.g., environment variables)
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        export async function callLlm(prompt: string): Promise<string> {
            try {
                const response = await client.chat.completions.create({
                    model: "gpt-4o", // Or your preferred model
                    messages: [{ role: "user", content: prompt }],
                });
                return response.choices[0]?.message?.content ?? "";
            } catch (error) {
                console.error("Error calling LLM:", error);
                throw error; // Re-throw error to be handled by Node retry/fallback
            }
        }

        // Simple test execution
        async function testCallLlm() {
          if (require.main === module) { // Only run if executed directly
            const prompt = "What is the meaning of life?";
            console.log(`Testing callLlm with prompt: "${prompt}"`);
            try {
                const answer = await callLlm(prompt);
                console.log("LLM Response:", answer);
            } catch (e) {
                console.error("Test failed:", e);
            }
          }
        }

        testCallLlm();
        ```
    *   > **Sometimes, design Utilities before Flow:** For example, for an LLM project interacting with a legacy system, the available interface is key. Design and test the hardest utilities first, then build the flow around them.
        {: .best-practice }

4.  **Node Design**: Plan how each node will read/write data (`SharedState`) and use parameters (`Params`).
    *   **Shared State Design:** Define the structure for communication. Use the `SharedState` type alias.
        *   For simple systems, use an in-memory object: `const shared: SharedState = {}`.
        *   For complex systems or persistence, use a database interface accessed via utilities.
        *   **Don't Repeat Yourself**: Use references within the shared state where appropriate.
        *   Example `SharedState` design:
            ```typescript
            // Define a more specific type if needed
            interface MySharedState extends SharedState {
              userInput?: string;
              context?: {
                weather?: { temp: number; condition: string };
                location?: string;
              };
              results: Record<string, any>; // Store outputs dynamically
              errorInfo?: any;
            }

            const shared: MySharedState = {
              results: {}
            };
            ```
    *   **Parameters (`Params`)**: Nodes receive parameters during execution.
        *   **`defaultParams`**: Set default values when defining a node using `.setParams({...})`.
        *   **`runtimeParams`**: Passed during `flow.run(shared, runtimeParams)` or merged by `BatchFlow`/`ParallelBatchFlow`. These override defaults.
        *   `prep`, `exec`, `post`, `execFallback` methods receive the final merged `runtimeParams`. Use strongly-typed `Params` interfaces for clarity.
    *   For each Node, describe its type, lifecycle methods, and parameter usage:
        *   `type`: `Node`, `BatchNode`, or `ParallelBatchNode`. (Framework is async-native).
        *   `prep(shared, runtimeParams)`: Reads from `shared`, uses `runtimeParams`. Returns `Promise<PrepR>`.
        *   `exec(prepResult, runtimeParams, attemptIndex)`: Core logic, uses parameters, knows retry attempt. Returns `Promise<ExecR>`.
        *   `post(shared, prepResult, execResult, runtimeParams)`: Writes to `shared`, determines next step. Returns `Promise<ActionResult>`.

5.  **Implementation**: Implement the initial nodes and flows in TypeScript.
    *   🎉 If you've reached this step, humans have finished the design. Now *Agentic Coding* begins!
    *   **"Keep it simple, stupid!"** Avoid complex features initially. Leverage TypeScript's type safety.
    *   **FAIL FAST**! Avoid excessive `try...catch` within `exec` initially; let the framework's retry/fallback handle errors to quickly identify issues.
    *   Add logging (`console.log`, `console.warn`, `console.error`) throughout the code.

6.  **Optimization**:
    *   **Use Intuition**: Human evaluation is a good starting point.
    *   **Redesign Flow (Back to Step 2)**: Consider breaking down tasks, adding agentic decisions, or improving context management.
    *   If flow design is solid, focus on micro-optimizations:
        *   **Prompt Engineering**: Clear, specific instructions with examples. Use structured output formats (like YAML or JSON described in prompts).
        *   **In-Context Learning**: Provide few-shot examples for complex tasks.

    *   > **You'll likely iterate a lot!** Expect to repeat Steps 2–6 many times.
        >
        > <div align="center"><img src="https://github.com/the-pocket/.github/raw/main/assets/success.png?raw=true" width="400"/></div>
        {: .best-practice }

7.  **Reliability**
    *   **Node Retries**: Use the `Node` constructor `(maxRetries, waitSeconds)` to handle transient errors (e.g., API rate limits).
    *   **Fallbacks**: Implement `execFallback` (or `execItemFallback` for batch nodes) to handle non-recoverable errors gracefully (e.g., return default value, log error, trigger specific `ActionResult`). Remember it receives `runtimeParams` and `attemptIndex`.
    *   **Logging and Visualization**: Maintain comprehensive logs. Consider adding tracing or visualization utilities.
    *   **Self-Evaluation**: Add nodes that use LLMs to review intermediate or final outputs for quality or correctness.

## Example LLM Project File Structure (TypeScript)

    ```filetree
    my_project/
    ├── src/
    │ ├── main.ts # Entry point
    │ ├── nodes.ts # Node class definitions
    │ ├── flow.ts # Flow creation logic
    │ ├── sharedState.ts # (Optional) Define shared state interface
    │ └── utils/
    │ ├── index.ts # Barrel file for utilities
    │ └── callLlm.ts # Example utility
    ├── docs/
    │ └── design.md # High-level design document
    ├── package.json # Project dependencies and scripts
    ├── tsconfig.json # TypeScript configuration
    └── bun.lockb # Or package-lock.json / yarn.lock
    ```


*   **`docs/design.md`**: Contains project documentation for each step above. High-level, no code.
*   **`src/utils/`**: Contains all utility functions (TypeScript files). Recommended to have an `index.ts` to export utilities. Each file should be testable independently.
*   **`src/nodes.ts`**: Contains all `Node`, `BatchNode`, `ParallelBatchNode` class definitions.
    ```typescript
    // src/nodes.ts
    import { Node, SharedState, Params, ActionResult } from 'pocketflow'; // Assuming pocketflow is installed/imported
    import { callLlm } from './utils'; // Import utility

    // Define specific Params interface if needed
    interface AnswerParams extends Params {
      model?: string; // Example parameter
    }

    // Define specific SharedState interface if needed
    interface QASharedState extends SharedState {
      question?: string;
      answer?: string;
    }

    export class GetQuestionNode extends Node<QASharedState> {
        // This node doesn't use prep or specific params for this simple example
        async exec(prepResult: void, runtimeParams: Params, attemptIndex?: number): Promise<string> {
            // In real app, get from API, DB, or UI framework
            const userQuestion = "What is TypeScript PocketFlow?"; // Hardcoded for example
            console.log(`Node: GetQuestion - Input: "${userQuestion}"`);
            return userQuestion;
        }

        async post(shared: QASharedState, prepResult: void, execResult: string, runtimeParams: Params): Promise<ActionResult> {
            shared.question = execResult; // Store question in shared state
            return DEFAULT_ACTION; // Proceed to next node
        }
    }

    export class AnswerNode extends Node<QASharedState, AnswerParams, string, string> {
        // Prep reads the question from shared state
        async prep(shared: QASharedState, runtimeParams: AnswerParams): Promise<string> {
            const question = shared.question ?? "No question provided";
            console.log(`Node: Answer - Prep received question: "${question}"`);
            return question;
        }

        // Exec calls the LLM utility
        async exec(question: string, runtimeParams: AnswerParams, attemptIndex?: number): Promise<string> {
            console.log(`Node: Answer - Executing LLM call (Attempt ${attemptIndex! + 1}) for: "${question}" using model ${runtimeParams.model || 'default'}`);
            const answer = await callLlm(`Q: ${question}`); // Assuming callLlm handles errors
            return answer;
        }

        // Post stores the answer
        async post(shared: QASharedState, prepResult: string, execResult: string, runtimeParams: AnswerParams): Promise<ActionResult> {
            console.log(`Node: Answer - Post received answer: "${execResult.substring(0, 50)}..."`);
            shared.answer = execResult;
            // No explicit action needed, flow ends or goes to next default connection
            return DEFAULT_ACTION;
        }

        // Example fallback
        async execFallback(prepResult: string, error: Error, runtimeParams: AnswerParams, attemptIndex: number): Promise<string> {
            console.error(`Node: Answer - Fallback triggered on attempt ${attemptIndex + 1}:`, error.message);
            return "Sorry, I could not generate an answer.";
        }
    }
    ```
*   **`src/flow.ts`**: Implements functions that create flows by importing node definitions and connecting them.
    ```typescript
    // src/flow.ts
    import { Flow } from 'pocketflow';
    import { GetQuestionNode, AnswerNode } from './nodes';

    export function createQaFlow(): Flow<SharedState, Params, GetQuestionNode> {
        // Create nodes
        // Pass retries/wait time to Node constructor if needed
        const getQuestion = new GetQuestionNode();
        const answer = new AnswerNode(3, 1); // 3 retries, 1 sec wait

        // Connect nodes in sequence using default action
        getQuestion.connectTo(answer);

        // Create flow starting with the input node
        // Flow can also have default params: new Flow(getQuestion).setParams({ someFlowParam: 'value' })
        return new Flow(getQuestion);
    }
    ```
*   **`src/main.ts`**: Serves as the project's entry point.
    ```typescript
    // src/main.ts
    import { createQaFlow } from './flow';
    import { SharedState } from 'pocketflow'; // Import base type

    // Define a more specific state type if using one consistently
    interface QASharedState extends SharedState {
        question?: string;
        answer?: string;
    }

    async function main() {
        // Initialize shared state object
        const shared: QASharedState = {
            question: undefined,
            answer: undefined
        };

        console.log("Creating and running the QA flow...");
        const qaFlow = createQaFlow();

        try {
            // Run the flow, optionally passing runtime parameters
            await qaFlow.run(shared, { model: 'gpt-4o-mini' }); // Example runtime param

            console.log("\nFlow completed successfully.");
            console.log("--- Final Shared State ---");
            console.log(`Question: ${shared.question}`);
            console.log(`Answer:   ${shared.answer}`);
            console.log("--------------------------");

        } catch (error) {
            console.error("\nFlow execution failed:", error);
            console.log("--- Shared State after failure ---");
            console.log(`Question: ${shared.question}`);
            console.log(`Answer:   ${shared.answer}`);
            console.log("--------------------------------");
        }
    }

    // Standard pattern to run main function when script is executed
    main().catch(err => {
      console.error("Unhandled error in main:", err);
      process.exit(1);
    });

    ```

Remember to install dependencies (`npm install` or `bun install`) and compile/run the TypeScript code (e.g., `bun run src/main.ts` or `npx ts-node src/main.ts`).
