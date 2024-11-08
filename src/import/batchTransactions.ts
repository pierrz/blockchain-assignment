import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { parse } from "csv-parse";
import { join } from "path";
import { pipeline } from "stream/promises";
import { importData } from "./utils.js";
import { Transform } from "stream";
import config from "config";
import {
  transactionTableName,
  transactionCSVFields,
  TransactionInterface,
} from "../models/transactions.js";

export async function importTransactions() {
  async function processTransactions(
    filePath: string,
  ): Promise<TransactionInterface[]> {
    const BATCH_SIZE = 10000;
    let batch: TransactionInterface[] = [];
    let transactions: TransactionInterface[] = [];

    try {
      await pipeline(
        createReadStream(filePath),
        createGunzip(),
        parse({
          columns: transactionCSVFields,
          from_line: 2,
          skip_empty_lines: true,
          skip_records_with_empty_values: true,
          skip_records_with_error: true,
          quote: '"',
        }),
        new Transform({
          objectMode: true,
          async transform(row, encoding, callback) {
            try {
              const transaction: TransactionInterface = {
                timestamp: row.timestamp.replace(" ", "T"),
                status: Boolean(row.status),
                block_number: BigInt(row.block_number).toString(),
                tx_index: BigInt(row.tx_index).toString(),
                from_address: row.from,
                to_address: row.to,
                // these fields might be decimals, hence using Number() and not BigInt()
                value: Number(row.value).toString(),
                gas_limit: Number(row.gas_limit).toString(),
                gas_used: Number(row.gas_used).toString(),
                gas_price: Number(row.gas_price).toString(),
              };

              batch.push(transaction);

              if (batch.length >= BATCH_SIZE) {
                transactions.push(...batch);
                batch = [];
              }

              callback();
            } catch (error) {
              callback(error as Error);
            }
          },
          flush(callback) {
            if (batch.length > 0) {
              transactions.push(...batch);
            }
            callback();
          },
        }),
      );

      return transactions;
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      throw error;
    }
  }

  const dataDir = config.get<string>("directories.dataDir"),
    sourceDir = join(dataDir, config.get<string>("directories.sourceDir"));

  importData(sourceDir, transactionTableName, processTransactions).catch(
    (error: unknown) => {
      console.error(`Failed to import transactions:`, error);
      process.exit(1);
    },
  );
}
