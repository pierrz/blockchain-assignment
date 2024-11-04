import { createReadStream } from 'fs';
import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { createGunzip } from 'zlib';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
import { clickhouse } from '../dbClient/clickhouseClient.js';
import { moveFile } from './utils.js';
import { Transform } from 'stream';
import { dataDir, processedDir, failedDir } from '../config.js';

const csv_headers = ["timestamp","status","block_number","tx_index","from","to","value","gas_limit","gas_used","gas_price"];

// Transactions are loaded mostly as string data to cover for some TS limitations:
//  - maintain number (integers and decimals) length
//  - maintain to types of addresses (EVM and Avalanches)
interface Transaction {
    timestamp: string;
    status: boolean;
    block_number: string;
    tx_index: string;
    from_address: string;
    to_address: string;
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
                    columns: csv_headers,
                    from_line: 2,
                    skip_empty_lines: true,
                    skip_records_with_empty_values: true,
                    skip_records_with_error: true,
                    quote: '"'
                }),
                new Transform({
                    objectMode: true,
                    async transform(row, encoding, callback) {
                        try {
                            const transaction: Transaction = {
                                timestamp: (row.timestamp).replace(' ', 'T'),
                                status: Boolean(row.status),
                                block_number: BigInt(row.block_number).toString(),
                                tx_index: BigInt(row.tx_index).toString(),
                                from_address: row.from,
                                to_address: row.to,
                                // these fields might be decimals, hence using Number() and not BigInt()
                                value: Number(row.value).toString(),
                                gas_limit: Number(row.gas_limit).toString(),
                                gas_used: Number(row.gas_used).toString(),
                                gas_price: Number(row.gas_price).toString()
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
                    
                    if (transactions.length > 0) {
                        try {
                            await clickhouse.insert({
                                table: 'blockchain.transactions',
                                values: transactions,
                                format: 'JSONEachRow'
                            });
                            console.log(`Successfully inserted ${transactions.length} transactions`);
                            
                            totalProcessed += transactions.length;
                            console.log(`Inserted ${transactions.length} transactions from ${file}`);

                            try {
                                await moveFile(filePath, processedDir);
                                console.log("File moved to the 'processed' directory.");
                            } catch (moveError) {
                                console.error('Error moving file to processed directory:', moveError);
                            }
                        } catch (error) {
                            console.error('Error inserting transactions:', error);
                            try {
                                await moveFile(filePath, failedDir);
                                console.log("File moved to the 'failed' directory due to insertion error.");
                            } catch (moveError) {
                                console.error('Error moving file to failed directory:', moveError);
                            }
                        }
                    }

                } catch (error) {
                    console.error(`Failed to process file ${file}:`, error);
                    try {
                        await moveFile(filePath, failedDir);
                        console.log("File moved to the 'failed' directory due to processing error.");
                    } catch (moveError) {
                        console.error('Error moving file to failed directory:', moveError);
                    }
                    continue;
                }
            }
            
            if (totalProcessed === 0) {
                console.error('Import potentially failed: 0 transactions processed');
            } else {
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
