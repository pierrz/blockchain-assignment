// Transaction Count endpoint: 
//  -> Provide the number of transactions made or received from a given address.


import { clickhouse } from '../dbClient/clickhouseClient';

/**
 * Get the total count of transactions for a given address.
 * @param address The address to filter transactions.
 * @returns Number of transactions made or received by the address.
 */
export async function getTransactionCount(address: string): Promise<number> {
  try {
    const resultSet = await clickhouse.query({
      query: `
        SELECT count(*) AS transactionCount
        FROM transactions
        WHERE from_address = ? OR to_address = ?
      `,
      query_params: [address, address]
    });

    const rows = await resultSet.json();
    return rows[0].transactionCount;
  } catch (error) {
    console.error("Error counting transactions:", error);
    throw new Error("Could not retrieve transaction count");
  }
}
