/**
 * PocketFlow TypeScript Port - Async Native Version 4 (Simplified)
 * A minimalist, async-native framework for building agentic applications and workflows.
 */

// --- Core Types ---
export type SharedState = Record<string, any>;
export type Params = Record<string, any>;
export type ActionResult = string | undefined | null;
export const DEFAULT_ACTION = "default";

// --- Utility Functions ---
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
async function* ensureAsyncIterable<T>(
  source: AsyncIterable<T> | Iterable<T>,
): AsyncIterable<T> {
  // Yields items from either an async or sync iterable source.
  // Necessary for reliable type handling with `for await...of` on generic unions.
  yield* source;
}

// --- Base Node ---
export abstract class BaseNode<
  S extends SharedState = SharedState,
  P extends Params = Params,
  PrepR = any,
  ExecR = any,
  ActR extends ActionResult = ActionResult,
> {
  // Default parameters for the node definition
  public defaultParams: P = {} as P;
  protected readonly _successors: Map<
    string,
    BaseNode<any, any, any, any, any>
  > = new Map();

  // Method to set the default parameters when defining the node/flow
  setParams(params: P): this {
    this.defaultParams = params;
    return this; // Allow chaining
  }

  addSuccessor<N extends BaseNode<any, any, any, any, any>>(
    node: N,
    action: string = DEFAULT_ACTION,
  ): N {
    if (this._successors.has(action))
      console.warn(
        `Overwriting successor for action '${action}' in node ${this.constructor.name}`,
      );
    this._successors.set(action, node);
    return node;
  }
  connectTo<N extends BaseNode<any, any, any, any, any>>(targetNode: N): N {
    return this.addSuccessor(targetNode, DEFAULT_ACTION);
  }
  connectAction<N extends BaseNode<any, any, any, any, any>>(
    action: string,
    targetNode: N,
  ): N {
    if (!action || typeof action !== "string")
      throw new TypeError("Action must be non-empty string");
    return this.addSuccessor(targetNode, action);
  }

  // Core lifecycle methods now accept runtime parameters explicitly
  async prep(shared: S, runtimeParams: P): Promise<PrepR> {
    return undefined as PrepR;
  }
  // Exec also receives attempt index for retry logic
  async exec(
    prepResult: PrepR,
    runtimeParams: P,
    attemptIndex?: number,
  ): Promise<ExecR> {
    return undefined as ExecR;
  }
  async post(
    shared: S,
    prepResult: PrepR,
    execResult: ExecR,
    runtimeParams: P,
  ): Promise<ActR> {
    return DEFAULT_ACTION as ActR;
  }

  /** Internal exec wrapper; overridden by Node for retries. */
  protected async _exec(prepResult: PrepR, runtimeParams: P): Promise<ExecR> {
    // Base implementation calls exec with attempt 0
    return await this.exec(prepResult, runtimeParams, 0);
  }

  /** Public run cycle for a single node execution. Accepts runtime parameters. */
  public async run(shared: S, runtimeParams?: P): Promise<ActR> {
    // Combine default params with runtime params (runtime takes precedence)
    const finalParams = {
      ...this.defaultParams,
      ...(runtimeParams || {}),
    } as P;

    const prepResult = await Promise.resolve(this.prep(shared, finalParams));
    // Pass finalParams to _exec, which handles retries and passes them down
    const execResult = await this._exec(prepResult, finalParams);
    const actionResult = await Promise.resolve(
      this.post(shared, prepResult, execResult, finalParams),
    );
    return (actionResult ?? DEFAULT_ACTION) as ActR;
  }

  // Keep this separate run method for direct execution without successors check/param merging
  async runDirect(shared: S, params?: P): Promise<ActR> {
    return this.run(shared, params);
  }

  getSuccessors(): ReadonlyMap<string, BaseNode<any, any, any, any, any>> {
    return this._successors;
  }
}

// --- Node (with Retries) ---
export class Node<
  S extends SharedState = SharedState,
  P extends Params = Params,
  PrepR = any,
  ExecR = any,
  ActR extends ActionResult = ActionResult,
