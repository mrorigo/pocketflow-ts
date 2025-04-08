# pocketflow-ts

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

**pocketflow-ts** is a minimalist, async-native framework for building agentic applications and workflows in TypeScript. Inspired by the original [PocketFlow](https://github.com/The-Pocket/PocketFlow) framework written in Python, this TypeScript port leverages modern asynchronous features and strong typing to provide an efficient platform for developing lightweight LLM frameworks and agent-based systems—all while keeping the codebase extremely lean.

*All code was written by Gemini Flash 2.5 Pro Preview 03-25.*

Repository: [https://github.com/mrorigo/pocketflow-ts](https://github.com/mrorigo/pocketflow-ts)

---

## Features

- **Minimalist & Lightweight:** Only a few hundred lines of TypeScript code with zero external dependencies.
- **Async-Native:** Built from the ground up with async/await for seamless asynchronous operations.
- **Agentic Workflows:** Design agent-based workflows with nodes, flows, and batch processing support.
- **Retry Mechanism:** Robust retry and fallback strategies for both single-node and batch operations.
- **Type Safety:** Leverage TypeScript's static typing for improved reliability and maintainability.
- **Inspired Simplicity:** Porting the power of the original 100-line Python framework to a modern TypeScript environment.

---

## Installation

You can install pocketflow-ts via npm:

```bash
npm install pocketflow-ts
```

Or using yarn:

```bash
yarn add pocketflow-ts
```

Since pocketflow-ts is minimalist, you can also directly inspect the source code in [`src/index.ts`](src/index.ts) for integration into your custom TypeScript projects.

---

## Usage

Below is a simple example of how to define and run a node using pocketflow-ts:

```ts
import { Node, SharedState, Params, DEFAULT_ACTION } from 'pocketflow-ts';

class MyNode extends Node<SharedState, Params, void, string, string> {
  async prep(shared: SharedState, runtimeParams: Params): Promise<void> {
    console.log('Preparing Node...');
  }

  async exec(prepResult: void, runtimeParams: Params, attemptIndex?: number): Promise<string> {
    console.log('Executing Node...');
    return 'default';
  }
}

(async () => {
  const sharedState: SharedState = {};
  const myNode = new MyNode();
  // Run the node with optional runtime parameters
  const action = await myNode.run(sharedState, { key: 'value' });
  console.log('Action Result:', action);
})();
```

For more advanced use cases, please refer to the inline comments within the source code and `src/example1.ts` as well as the original PocketFlow documentation.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Happy coding with pocketflow-ts!
