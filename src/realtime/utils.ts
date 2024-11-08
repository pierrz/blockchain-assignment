export async function monitorEvents(
  client: any,
  tableName: string,
  eventTypeReference: any,
  processFunction: CallableFunction,
  insertFunction: CallableFunction,
) {
  console.log(`Starting ${tableName} monitoring...`);

  try {
    const blockNumber = await client.getBlockNumber();
    console.log(`Starting from block ${blockNumber}`);

    // Watch for new blocks
    const unwatch = client.watchBlocks({
      onBlock: async (block: any) => {
        // Get full block details
        const fullBlock = await client.getBlock({
          blockHash: block.hash,
          includeTransactions: true,
        });

        // Process each transaction in the block
        const timestamp = Number(fullBlock.timestamp);
        const txPromises = fullBlock.transactions.map((tx: { hash: any }) => {
          if (typeof tx === "string") {
            return processFunction(tx, timestamp);
          }
          return processFunction(tx.hash, timestamp);
        });

        const processedTxs = await Promise.all(txPromises);
        // Use the reference object to check the shape of processed transactions
        const validTxs = processedTxs.filter(
          (tx): tx is typeof eventTypeReference =>
            tx !== null &&
            Object.keys(eventTypeReference).every((key) => key in (tx || {})),
        );

        if (validTxs.length > 0) {
          await insertFunction(validTxs);
        }
      },
      onError: (error: any) => {
        console.error("Block watching error:", error);
      },
    });

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("Shutting down...");
      unwatch();
      process.exit(0);
    });
  } catch (error) {
    console.error(`Error in ${tableName} monitoring:`, error);
    process.exit(1);
  }
}
