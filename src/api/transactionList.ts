// Transaction List endpoint: 
//  -> Return all transactions (appropriately paginated) made or received from a given address,
//  sorted by blockNumber and transactionIndex.


import { clickhouse } from '../dbClient/clickhouseClient';

/**
 * Get a paginated list of transactions for a given address, sorted by blockNumber and transactionIndex.
 * @param address The address to filter transactions.
 * @param page The page number for pagination.
 * @param limit The number of transactions per page.
 * @returns List of transactions sorted by blockNumber and transactionIndex.
 */
export async function getTransactions(address: string, page: number = 1, limit: number = 10) {
  const offset = (page - 1) * limit;

  try {
    const resultSet = await clickhouse.query({
      query: `
        SELECT *
        FROM transactions
        WHERE from_address = ? OR to_address = ?
        ORDER BY blockNumber, transactionIndex
        LIMIT ? OFFSET ?
      `,
      query_params: [address, address, limit, offset]
    });

    return await resultSet.json();
  } catch (error) {
    console.error("Error querying transactions:", error);
    throw new Error("Could not retrieve transactions");
  }
}
