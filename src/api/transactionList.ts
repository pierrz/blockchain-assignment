// Transaction List endpoint: 
//  -> Return all transactions (appropriately paginated) made or received from a given address,
//  sorted by blockNumber and transactionIndex.

/**
 * Get a paginated list of transactions for a given address, sorted by blockNumber and transactionIndex.
 * @param address The address to filter transactions.
 * @param page The page number for pagination.
 * @param limit The number of transactions per page.
 * @returns List of transactions sorted by blockNumber and transactionIndex.
 */

import { clickhouse } from '../dbClient/clickhouseClient.js';

export async function getTransactions(address: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  if (!address) {
    throw new Error("Address parameter is required");
  }

  try {
    const listQuery = `
        SELECT *
        FROM blockchain.transactions
        WHERE from_address = '${address}' OR to_address = '${address}'
        ORDER BY blockNumber, transactionIndex
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}
      `
    console.log(listQuery)
    const resultSet = await clickhouse.query({
      query: listQuery,
      query_params: {
        limit: limit,
        offset: offset
      }
    });

    return await resultSet.json();
  }  catch (error) {
      console.error("Error counting transactions:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve transaction list: ${error.message}`);
      } else {
        throw new Error("Failed to retrieve transaction list: Unknown error");
      }
    }
}
