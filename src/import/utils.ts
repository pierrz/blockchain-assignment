import { rename, mkdir } from 'fs';
import { join, basename } from 'path';

/**
 * Moves a file from source path to a destination directory.
 * Creates the destination directory if it doesn't exist.
 * 
 * @param sourcePath - The full path of the file to move
 * @param destinationDir - The directory to move the file to
 * @returns Promise that resolves when the file has been moved
 */
export async function moveFile(sourcePath: string, destinationDir: string): Promise<void> {
    const destinationPath = join(destinationDir, basename(sourcePath));
    try {
        await new Promise<void>((resolve, reject) => {
            mkdir(destinationDir, { recursive: true }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        await new Promise<void>((resolve, reject) => {
            rename(sourcePath, destinationPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    } catch (error) {
        console.error('Error moving file:', error);
        throw error;
    }
}
