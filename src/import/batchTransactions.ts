import { createReadStream } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { createGunzip } from 'zlib';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
import { clickhouse } from '../dbClient/clickhouseClient.js';
import { moveFile } from './utils.js';
import { Transform } from 'stream';
import { dataDir, processedDir, failedDir } from '../config.js';


interface Transaction {
    timestamp: string;
    status: boolean;
    block_number: string;  // Changed from bigint to string
    tx_index: number;
    from_address: string;
    to_address: string;
    value: string;
    gas_limit: string;    // Changed from bigint to string
    gas_used: string;     // Changed from bigint to string
    gas_price: string;    // Changed from bigint to string
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
                            // Some blockchain numeric fields exceed JavaScript's Number.MAX_SAFE_INTEGER
                            // and are converted to string
                            const transaction: Transaction = {
                                timestamp: record.timestamp,
                                // status: record.status === 'true',
                                status: Boolean(record.status),
                                block_number: BigInt(record.block_number).toString(), // Convert to string
                                tx_index: parseInt(record.tx_index, 10),
                                from_address: record.from,
                                to_address: record.to,
                                value: record.value,
                                gas_limit: BigInt(record.gas_limit).toString(),  // Convert to string
                                gas_used: BigInt(record.gas_used).toString(),    // Convert to string
                                gas_price: BigInt(record.gas_price).toString()
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

    // async function moveFile(sourcePath: string, destinationDir: string): Promise<void> {
    //     const destinationPath = join(destinationDir, basename(sourcePath));
    //     try {
    //         await new Promise<void>((resolve, reject) => {
    //             mkdir(destinationDir, { recursive: true }, (err) => {
    //                 if (err) reject(err);
    //                 else resolve();
    //             });
    //         });
            
    //         await new Promise<void>((resolve, reject) => {
    //             rename(sourcePath, destinationPath, (err) => {
    //                 if (err) reject(err);
    //                 else resolve();
    //             });
    //         });
    //     } catch (error) {
    //         console.error('Error moving file:', error);
    //         throw error;
    //     }
    // }
      
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
