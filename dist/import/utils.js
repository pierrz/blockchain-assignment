import { rename, mkdir } from 'fs';
import { readdir } from 'fs/promises';
import { join, basename } from 'path';
import { clickhouse } from '../dbClient/clickhouseClient.js';
import config from 'config';
/**
 * Moves a file from source path to a destination directory.
 * Creates the destination directory if it doesn't exist.
 *
 * @param sourcePath - The full path of the file to move
 * @param destinationDir - The directory to move the file to
 * @returns Promise that resolves when the file has been moved
 */
export async function moveFile(sourcePath, destinationDir) {
    const destinationPath = join(destinationDir, basename(sourcePath));
    try {
        await new Promise((resolve, reject) => {
            mkdir(destinationDir, { recursive: true }, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        await new Promise((resolve, reject) => {
            rename(sourcePath, destinationPath, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    catch (error) {
        console.error('Error moving file:', error);
        throw error;
    }
}
export async function importData(sourceDir, tableName, processFunction) {
    let totalProcessed = 0;
    const dataDir = config.get('directories.dataDir'), processedDir = join(dataDir, config.get('directories.processedDir')), failedDir = join(dataDir, config.get('directories.failedDir'));
    try {
        const files = await readdir(sourceDir);
        const tarGzFiles = files.filter((file) => file.endsWith('.tar.gz'));
        if (tarGzFiles.length === 0) {
            console.log('No .tar.gz files found in data directory');
            return;
        }
        for (const file of tarGzFiles) {
            const filePath = join(sourceDir, file);
            console.log(`Processing file: ${file}`);
            try {
                const processedData = await processFunction(filePath);
                if (processedData.length > 0) {
                    try {
                        await clickhouse.insert({
                            table: `blockchain.${tableName}`,
                            values: processedData,
                            format: 'JSONEachRow'
                        });
                        console.log(`Successfully inserted ${processedData.length} ${tableName}`);
                        totalProcessed += processedData.length;
                        console.log(`Inserted ${processedData.length} ${tableName} from ${file}`);
                        try {
                            await moveFile(filePath, processedDir);
                            console.log("File moved to the 'processed' directory.");
                        }
                        catch (moveError) {
                            console.error('Error moving file to processed directory:', moveError);
                        }
                    }
                    catch (error) {
                        console.error('Error inserting ${tableName}:', error);
                        try {
                            await moveFile(filePath, failedDir);
                            console.log("File moved to the 'failed' directory due to insertion error.");
                        }
                        catch (moveError) {
                            console.error('Error moving file to failed directory:', moveError);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Failed to process file ${file}:`, error);
                try {
                    await moveFile(filePath, failedDir);
                    console.log("File moved to the 'failed' directory due to processing error.");
                }
                catch (moveError) {
                    console.error('Error moving file to failed directory:', moveError);
                }
                continue;
            }
        }
        if (totalProcessed === 0) {
            console.error(`Import potentially failed: 0 ${tableName} processed`);
        }
        else {
            console.log(`Import completed successfully. Total ${tableName} processed: ${totalProcessed}`);
        }
    }
    catch (error) {
        console.error('Error during import:', error);
        throw error;
    }
}
