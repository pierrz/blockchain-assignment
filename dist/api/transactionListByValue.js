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
export async function getTransactionsSortedByValue(address, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    try {
        const listByValuesQuery = `
        SELECT *
        FROM blockchain.transactions
        WHERE from_address = '${address}' OR to_address = '${address}'
        ORDER BY value DESC
        LIMIT {limit:UInt32} OFFSET {offset:UInt32}
      `;
        const resultSet = await clickhouse.query({
            query: listByValuesQuery,
            query_params: {
                address: address,
                limit: limit,
                offset: offset
            }
        });
        return await resultSet.json();
    }
    catch (error) {
        console.error("Error querying transactions by value:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to retrieve transaction list by value: ${error.message}`);
        }
        else {
            throw new Error("Failed to retrieve transaction list by value: Unknown error");
        }
    }
}