> extends BaseNode<S, P, PrepR, ExecR, ActR> {
  public readonly maxRetries: number;
  public readonly waitSeconds: number;

  constructor(maxRetries: number = 1, waitSeconds: number = 0) {
    super();
    this.maxRetries = Math.max(1, maxRetries);
    this.waitSeconds = Math.max(0, waitSeconds);
  }

  // Fallback now also receives runtime params and attempt index
  async execFallback(
    prepResult: PrepR,
    error: Error,
    runtimeParams: P,
    attemptIndex: number,
  ): Promise<ExecR> {
    throw error;
  }

  protected override async _exec(
    prepResult: PrepR,
    runtimeParams: P,
  ): Promise<ExecR> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Pass runtimeParams and current attempt index to exec
        return await this.exec(prepResult, runtimeParams, attempt);
      } catch (error) {
        console.warn(
          `Node ${this.constructor.name} exec failed (attempt ${attempt + 1}/${this.maxRetries}):`,
          error instanceof Error ? error.message : error,
        );
        if (attempt === this.maxRetries - 1) {
          console.warn(
            `Node ${this.constructor.name} max retries reached. Using fallback.`,
          );
          // Pass runtimeParams and final attempt index to fallback
          return await this.execFallback(
            prepResult,
            error as Error,
            runtimeParams,
            attempt,
          );
        }
        if (this.waitSeconds > 0) await sleep(this.waitSeconds * 1000);
      }
    }
    throw new Error(
      `Node ${this.constructor.name} execution failed unexpectedly after retries.`,
    );
  }
}

// --- Batch Node (Sequential Execution) ---
export abstract class BatchNode<
  S extends SharedState = SharedState,
  P extends Params = Params,
  Item = any,
  ExecRItem = any,
  ActR extends ActionResult = ActionResult,
  PrepR extends AsyncIterable<Item> | Iterable<Item> =
    | AsyncIterable<Item>
    | Iterable<Item>,
> extends Node<S, P, PrepR, ExecRItem[], ActR> {
  // Returns array of item results
  abstract override prep(shared: S, runtimeParams: P): Promise<PrepR>;
  // Item execution methods now accept runtimeParams and attemptIndex
  abstract execItem(
    item: Item,
    runtimeParams: P,
    attemptIndex: number,
  ): Promise<ExecRItem>;
  abstract override post(
    shared: S,
    prepResult: PrepR,
    execResultList: ExecRItem[],
    runtimeParams: P,
  ): Promise<ActR>;
  abstract execItemFallback(
    item: Item,
    error: Error,
    runtimeParams: P,
    attemptIndex: number,
  ): Promise<ExecRItem>;

  // Override _exec to implement batch logic using new item methods
  protected override async _exec(
    prepResult: PrepR,
    runtimeParams: P,
  ): Promise<ExecRItem[]> {
    const results: ExecRItem[] = [];
    try {
      for await (const item of ensureAsyncIterable(prepResult)) {
        let itemResult: ExecRItem | undefined = undefined;
        let success = false;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
          try {
            // Pass runtimeParams and attempt index down to item execution
            itemResult = await this.execItem(item, runtimeParams, attempt);
            success = true;
            break;
          } catch (error) {
            console.warn(
              `BatchNode ${this.constructor.name} item exec failed (attempt ${attempt + 1}/${this.maxRetries}):`,
              error instanceof Error ? error.message : error,
            );
            if (attempt === this.maxRetries - 1) {
              console.warn(
                `BatchNode ${this.constructor.name} item max retries reached. Using item fallback.`,
              );
              // Pass runtimeParams and attempt index down to item fallback
              itemResult = await this.execItemFallback(
                item,
                error as Error,
                runtimeParams,
                attempt,
              );
              success = true;
              break;
            }
            if (this.waitSeconds > 0) await sleep(this.waitSeconds * 1000);
          }
        }
        if (!success)
          throw new Error(
            `BatchNode ${this.constructor.name} failed to process an item after retries.`,
          );
        results.push(itemResult as ExecRItem);
      }
    } catch (e) {
      console.error(
        `Error iterating prepResult in ${this.constructor.name}:`,
        e,
      );
      throw e;
    }
    return results;
  }
}

