import {createPublicClient, http} from 'viem';
import {avalanche} from 'viem/chains';
import {clickhouse} from '../dbClient/clickhouseClient.js';
import {
  transactionTableName,
  transactionTypeReference,
} from '../models/transactions.js';
import {monitorEvents} from './utils.js';
export async function realtimeMonitoring() {
  // Initialize Viem client for Avalanche C-Chain
  const client = createPublicClient({
    chain: avalanche,
    transport: http(),
  });
  async function processTransactions(hash, blockTimestamp) {
    try {
      const [tx, receipt] = await Promise.all([
        client.getTransaction({hash}),
        client.getTransactionReceipt({hash}),
      ]);
      if (!tx || !receipt) return null;
      return {
        timestamp: new Date(blockTimestamp * 1000)
          .toISOString()
          .replace('Z', ''),
        status: Boolean(receipt.status),
        block_number: BigInt(tx.blockNumber).toString(),
        tx_index: BigInt(receipt.transactionIndex).toString(),
        from_address: tx.from.toLowerCase(),
        to_address: tx.to?.toLowerCase() || '',
        value: Number(tx.value).toString(),
        gas_limit: Number(tx.gas).toString(),
        gas_used: Number(receipt.gasUsed).toString(),
        gas_price: Number(tx.gasPrice).toString(),
      };
    } catch (error) {
      console.error(`Error processing transaction ${hash}:`, error);
      return null;
    }
  }
  async function insertTransactions(transactions) {
    if (transactions.length === 0) return;
    try {
      await clickhouse.insert({
        table: `blockchain.${transactionTableName}`,
        values: transactions,
        format: 'JSONEachRow',
      });
      console.log(`Inserted ${transactions.length} transactions`);
    } catch (error) {
      console.error('Error inserting transactions:', error);
    }
  }
  // Start monitoring with the type reference object
  monitorEvents(
    client,
    transactionTableName,
    transactionTypeReference,
    processTransactions,
    insertTransactions,
  ).catch(console.error);
}
