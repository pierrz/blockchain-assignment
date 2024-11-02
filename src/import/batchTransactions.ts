import { createReadStream, rename, mkdir } from 'fs';
import { readdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { createGunzip } from 'zlib';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
// import type { Transform } from 'stream';
import { clickhouse } from '../dbClient/clickhouseClient.js';
import { Transform } from 'stream';

const dataDir = '/srv/data',
    processedDir = join(dataDir, 'processed'),
    failedDir = join(dataDir, 'failed');

interface Transaction {
    timestamp: string;
    status: boolean;
    block_number: bigint;
    tx_index: number;
    from_address: string;
    to_address: string;
    value: string;
    gas_limit: bigint;
    gas_used: bigint;
    gas_price: string;
}

interface CSVRecord {
    timestamp: string;
    status: string;
    block_number: string;
    tx_index: string;
    from: string;
    to: string;
    value: string;
    gas_limit: string;
    gas_used: string;
    gas_price: string;
}

export async function startImport() {

    async function processFile(filePath: string): Promise<Transaction[]> {
        const BATCH_SIZE = 10000;
        let batch: Transaction[] = [];
        let transactions: Transaction[] = [];
    
        try {
            await pipeline(
                createReadStream(filePath),
                createGunzip(),
                parse({
                    columns: true,
                    skip_empty_lines: true,
                    skip_records_with_empty_values: true,
                    skip_records_with_error: true,
                    cast: true,
                }),
                new Transform({
                    objectMode: true,
                    async transform(record: CSVRecord, encoding, callback) {
                        try {
                            const transaction: Transaction = {
                                timestamp: record.timestamp,
                                // status: record.status === 'true',
                                status: Boolean(record.status),
                                block_number: BigInt(record.block_number),
                                tx_index: parseInt(record.tx_index, 10),
                                from_address: record.from,
                                to_address: record.to,
                                value: record.value,
                                gas_limit: BigInt(record.gas_limit),
                                gas_used: BigInt(record.gas_used),
                                gas_price: record.gas_price,
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
                })
            );
    
            return transactions;
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            throw error;
        }
    }

    async function moveFile(sourcePath: string, destinationDir: string): Promise<void> {
        return new Promise((resolve, reject) => {
          const destinationPath = join(destinationDir, basename(sourcePath));
      
        mkdir(destinationDir, { recursive: true }, (err) => {
            if (err) {
              reject(err);
            } else {
              rename(sourcePath, destinationPath, (err: any) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          });
        });
      }
      
    async function importTransactions(): Promise<void> {
        
        let totalProcessed = 0;

        try {
            const files = await readdir(dataDir);
            const tarGzFiles = files.filter((file: string) => file.endsWith('.tar.gz'));

            if (tarGzFiles.length === 0) {
                console.log('No .tar.gz files found in data directory');
                return;
            }

            for (const file of tarGzFiles) {
                const filePath = join(dataDir, file);
                console.log(`Processing file: ${file}`);

                try {
                    const transactions = await processFile(filePath);
                    const valuesString = transactions
                            .map((transaction) => `('${transaction.timestamp}', ${transaction.status ? 1 : 0}, ${transaction.block_number}, ${transaction.tx_index}, '${transaction.from_address}', '${transaction.to_address}', '${transaction.value}', ${transaction.gas_limit}, ${transaction.gas_used}, '${transaction.gas_price}')`)
                            .join(',');
                    
                    if (transactions.length > 0) {
                        try {
                            await clickhouse.insert({
                                table: 'blockchain.transactions',
                                values: transactions,
                                format: 'JSONEachRow'
                            });
                            console.log(`Successfully inserted ${transactions.length} transactions`);
                        } catch (error) {
                            console.error('Error inserting transactions:', error);
                        }
                        totalProcessed += transactions.length;
                        console.log(`Inserted ${transactions.length} transactions from ${file}`);

                        moveFile(filePath, processedDir)
                            .then(() => console.log("File moved to the 'processed' directory."))
                            .catch((err) => console.error('Error moving file:', err));
                    }

                } catch (error) {
                    console.error(`Failed to process file ${file}:`, error);
                    moveFile(filePath, failedDir)
                        .then(() => console.log("File moved to the 'failed' directory."))
                        .catch((err) => console.error('Error moving file:', err));
                    continue;
                }
            }
            
            if (totalProcessed == 0) {
                console.error('Import potentially failed: 0 transactions processed');
            }
            else {
                console.log(`Import completed successfully. Total transactions processed: ${totalProcessed}`);
            }

        } catch (error) {
            console.error('Error during import:', error);
            throw error;
        }
    }

    importTransactions().catch((error: unknown) => {
        console.error('Failed to import transactions:', error);
        process.exit(1);
    });

}
