// Transaction Count endpoint: 
//  -> Provide the number of transactions made or received from a given address.

/**
 * Get the total count of transactions for a given address.
 * @param address The address to filter transactions.
 * @returns Number of transactions made or received by the address.
 */

import { clickhouse } from '../dbClient/clickhouseClient.js';

export async function getTransactionCount(address: string): Promise<number> {
  if (!address) {
    throw new Error("Address parameter is required");
  }

  try {
    const resultSet = await clickhouse.query({
      query: `
        SELECT count(*) AS transactionCount
        FROM transactions
        WHERE from_address = {address:String} OR to_address = {address:String}
      `,
      query_params: {
        address: address
      }
    });

    const rows = await resultSet.json();
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return 0;
    }

    const count = rows[0]?.transactionCount;
    return typeof count === 'number' ? count : 0;

  } catch (error) {
    console.error("Error counting transactions:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to retrieve transaction count: ${error.message}`);
    } else {
      throw new Error("Failed to retrieve transaction count: Unknown error");
    }
  }
}
