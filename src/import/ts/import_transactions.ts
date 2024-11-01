import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { parse } from 'csv-parse';
import { ClickHouse } from 'clickhouse';
import { pipeline } from 'stream/promises';
import type { Transform } from 'stream';

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

async function importTransactions(): Promise<void> {
    // Initialize ClickHouse client
    const clickhouse = new ClickHouse({
        url: 'http://localhost',
        port: 8123,
        debug: false,
        basicAuth: {
            username: 'default',
            password: 'clickhouse',
        },
        isUseGzip: true,
        format: 'JSONEachRow',
        raw: false,
    });

    // Batch size for inserts
    const BATCH_SIZE = 10000;
    let batch: Transaction[] = [];
    let totalProcessed = 0;

    // Create write stream to ClickHouse
    const writeStream = clickhouse.insert('INSERT INTO blockchain.transactions').stream();

    try {
        await pipeline(
            createReadStream('data/43114_txs.csv.tar.gz'),
            createGunzip(),
            parse({
                columns: true,
                skip_empty_lines: true,
                cast: true,
            }),
            async function* (source: AsyncIterable<CSVRecord>) {
                for await (const record of source) {
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
                        await writeBatch(batch, writeStream);
                        totalProcessed += batch.length;
                        console.log(`Processed ${totalProcessed} transactions`);
                        batch = [];
                    }
                    
                    yield transaction;
                }

                if (batch.length > 0) {
                    await writeBatch(batch, writeStream);
                    totalProcessed += batch.length;
                    console.log(`Processed ${totalProcessed} transactions`);
                }
            } as Transform,
        );

        writeStream.end();
        console.log('Import completed successfully');

    } catch (error) {
        console.error('Error during import:', error);
        writeStream.end();
        throw error;
    }
}

async function writeBatch(batch: Transaction[], writeStream: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
        try {
            batch.forEach(transaction => {
                writeStream.write(transaction);
            });
            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

importTransactions().catch((error) => {
    console.error('Failed to import transactions:', error);
    process.exit(1);
});