// --- Parallel Batch Node ---
export abstract class ParallelBatchNode<
  S extends SharedState = SharedState,
  P extends Params = Params,
  Item = any,
  ExecRItem = any,
  ActR extends ActionResult = ActionResult,
  PrepR extends AsyncIterable<Item> | Iterable<Item> =
    | AsyncIterable<Item>
    | Iterable<Item>,
> extends BatchNode<S, P, Item, ExecRItem, ActR, PrepR> {
  protected override async _exec(
    prepResult: PrepR,
    runtimeParams: P,
  ): Promise<ExecRItem[]> {
    const items: Item[] = [];
    try {
      for await (const item of ensureAsyncIterable(prepResult)) {
        items.push(item);
      }
    } catch (e) {
      console.error(
        `Error collecting items from prepResult in ${this.constructor.name}:`,
        e,
      );
      throw e;
    }
    if (items.length === 0) return [];

    const executeItemWithRetry = async (item: Item): Promise<ExecRItem> => {
      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          // Pass runtimeParams and attempt index down
          return await this.execItem(item, runtimeParams, attempt);
        } catch (error) {
          console.warn(
            `ParallelBatchNode ${this.constructor.name} item exec failed (attempt ${attempt + 1}/${this.maxRetries}):`,
            error instanceof Error ? error.message : error,
          );
          if (attempt === this.maxRetries - 1) {
            console.warn(
              `ParallelBatchNode ${this.constructor.name} item max retries reached. Using item fallback.`,
            );
            // Pass runtimeParams and attempt index down
            return await this.execItemFallback(
              item,
              error as Error,
              runtimeParams,
              attempt,
            );
          }
          if (this.waitSeconds > 0) await sleep(this.waitSeconds * 1000);
        }
      }
      throw new Error(
        `ParallelBatchNode ${this.constructor.name} failed to process an item after retries.`,
      );
    };

    // Pass runtimeParams to each parallel execution context
    const promises = items.map((item) => executeItemWithRetry(item));
    return Promise.all(promises);
  }
}

// --- Flow ---
export class Flow<
  S extends SharedState = SharedState,
  P extends Params = Params,
  StartNode extends BaseNode<S, any, any, any, any> = BaseNode<S>,
  ActR extends ActionResult = ActionResult,
> extends BaseNode<S, P, any, null, ActR> {
  // Flow has no direct exec result
  public readonly startNode: StartNode;

  constructor(startNode: StartNode) {
    super();
    if (!startNode) throw new Error("Flow must have a startNode.");
    this.startNode = startNode;
  }

  protected getNextNode(
    currentNode: BaseNode<any, any, any, any, any>,
    action: ActionResult,
  ): BaseNode<any, any, any, any, any> | null {
    const effectiveAction = action || DEFAULT_ACTION;
    const successors = currentNode.getSuccessors();
    const nextNode = successors.get(effectiveAction);
    if (!nextNode && successors.size > 0) {
      const availableActions = Array.from(successors.keys());
      if (!availableActions.includes(effectiveAction))
        console.warn(
          `Flow ${this.constructor.name} halting: Action '${effectiveAction}' not found in successors of ${currentNode.constructor.name}. Available: [${availableActions.join(", ")}]`,
        );
    }
    return nextNode || null;
  }

  /** Orchestration logic: Runs nodes passing runtime parameters. */
  protected async _orchestrate(shared: S, flowRuntimeParams: P): Promise<void> {
    let currentNode: BaseNode<any, any, any, any, any> | null = this.startNode;

    while (currentNode) {
      const nodeToRun = currentNode;
      // Each node in the sequence receives the *flow's* runtime parameters
      const actionResult = await nodeToRun.run(shared, flowRuntimeParams);
      currentNode = this.getNextNode(nodeToRun, actionResult);
    }
  }

  override async exec(prepResult: any, runtimeParams: P): Promise<null> {
    throw new Error(`Flow (${this.constructor.name}) cannot exec.`);
  }

  // Override the public run method to handle parameter merging correctly for the Flow itself
  override async run(shared: S, runtimeParams?: P): Promise<ActR> {
    // Combine flow's default params with runtime params
    const finalFlowParams = {
      ...this.defaultParams,
      ...(runtimeParams || {}),
    } as P;

    const prepResult = await Promise.resolve(
      this.prep(shared, finalFlowParams),
    );
    await this._orchestrate(shared, finalFlowParams); // Pass merged params to orchestration
    const actionResult = await Promise.resolve(
      this.post(shared, prepResult, null, finalFlowParams),
    );
    return (actionResult ?? DEFAULT_ACTION) as ActR;
  }
}

