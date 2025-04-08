"use strict";
// --- Example Usage (Conceptual - Async Native V4 Simplified) ---
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
// Example Utility
const fakeApiCall = async (data, failRate = 0) => {
    await (0, index_1.sleep)(Math.random() * 50 + 10);
    if (Math.random() < failRate)
        throw new Error("Simulated API failure");
    return { success: true, received: data };
};
// Example Nodes - Updated signatures to accept runtimeParams, attemptIndex
class FetchItemNode extends index_1.Node {
    // prep doesn't need params here, but signature includes it
    async prep(shared, runtimeParams) {
        return undefined;
    }
    // exec uses runtimeParams and attemptIndex
    async exec(prepResult, runtimeParams, attemptIndex) {
        const id = runtimeParams.itemId || "unknown";
        console.log(` Fetching item: ${id} (Attempt: ${attemptIndex !== null && attemptIndex !== void 0 ? attemptIndex : 0 + 1})`);
        const result = await fakeApiCall({ id }, 0.4);
        return { data: `ItemData[${id}] Result: ${JSON.stringify(result)}` };
    }
    // post uses runtimeParams
    async post(shared, prepResult, execResult, runtimeParams) {
        shared.items = shared.items || [];
        shared.items.push(execResult.data);
        return index_1.DEFAULT_ACTION;
    }
    // execFallback uses runtimeParams and attemptIndex
    async execFallback(prepResult, error, runtimeParams, attemptIndex) {
        const id = runtimeParams.itemId || "unknown";
        console.warn(` Fetch fallback for item ${id} on attempt ${attemptIndex + 1}: ${error.message}`);
        return { data: `FallbackData[${id}]` };
    }
}
// Example Batch Node processing items
class ProcessItemsNode extends index_1.BatchNode {
    // prep uses runtimeParams (example)
    async prep(shared, runtimeParams) {
        const items = shared.items || [];
        console.log(` Prepare Processing (Mode: ${runtimeParams.processMode}): Found ${items.length} items.`);
        return items;
    }
    // execItem uses runtimeParams and attemptIndex
    async execItem(item, runtimeParams, attemptIndex) {
        console.log(`   Processing item: ${item.substring(0, 30)}... (Attempt: ${attemptIndex + 1})`);
        await (0, index_1.sleep)(runtimeParams.processMode === "slow" ? 50 : 15); // Use param
        if (item.includes("FAIL") || item.includes("Fallback")) {
            throw new Error("Intentional processing failure");
        }
        return `PROCESSED[${item.substring(0, 20)}]`;
    }
    // execItemFallback uses runtimeParams and attemptIndex
    async execItemFallback(item, error, runtimeParams, attemptIndex) {
        console.warn(`   Fallback processing item: ${item.substring(0, 30)}... on attempt ${attemptIndex + 1}. Error: ${error.message}`);
        return `FAILED_PROCESSING[${item.substring(0, 20)}]`;
    }
    // post uses runtimeParams
    async post(shared, prepResult, execResultList, runtimeParams) {
        shared.processedItems = execResultList;
        console.log(` Post Processing: Stored ${execResultList.length} processed results.`);
        return execResultList.length > 0 ? "finalize" : "empty";
    }
}
class FinalizeNode extends index_1.Node {
    // Uses default Params
    async prep(shared, runtimeParams) {
        return shared.processedItems || [];
    }
    async exec(processedItems, runtimeParams, attemptIndex) {
        console.log(` Finalizing report for ${processedItems.length} items.`);
        const successCount = processedItems.filter((s) => s.startsWith("PROCESSED")).length;
        const failedCount = processedItems.length - successCount;
        return `Final Report: ${processedItems.length} items attempted. Success: ${successCount}, Failed: ${failedCount}.`;
    }
    async post(shared, prepResult, execResult, runtimeParams) {
        shared.report = execResult;
        console.log(` Report generated: "${execResult}"`);
        return index_1.DEFAULT_ACTION;
    }
}
class HandleEmptyNode extends index_1.Node {
    async exec() {
        console.warn(" Handling empty batch or processing result.");
    }
}
// Example Parallel Batch Flow
// This flow's *own* params (P) are default {}, BatchP = ItemParams
class ConcurrentFetchFlow extends index_1.ParallelBatchFlow {
    constructor(startNode) {
        super(startNode);
    }
    // Prep provides parameters for each parallel branch
    async prep(shared, runtimeParams) {
        const itemIds = ["A-101", "B-202", "C-303", "D-404", "E-FAIL-505"];
        console.log(`\nFlow Prep: Preparing parallel fetch for IDs: ${itemIds.join(", ")}`);
        return itemIds.map((id) => ({ itemId: id })); // Iterable<ItemParams>
    }
    // Post runs after all parallel branches complete
    async post(shared, prepResult, execResult, runtimeParams) {
        var _a, _b;
        if (shared.items) {
            shared.items.sort();
        }
        console.log(`Flow Post: Parallel fetches completed. Collected ${((_a = shared.items) === null || _a === void 0 ? void 0 : _a.length) || 0} results.`);
        return ((_b = shared.items) === null || _b === void 0 ? void 0 : _b.length) > 0 ? "process_results" : "empty_batch";
    }
}
// Main Execution
async function main() {
    const shared = { items: [], processedItems: [], report: null };
    // Create node instances
    const fetcher = new FetchItemNode(3, 0.1);
    // Pass default parameters for processor node if needed
    const processor = new ProcessItemsNode().setParams({ processMode: "fast" });
    const finalizer = new FinalizeNode();
    const emptyHandler = new HandleEmptyNode();
    // Create the parallel flow instance
    const parallelFlow = new ConcurrentFetchFlow(fetcher);
    // Connect flow actions
    parallelFlow.connectAction("process_results", processor);
    parallelFlow.connectAction("empty_batch", emptyHandler);
    processor.connectAction("finalize", finalizer);
    processor.connectAction("empty", emptyHandler);
    // Master flow can also have default parameters
    const masterFlow = new index_1.Flow(parallelFlow).setParams({ globalSetting: "xyz" });
    console.log("--- Starting Async Native Flow (v4 Simplified) ---");
    try {
        // We can pass runtime parameters to the top-level flow run
        // These will merge with default params and flow down
        await masterFlow.run(shared, { processMode: "slow" }); // Override processor mode at runtime
        console.log("\n--- Flow Completed ---");
    }
    catch (e) {
        console.error("\n--- Flow Failed ---", e);
    }
    finally {
        console.log("\nFinal Shared State:", JSON.stringify(shared, null, 2));
    }
}
main(); // Uncomment to run
//# sourceMappingURL=example1.js.map