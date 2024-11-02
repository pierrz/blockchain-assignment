import { createReadStream } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { createGunzip } from 'zlib';
import { parse } from 'csv-parse';
import { pipeline } from 'stream/promises';
// import type { Transform } from 'stream';
import { clickhouse } from '../dbClient/clickhouseClient.js';
import { Transform } from 'stream';


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
                    cast: true,
                }),
                new Transform({
                    objectMode: true,
                    async transform(record: CSVRecord, encoding, callback) {
                        try {

                            const csvString = `
                                ${record.timestamp},
                                ${record.status},
                                ${record.block_number},
                                ${record.tx_index},
                                ${record.from},
                                ${record.to},
                                ${record.value},
                                ${record.gas_limit},
                                ${record.gas_used},
                                ${record.gas_price}
                                `;
                            if (csvString.length === 0) {
                                // Skip empty lines
                                return callback();
                              }

                            const transaction: Transaction = {
                                timestamp: record.timestamp,
                                status: record.status === 'true',
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
                            callback(error as Error);  // Cast `error` to `Error` type
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
        const dataDir = "/srv/data";
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
                    }

                } catch (error) {
                    console.error(`Failed to process file ${file}:`, error);
                    continue;
                }
            }

            console.log(`Import completed successfully. Total transactions processed: ${totalProcessed}`);
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


// interface Transaction {
//     timestamp: string;
//     status: boolean;
//     block_number: bigint;
//     tx_index: number;
//     from_address: string;
//     to_address: string;
//     value: string;
//     gas_limit: bigint;
//     gas_used: bigint;
//     gas_price: string;
// }

// interface CSVRecord {
//     timestamp: string;
//     status: string;
//     block_number: string;
//     tx_index: string;
//     from: string;
//     to: string;
//     value: string;
//     gas_limit: string;
//     gas_used: string;
//     gas_price: string;
// }

// export async function startImport() {

//     // const dataDir = process.env.DATA_DIR;
//     const dataDir = "/srv/data"

//     async function processFile(filePath: string, writeStream: any): Promise<number> {
//         // Batch size for inserts
//         const BATCH_SIZE = 10000;
//         let batch: Transaction[] = [];
//         let fileProcessed = 0;

//         try {
//             await pipeline(
//                 createReadStream(filePath),
//                 createGunzip(),
//                 parse({
//                     columns: true,
//                     skip_empty_lines: true,
//                     cast: true,
//                 }),
//                 async function* (source: AsyncIterable<CSVRecord>) {
//                     for await (const record of source) {
//                         const transaction: Transaction = {
//                             timestamp: record.timestamp,
//                             status: record.status === 'true',
//                             block_number: BigInt(record.block_number),
//                             tx_index: parseInt(record.tx_index, 10),
//                             from_address: record.from,
//                             to_address: record.to,
//                             value: record.value,
//                             gas_limit: BigInt(record.gas_limit),
//                             gas_used: BigInt(record.gas_used),
//                             gas_price: record.gas_price,
//                         };

//                         batch.push(transaction);
                        
//                         if (batch.length >= BATCH_SIZE) {
//                             await writeBatch(batch, writeStream);
//                             fileProcessed += batch.length;
//                             console.log(`Processed ${fileProcessed} transactions from ${filePath}`);
//                             batch = [];
//                         }
                        
//                         yield transaction;
//                     }

//                     if (batch.length > 0) {
//                         await writeBatch(batch, writeStream);
//                         fileProcessed += batch.length;
//                         console.log(`Processed ${fileProcessed} transactions from ${filePath}`);
//                     }
//                 } as Transform,
//             );

//             return fileProcessed;
//         } catch (error) {
//             console.error(`Error processing file ${filePath}:`, error);
//             throw error;
//         }
//     }

//     async function importTransactions(): Promise<void> {

//         let totalProcessed = 0;

//         try {
//             // Get list of .tar.gz files
//             const files = await readdir(dataDir);
//             const tarGzFiles = files.filter((file: string) => file.endsWith('.tar.gz'));

//             if (tarGzFiles.length === 0) {
//                 console.log('No .tar.gz files found in data directory');
//                 return;
//             }

//             // Create write stream to ClickHouse
//             const writeStream = clickhouse.insert('INSERT INTO blockchain.transactions').stream();

//             // Process each file
//             for (const file of tarGzFiles) {
//                 const filePath = join(dataDir, file);
//                 console.log(`Processing file: ${file}`);
                
//                 try {
//                     const fileProcessed = await processFile(filePath, writeStream);
//                     totalProcessed += fileProcessed;
//                     console.log(`Completed processing ${file}. Total transactions processed: ${totalProcessed}`);
//                 } catch (error: unknown) {
//                     console.error(`Failed to process file ${file}:`, error);
//                     // Continue with next file
//                     continue;
//                 }
//             }

//             writeStream.end();
//             console.log(`Import completed successfully. Total transactions processed: ${totalProcessed}`);

//         } catch (error: unknown) {
//             console.error('Error during import:', error);
//             throw error;
//         }
//     }

//     async function writeBatch(batch: Transaction[], writeStream: any): Promise<boolean> {
//         return new Promise((resolve, reject) => {
//             try {
//                 batch.forEach(transaction => {
//                     writeStream.write(transaction);
//                 });
//                 resolve(true);
//             } catch (error: unknown) {
//                 reject(error);
//             }
//         });
//     }

//     process.on('unhandledRejection', (error: unknown) => {
//         console.error('Unhandled rejection:', error);
//         process.exit(1);
//     });

//     importTransactions().catch((error: unknown) => {
//         console.error('Failed to import transactions:', error);
//         process.exit(1);
//     });

// }
