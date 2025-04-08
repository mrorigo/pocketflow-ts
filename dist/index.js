"use strict";
/**
 * PocketFlow TypeScript Port - Async Native Version 4 (Simplified)
 * A minimalist, async-native framework for building agentic applications and workflows.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParallelBatchFlow = exports.BatchFlow = exports.Flow = exports.ParallelBatchNode = exports.BatchNode = exports.Node = exports.BaseNode = exports.sleep = exports.DEFAULT_ACTION = void 0;
exports.DEFAULT_ACTION = "default";
// --- Utility Functions ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;
async function* ensureAsyncIterable(source) {
    // Yields items from either an async or sync iterable source.
    // Necessary for reliable type handling with `for await...of` on generic unions.
    yield* source;
}
// --- Base Node ---
class BaseNode {
    constructor() {
        // Default parameters for the node definition
        this.defaultParams = {};
        this._successors = new Map();
    }
    // Method to set the default parameters when defining the node/flow
    setParams(params) {
        this.defaultParams = params;
        return this; // Allow chaining
    }
    addSuccessor(node, action = exports.DEFAULT_ACTION) {
        if (this._successors.has(action))
            console.warn(`Overwriting successor for action '${action}' in node ${this.constructor.name}`);
        this._successors.set(action, node);
        return node;
    }
    connectTo(targetNode) {
        return this.addSuccessor(targetNode, exports.DEFAULT_ACTION);
    }
    connectAction(action, targetNode) {
        if (!action || typeof action !== "string")
            throw new TypeError("Action must be non-empty string");
        return this.addSuccessor(targetNode, action);
    }
    // Core lifecycle methods now accept runtime parameters explicitly
    async prep(shared, runtimeParams) {
        return undefined;
    }
    // Exec also receives attempt index for retry logic
    async exec(prepResult, runtimeParams, attemptIndex) {
        return undefined;
    }
    async post(shared, prepResult, execResult, runtimeParams) {
        return exports.DEFAULT_ACTION;
    }
    /** Internal exec wrapper; overridden by Node for retries. */
    async _exec(prepResult, runtimeParams) {
        // Base implementation calls exec with attempt 0
        return await this.exec(prepResult, runtimeParams, 0);
    }
    /** Public run cycle for a single node execution. Accepts runtime parameters. */
    async run(shared, runtimeParams) {
        // Combine default params with runtime params (runtime takes precedence)
        const finalParams = {
            ...this.defaultParams,
            ...(runtimeParams || {}),
        };
        const prepResult = await Promise.resolve(this.prep(shared, finalParams));
        // Pass finalParams to _exec, which handles retries and passes them down
        const execResult = await this._exec(prepResult, finalParams);
        const actionResult = await Promise.resolve(this.post(shared, prepResult, execResult, finalParams));
        return (actionResult !== null && actionResult !== void 0 ? actionResult : exports.DEFAULT_ACTION);
    }
    // Keep this separate run method for direct execution without successors check/param merging
    async runDirect(shared, params) {
        return this.run(shared, params);
    }
    getSuccessors() {
        return this._successors;
    }
}
exports.BaseNode = BaseNode;
// --- Node (with Retries) ---
class Node extends BaseNode {
    constructor(maxRetries = 1, waitSeconds = 0) {
        super();
        this.maxRetries = Math.max(1, maxRetries);
        this.waitSeconds = Math.max(0, waitSeconds);
    }
    // Fallback now also receives runtime params and attempt index
    async execFallback(prepResult, error, runtimeParams, attemptIndex) {
        throw error;
    }
    async _exec(prepResult, runtimeParams) {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                // Pass runtimeParams and current attempt index to exec
                return await this.exec(prepResult, runtimeParams, attempt);
            }
            catch (error) {
                console.warn(`Node ${this.constructor.name} exec failed (attempt ${attempt + 1}/${this.maxRetries}):`, error instanceof Error ? error.message : error);
                if (attempt === this.maxRetries - 1) {
                    console.warn(`Node ${this.constructor.name} max retries reached. Using fallback.`);
                    // Pass runtimeParams and final attempt index to fallback
                    return await this.execFallback(prepResult, error, runtimeParams, attempt);
                }
                if (this.waitSeconds > 0)
                    await (0, exports.sleep)(this.waitSeconds * 1000);
            }
        }
        throw new Error(`Node ${this.constructor.name} execution failed unexpectedly after retries.`);
    }
}
exports.Node = Node;
// --- Batch Node (Sequential Execution) ---
class BatchNode extends Node {
    // Override _exec to implement batch logic using new item methods
    async _exec(prepResult, runtimeParams) {
        const results = [];
        try {
            for await (const item of ensureAsyncIterable(prepResult)) {
                let itemResult = undefined;
                let success = false;
                for (let attempt = 0; attempt < this.maxRetries; attempt++) {
                    try {
                        // Pass runtimeParams and attempt index down to item execution
                        itemResult = await this.execItem(item, runtimeParams, attempt);
                        success = true;
                        break;
                    }
                    catch (error) {
                        console.warn(`BatchNode ${this.constructor.name} item exec failed (attempt ${attempt + 1}/${this.maxRetries}):`, error instanceof Error ? error.message : error);
                        if (attempt === this.maxRetries - 1) {
                            console.warn(`BatchNode ${this.constructor.name} item max retries reached. Using item fallback.`);
                            // Pass runtimeParams and attempt index down to item fallback
                            itemResult = await this.execItemFallback(item, error, runtimeParams, attempt);
                            success = true;
                            break;
                        }
                        if (this.waitSeconds > 0)
                            await (0, exports.sleep)(this.waitSeconds * 1000);
                    }
                }
                if (!success)
                    throw new Error(`BatchNode ${this.constructor.name} failed to process an item after retries.`);
                results.push(itemResult);
            }
        }
        catch (e) {
            console.error(`Error iterating prepResult in ${this.constructor.name}:`, e);
            throw e;
        }
        return results;
    }
}
exports.BatchNode = BatchNode;
// --- Parallel Batch Node ---
class ParallelBatchNode extends BatchNode {
    async _exec(prepResult, runtimeParams) {
        const items = [];
        try {
            for await (const item of ensureAsyncIterable(prepResult)) {
                items.push(item);
            }
        }
        catch (e) {
            console.error(`Error collecting items from prepResult in ${this.constructor.name}:`, e);
            throw e;
        }
        if (items.length === 0)
            return [];
        const executeItemWithRetry = async (item) => {
            for (let attempt = 0; attempt < this.maxRetries; attempt++) {
                try {
                    // Pass runtimeParams and attempt index down
                    return await this.execItem(item, runtimeParams, attempt);
                }
                catch (error) {
                    console.warn(`ParallelBatchNode ${this.constructor.name} item exec failed (attempt ${attempt + 1}/${this.maxRetries}):`, error instanceof Error ? error.message : error);
                    if (attempt === this.maxRetries - 1) {
                        console.warn(`ParallelBatchNode ${this.constructor.name} item max retries reached. Using item fallback.`);
                        // Pass runtimeParams and attempt index down
                        return await this.execItemFallback(item, error, runtimeParams, attempt);
                    }
                    if (this.waitSeconds > 0)
                        await (0, exports.sleep)(this.waitSeconds * 1000);
                }
            }
            throw new Error(`ParallelBatchNode ${this.constructor.name} failed to process an item after retries.`);
        };
        // Pass runtimeParams to each parallel execution context
        const promises = items.map((item) => executeItemWithRetry(item));
        return Promise.all(promises);
    }
}
exports.ParallelBatchNode = ParallelBatchNode;
// --- Flow ---
class Flow extends BaseNode {
    constructor(startNode) {
        super();
        if (!startNode)
            throw new Error("Flow must have a startNode.");
        this.startNode = startNode;
    }
    getNextNode(currentNode, action) {
        const effectiveAction = action || exports.DEFAULT_ACTION;
        const successors = currentNode.getSuccessors();
        const nextNode = successors.get(effectiveAction);
        if (!nextNode && successors.size > 0) {
            const availableActions = Array.from(successors.keys());
            if (!availableActions.includes(effectiveAction))
                console.warn(`Flow ${this.constructor.name} halting: Action '${effectiveAction}' not found in successors of ${currentNode.constructor.name}. Available: [${availableActions.join(", ")}]`);
        }
        return nextNode || null;
    }
    /** Orchestration logic: Runs nodes passing runtime parameters. */
    async _orchestrate(shared, flowRuntimeParams) {
        let currentNode = this.startNode;
        while (currentNode) {
            const nodeToRun = currentNode;
            // Each node in the sequence receives the *flow's* runtime parameters
            const actionResult = await nodeToRun.run(shared, flowRuntimeParams);
            currentNode = this.getNextNode(nodeToRun, actionResult);
        }
    }
    async exec(prepResult, runtimeParams) {
        throw new Error(`Flow (${this.constructor.name}) cannot exec.`);
    }
    // Override the public run method to handle parameter merging correctly for the Flow itself
    async run(shared, runtimeParams) {
        // Combine flow's default params with runtime params
        const finalFlowParams = {
            ...this.defaultParams,
            ...(runtimeParams || {}),
        };
        const prepResult = await Promise.resolve(this.prep(shared, finalFlowParams));
        await this._orchestrate(shared, finalFlowParams); // Pass merged params to orchestration
        const actionResult = await Promise.resolve(this.post(shared, prepResult, null, finalFlowParams));
        return (actionResult !== null && actionResult !== void 0 ? actionResult : exports.DEFAULT_ACTION);
    }
}
exports.Flow = Flow;
// --- Batch Flow (Sequential Orchestration) ---
class BatchFlow extends Flow {
    // Override run to handle parameter merging and batch iteration
    async run(shared, runtimeParams) {
        const finalFlowParams = {
            ...this.defaultParams,
            ...(runtimeParams || {}),
        };
        const prepResult = await this.prep(shared, finalFlowParams);
        try {
            for await (const batchParam of ensureAsyncIterable(prepResult)) {
                // For each batch item, merge flow params with batch-specific params
                // These become the runtime params for the orchestration run
                const combinedParams = { ...finalFlowParams, ...batchParam };
                // Run one orchestration with the combined parameters
                await this._orchestrate(shared, combinedParams);
            }
        }
        catch (e) {
            console.error(`Error iterating prepResult in ${this.constructor.name}:`, e);
            throw e;
        }
        // Final post uses the original flow params and the full prep result
        const actionResult = await this.post(shared, prepResult, null, finalFlowParams);
        return (actionResult !== null && actionResult !== void 0 ? actionResult : exports.DEFAULT_ACTION);
    }
}
exports.BatchFlow = BatchFlow;
// --- Parallel Batch Flow ---
class ParallelBatchFlow extends BatchFlow {
    // Inherits signatures from BatchFlow
    // Override run to perform parallel orchestration
    async run(shared, runtimeParams) {
        const finalFlowParams = {
            ...this.defaultParams,
            ...(runtimeParams || {}),
        };
        const prepResult = await this.prep(shared, finalFlowParams);
        const batchParamsList = [];
        try {
            for await (const batchParam of ensureAsyncIterable(prepResult)) {
                batchParamsList.push(batchParam);
            }
        }
        catch (e) {
            console.error(`Error collecting items from prepResult in ${this.constructor.name}:`, e);
            throw e;
        }
        if (batchParamsList.length > 0) {
            const orchestrationPromises = batchParamsList.map((batchParam) => {
                // Combine flow params with batch params for this specific parallel run
                const combinedParams = { ...finalFlowParams, ...batchParam };
                // No cloning needed - just call orchestrate with the correct params
                // _orchestrate will pass these params down to the startNode.run call
                return this._orchestrate(shared, combinedParams);
            });
            await Promise.all(orchestrationPromises);
        }
        const actionResult = await this.post(shared, prepResult, null, finalFlowParams);
        return (actionResult !== null && actionResult !== void 0 ? actionResult : exports.DEFAULT_ACTION);
    }
}
exports.ParallelBatchFlow = ParallelBatchFlow;
//# sourceMappingURL=index.js.map