// --- Batch Flow (Sequential Orchestration) ---
export abstract class BatchFlow<
  S extends SharedState = SharedState,
  P extends Params = Params,
  BatchP extends Params = Params, // Params for each batch item
  StartNode extends BaseNode<S, any, any, any, any> = BaseNode<S>,
  PrepR extends AsyncIterable<BatchP> | Iterable<BatchP> =
    | AsyncIterable<BatchP>
    | Iterable<BatchP>,
  ActR extends ActionResult = ActionResult,
> extends Flow<S, P, StartNode, ActR> {
  // Prep now receives the BatchFlow's final runtime parameters
  abstract override prep(shared: S, runtimeParams: P): Promise<PrepR>;
  // Post receives final runtime parameters and the original prep result
  abstract override post(
    shared: S,
    prepResult: PrepR,
    execResult: null,
    runtimeParams: P,
  ): Promise<ActR>;

  // Override run to handle parameter merging and batch iteration
  override async run(shared: S, runtimeParams?: P): Promise<ActR> {
    const finalFlowParams = {
      ...this.defaultParams,
      ...(runtimeParams || {}),
    } as P;
    const prepResult = await this.prep(shared, finalFlowParams);

    try {
      for await (const batchParam of ensureAsyncIterable(prepResult)) {
        // For each batch item, merge flow params with batch-specific params
        // These become the runtime params for the orchestration run
        const combinedParams = { ...finalFlowParams, ...batchParam } as P &
          BatchP;
        // Run one orchestration with the combined parameters
        await this._orchestrate(shared, combinedParams);
      }
    } catch (e) {
      console.error(
        `Error iterating prepResult in ${this.constructor.name}:`,
        e,
      );
      throw e;
    }

    // Final post uses the original flow params and the full prep result
    const actionResult = await this.post(
      shared,
      prepResult,
      null,
      finalFlowParams,
    );
    return (actionResult ?? DEFAULT_ACTION) as ActR;
  }
}

// --- Parallel Batch Flow ---
export abstract class ParallelBatchFlow<
  S extends SharedState = SharedState,
  P extends Params = Params,
  BatchP extends Params = Params, // Params for each batch item
  StartNode extends BaseNode<S, any, any, any, any> = BaseNode<S>,
  PrepR extends AsyncIterable<BatchP> | Iterable<BatchP> =
    | AsyncIterable<BatchP>
    | Iterable<BatchP>,
  ActR extends ActionResult = ActionResult,
> extends BatchFlow<S, P, BatchP, StartNode, PrepR, ActR> {
  // Inherits signatures from BatchFlow
  // Override run to perform parallel orchestration
  override async run(shared: S, runtimeParams?: P): Promise<ActR> {
    const finalFlowParams = {
      ...this.defaultParams,
      ...(runtimeParams || {}),
    } as P;
    const prepResult = await this.prep(shared, finalFlowParams);
    const batchParamsList: BatchP[] = [];

    try {
      for await (const batchParam of ensureAsyncIterable(prepResult)) {
        batchParamsList.push(batchParam);
      }
    } catch (e) {
      console.error(
        `Error collecting items from prepResult in ${this.constructor.name}:`,
        e,
      );
      throw e;
    }

    if (batchParamsList.length > 0) {
      const orchestrationPromises = batchParamsList.map((batchParam) => {
        // Combine flow params with batch params for this specific parallel run
        const combinedParams = { ...finalFlowParams, ...batchParam } as P &
          BatchP;
        // No cloning needed - just call orchestrate with the correct params
        // _orchestrate will pass these params down to the startNode.run call
        return this._orchestrate(shared, combinedParams);
      });
      await Promise.all(orchestrationPromises);
    }

    const actionResult = await this.post(
      shared,
      prepResult,
      null,
      finalFlowParams,
    );
    return (actionResult ?? DEFAULT_ACTION) as ActR;
  }
}
