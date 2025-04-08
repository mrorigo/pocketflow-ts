/**
 * PocketFlow TypeScript Port - Async Native Version 4 (Simplified)
 * A minimalist, async-native framework for building agentic applications and workflows.
 */
export type SharedState = Record<string, any>;
export type Params = Record<string, any>;
export type ActionResult = string | undefined | null;
export declare const DEFAULT_ACTION = "default";
export declare const sleep: (ms: number) => Promise<void>;
export declare abstract class BaseNode<S extends SharedState = SharedState, P extends Params = Params, PrepR = any, ExecR = any, ActR extends ActionResult = ActionResult> {
    defaultParams: P;
    protected readonly _successors: Map<string, BaseNode<any, any, any, any, any>>;
    setParams(params: P): this;
    addSuccessor<N extends BaseNode<any, any, any, any, any>>(node: N, action?: string): N;
    connectTo<N extends BaseNode<any, any, any, any, any>>(targetNode: N): N;
    connectAction<N extends BaseNode<any, any, any, any, any>>(action: string, targetNode: N): N;
    prep(shared: S, runtimeParams: P): Promise<PrepR>;
    exec(prepResult: PrepR, runtimeParams: P, attemptIndex?: number): Promise<ExecR>;
    post(shared: S, prepResult: PrepR, execResult: ExecR, runtimeParams: P): Promise<ActR>;
    /** Internal exec wrapper; overridden by Node for retries. */
    protected _exec(prepResult: PrepR, runtimeParams: P): Promise<ExecR>;
    /** Public run cycle for a single node execution. Accepts runtime parameters. */
    run(shared: S, runtimeParams?: P): Promise<ActR>;
    runDirect(shared: S, params?: P): Promise<ActR>;
    getSuccessors(): ReadonlyMap<string, BaseNode<any, any, any, any, any>>;
}
export declare class Node<S extends SharedState = SharedState, P extends Params = Params, PrepR = any, ExecR = any, ActR extends ActionResult = ActionResult> extends BaseNode<S, P, PrepR, ExecR, ActR> {
    readonly maxRetries: number;
    readonly waitSeconds: number;
    constructor(maxRetries?: number, waitSeconds?: number);
    execFallback(prepResult: PrepR, error: Error, runtimeParams: P, attemptIndex: number): Promise<ExecR>;
    protected _exec(prepResult: PrepR, runtimeParams: P): Promise<ExecR>;
}
export declare abstract class BatchNode<S extends SharedState = SharedState, P extends Params = Params, Item = any, ExecRItem = any, ActR extends ActionResult = ActionResult, PrepR extends AsyncIterable<Item> | Iterable<Item> = AsyncIterable<Item> | Iterable<Item>> extends Node<S, P, PrepR, ExecRItem[], ActR> {
    abstract prep(shared: S, runtimeParams: P): Promise<PrepR>;
    abstract execItem(item: Item, runtimeParams: P, attemptIndex: number): Promise<ExecRItem>;
    abstract post(shared: S, prepResult: PrepR, execResultList: ExecRItem[], runtimeParams: P): Promise<ActR>;
    abstract execItemFallback(item: Item, error: Error, runtimeParams: P, attemptIndex: number): Promise<ExecRItem>;
    protected _exec(prepResult: PrepR, runtimeParams: P): Promise<ExecRItem[]>;
}
export declare abstract class ParallelBatchNode<S extends SharedState = SharedState, P extends Params = Params, Item = any, ExecRItem = any, ActR extends ActionResult = ActionResult, PrepR extends AsyncIterable<Item> | Iterable<Item> = AsyncIterable<Item> | Iterable<Item>> extends BatchNode<S, P, Item, ExecRItem, ActR, PrepR> {
    protected _exec(prepResult: PrepR, runtimeParams: P): Promise<ExecRItem[]>;
}
export declare class Flow<S extends SharedState = SharedState, P extends Params = Params, StartNode extends BaseNode<S, any, any, any, any> = BaseNode<S>, ActR extends ActionResult = ActionResult> extends BaseNode<S, P, any, null, ActR> {
    readonly startNode: StartNode;
    constructor(startNode: StartNode);
    protected getNextNode(currentNode: BaseNode<any, any, any, any, any>, action: ActionResult): BaseNode<any, any, any, any, any> | null;
    /** Orchestration logic: Runs nodes passing runtime parameters. */
    protected _orchestrate(shared: S, flowRuntimeParams: P): Promise<void>;
    exec(prepResult: any, runtimeParams: P): Promise<null>;
    run(shared: S, runtimeParams?: P): Promise<ActR>;
}
export declare abstract class BatchFlow<S extends SharedState = SharedState, P extends Params = Params, BatchP extends Params = Params, // Params for each batch item
StartNode extends BaseNode<S, any, any, any, any> = BaseNode<S>, PrepR extends AsyncIterable<BatchP> | Iterable<BatchP> = AsyncIterable<BatchP> | Iterable<BatchP>, ActR extends ActionResult = ActionResult> extends Flow<S, P, StartNode, ActR> {
    abstract prep(shared: S, runtimeParams: P): Promise<PrepR>;
    abstract post(shared: S, prepResult: PrepR, execResult: null, runtimeParams: P): Promise<ActR>;
    run(shared: S, runtimeParams?: P): Promise<ActR>;
}
export declare abstract class ParallelBatchFlow<S extends SharedState = SharedState, P extends Params = Params, BatchP extends Params = Params, // Params for each batch item
StartNode extends BaseNode<S, any, any, any, any> = BaseNode<S>, PrepR extends AsyncIterable<BatchP> | Iterable<BatchP> = AsyncIterable<BatchP> | Iterable<BatchP>, ActR extends ActionResult = ActionResult> extends BatchFlow<S, P, BatchP, StartNode, PrepR, ActR> {
    run(shared: S, runtimeParams?: P): Promise<ActR>;
}
