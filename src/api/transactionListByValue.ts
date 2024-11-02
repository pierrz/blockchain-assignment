// Transaction List Sorted by Value: 
//  --> Return transactions sorted by value (appropriately paginated),
//  i.e. the amount of $AVAX transferred.

import { clickhouse } from '../dbClient/clickhouseClient.js';

/**
 * Get a paginated list of transactions for a given address, sorted by value.
 * @param address The address to filter transactions.
 * @param page The page number for pagination.
 * @param limit The number of transactions per page.
 * @returns List of transactions sorted by value.
 */
export async function getTransactionsSortedByValue(address: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  try {
    const resultSet = await clickhouse.query({
      query: `
        SELECT *
        FROM transactions
        WHERE from_address = {address:String} OR to_address = {address:String}
        ORDER BY value DESC
        LIMIT ? OFFSET ?
      `,
      // query_params: [address, address, limit, offset]
      query_params: {
        address: address,
        limit: limit,
        offset: offset
      }
    });

    return await resultSet.json();
  } catch (error) {
    console.error("Error querying transactions by value:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve transaction list by value: ${error.message}`);
      } else {
        throw new Error("Failed to retrieve transaction list by value: Unknown error");
      }
  }
}
