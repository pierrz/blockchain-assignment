// Transaction Count endpoint: 
//  -> Provide the number of transactions made or received from a given address.
/**
 * Get the total count of transactions for a given address.
 * @param address The address to filter transactions.
 * @returns Object containing address, transaction count and query elapsed time.
 */
import { clickhouse } from '../dbClient/clickhouseClient.js';
export async function getTransactionCount(address) {
    if (!address) {
        throw new Error("Address parameter is required");
    }
    try {
        const countQuery = `
        SELECT count(*) AS transactionCount
        FROM blockchain.transactions
        WHERE from_address = '${address}' OR to_address = '${address}'
      `;
        const resultSet = await clickhouse.query({
            query: countQuery,
            query_params: {
                address: address
            }
        });
        const result = await resultSet.json();
        if (!result?.data?.[0]) {
            return {
                address,
                transaction_count: 0,
                elapsed_time_in_seconds: 0
            };
        }
        // Get all values from the first row using Object.values()
        const values = Object.values(result.data[0]), count = parseInt(values[0], 10), elapsedTime = parseFloat((result.statistics?.elapsed ?? 0).toFixed(6));
        return {
            address,
            transaction_count: isNaN(count) ? 0 : count,
            elapsed_time_in_seconds: elapsedTime
        };
    }
    catch (error) {
        console.error("Error counting transactions:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to retrieve transaction count: ${error.message}`);
        }
        else {
            throw new Error("Failed to retrieve transaction count: Unknown error");
        }
    }
}
