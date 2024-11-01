import { clickhouse } from './clickhouseClient';

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
        WHERE from_address = ? OR to_address = ?
        ORDER BY value DESC
        LIMIT ? OFFSET ?
      `,
      query_params: [address, address, limit, offset]
    });

    return await resultSet.json();
  } catch (error) {
    console.error("Error querying transactions by value:", error);
    throw new Error("Could not retrieve transactions by value");
  }
}
