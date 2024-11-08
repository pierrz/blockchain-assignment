// Transaction List endpoint: 
//  -> Return all transactions (appropriately paginated) made or received from a given address,
//  sorted by blockNumber and transactionIndex.
/**
 * Get a paginated list of transactions for a given address, sorted by blockNumber and transactionIndex.
 * @param address The address to filter transactions.
 * @param page The page number for pagination.
 * @param limit The number of transactions per page.
 * @param byValue Optional parameter to get the list sorted by value
 * @returns List of transactions sorted by blockNumber and transactionIndex (default) or by value.
 */
import { clickhouse } from '../dbClient/clickhouseClient.js';
export async function getTransactions(address, page = 1, limit = 10, byValue = false) {
    const offset = (page - 1) * limit;
    if (!address) {
        throw new Error("Address parameter is required");
    }
    try {
        // sorted by values or not
        let listQuery = `
        SELECT *
        FROM blockchain.transactions
        WHERE from_address = '${address}' OR to_address = '${address}'
      `;
        if (byValue) {
            listQuery = `${listQuery} ORDER BY value DESC`;
        }
        else {
            listQuery = `${listQuery} ORDER BY block_number, tx_index`;
        }
        listQuery = `${listQuery} LIMIT {limit:UInt32} OFFSET {offset:UInt32}`;
        const resultSet = await clickhouse.query({
            query: listQuery,
            query_params: {
                limit: limit,
                offset: offset
            }
        });
        const result = await resultSet.json(), elapsedTime = parseFloat((result.statistics?.elapsed ?? 0).toFixed(6));
        return {
            address,
            page: page,
            elapsed_time_in_seconds: elapsedTime,
            data: result.data
        };
    }
    catch (error) {
        console.error("Error counting transactions:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to retrieve transaction list: ${error.message}`);
        }
        else {
            throw new Error("Failed to retrieve transaction list: Unknown error");
        }
    }
}
