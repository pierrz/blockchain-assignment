import { createPublicClient, http, parseAbiItem } from 'viem';
import { avalanche } from 'viem/chains';
import { clickhouse } from '../dbClient/clickhouseClient';
// import { createClient } from 'clickhouse';
// import dotenv from 'dotenv';

// dotenv.config();

// // Initialize ClickHouse client
// const clickhouse = createClient({
//   host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
//   username: process.env.CLICKHOUSE_USER || 'default',
//   password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse',
//   database: process.env.CLICKHOUSE_DB || 'blockchain'
// });

// Initialize Viem client for Avalanche C-Chain
const client = createPublicClient({
  chain: avalanche,
  transport: http()
});

// Transaction type matching our ClickHouse schema
type Transaction = {
  timestamp: string;
  status: number;
  block_number: number;
  tx_index: number;
  from_address: string;
  to_address: string;
  value: string;
  gas_limit: number;
  gas_used: number;
  gas_price: string;
};

async function processTransaction(hash: `0x${string}`, blockTimestamp: number): Promise<Transaction | null> {
  try {
    const [tx, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash })
    ]);

    if (!tx || !receipt) return null;

    return {
      timestamp: new Date(blockTimestamp * 1000).toISOString(),
      status: receipt.status ? 1 : 0,
      block_number: Number(tx.blockNumber),
      tx_index: Number(receipt.transactionIndex),
      from_address: tx.from.toLowerCase(),
      to_address: tx.to?.toLowerCase() || '',
      value: tx.value.toString(),
      gas_limit: Number(tx.gas),
      gas_used: Number(receipt.gasUsed),
      gas_price: tx.gasPrice?.toString() || '0'
    };
  } catch (error) {
    console.error(`Error processing transaction ${hash}:`, error);
    return null;
  }
}

async function insertTransactions(transactions: Transaction[]) {
  if (transactions.length === 0) return;

  try {
    const values = transactions.map(tx => `(
      '${tx.timestamp}',
      ${tx.status},
      ${tx.block_number},
      ${tx.tx_index},
      '${tx.from_address}',
      '${tx.to_address}',
      '${tx.value}',
      ${tx.gas_limit},
      ${tx.gas_used},
      '${tx.gas_price}'
    )`).join(',');

    const query = `
      INSERT INTO transactions (
        timestamp,
        status,
        block_number,
        tx_index,
        from_address,
        to_address,
        value,
        gas_limit,
        gas_used,
        gas_price
      ) VALUES ${values}
    `;

    await clickhouse.query(query).toPromise();
    console.log(`Inserted ${transactions.length} transactions`);
  } catch (error) {
    console.error('Error inserting transactions:', error);
  }
}

async function monitorTransactions() {
  console.log('Starting transaction monitoring...');

  try {
    const blockNumber = await client.getBlockNumber();
    console.log(`Starting from block ${blockNumber}`);

    // Watch for new blocks
    const unwatch = client.watchBlocks({
      onBlock: async (block) => {
        const transactions: Transaction[] = [];
        
        // Get full block details
        const fullBlock = await client.getBlock({
          blockHash: block.hash,
          includeTransactions: true
        });

        // Process each transaction in the block
        const timestamp = Number(fullBlock.timestamp);
        const txPromises = fullBlock.transactions.map(tx => {
          if (typeof tx === 'string') {
            return processTransaction(tx, timestamp);
          }
          return processTransaction(tx.hash, timestamp);
        });

        const processedTxs = await Promise.all(txPromises);
        const validTxs = processedTxs.filter((tx): tx is Transaction => tx !== null);

        if (validTxs.length > 0) {
          await insertTransactions(validTxs);
        }
      },
      onError: (error) => {
        console.error('Block watching error:', error);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      unwatch();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error in transaction monitoring:', error);
    process.exit(1);
  }
}

// Start monitoring
monitorTransactions().catch(console.error);
