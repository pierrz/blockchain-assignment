// Transaction List endpoint:
//  -> Return all transactions (appropriately paginated) made or received from a given address,
//  sorted by blockNumber and transactionIndex.
/**
 * Get a paginated list of transactions for a given address, sorted by blockNumber and transactionIndex.
 * @param address The address to filter transactions.
 * @param page The page number for pagination.
 * @param limit The number of transactions per page.
 * @param byValue Optional parameter to get the list sorted by value
 * @returns List of transactions sorted by blockNumber and transactionIndex (default) or by value,
 *  with additional meta such as address, page number, total_value, page_total_value and elapsed_time_in_seconds
 */
import {clickhouse} from '../dbClient/clickhouseClient.js';
export async function getTransactions(
  address,
  page = 1,
  limit = 10,
  byValue = false,
) {
  const offset = (page - 1) * limit;
  if (!address) {
    throw new Error('Address parameter is required');
  }
  try {
    // total queries
    const totalValueQuery = `
        SELECT sum(value) as total_value
        FROM blockchain.transactions
        WHERE from_address = '${address}' OR to_address = '${address}'
    `;
    let totalValueByPageQuery = totalValueQuery;
    // queries sorting by values or not
    let listQuery = `
        SELECT *
        FROM blockchain.transactions
        WHERE from_address = '${address}' OR to_address = '${address}'
      `;
    if (byValue) {
      listQuery = `${listQuery} ORDER BY value DESC`;
    } else {
      listQuery = `${listQuery} ORDER BY block_number, tx_index`;
    }
    // final queries
    const queryTail = 'LIMIT {limit:UInt32} OFFSET {offset:UInt32}';
    listQuery = `${listQuery} ${queryTail}`;
    totalValueByPageQuery = `${totalValueByPageQuery} ${queryTail}`;
    // Get data from DB
    const resultSet = await clickhouse.query({
        query: listQuery,
        query_params: {
          limit: limit,
          offset: offset,
        },
      }),
      totalSet = await clickhouse.query({query: totalValueQuery}),
      totalByPageSet = await clickhouse.query({
        query: totalValueByPageQuery,
        query_params: {
          limit: limit,
          offset: offset,
        },
      });
    // Data preps
    const result = await resultSet.json(),
      elapsedTime = parseFloat((result.statistics?.elapsed ?? 0).toFixed(6)),
      totalJson = await totalSet.json(),
      totalByPageJson = await totalByPageSet.json(),
      totalData = totalJson.data[0],
      totalByPageData = totalByPageJson.data[0];
    return {
      address,
      page: page,
      total_value: totalData?.total_value ?? 0,
      page_total_value: totalByPageData?.total_value ?? 0,
      elapsed_time_in_seconds: elapsedTime,
      data: result.data,
    };
  } catch (error) {
    console.error('Error counting transactions:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to retrieve transaction list: ${error.message}`);
    } else {
      throw new Error('Failed to retrieve transaction list: Unknown error');
    }
  }
}
