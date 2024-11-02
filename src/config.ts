import { join } from 'path';

const dataDir = '/srv/data',
    processedDir = join(dataDir, 'processed'),
    failedDir = join(dataDir, 'failed'),
    START_API = process.env.START_API !== 'false',
    START_IMPORT = process.env.START_IMPORT !== 'false',
    START_REALTIME = process.env.START_REALTIME !== 'false';

export {
    dataDir,
    processedDir,
    failedDir,
    START_API,
    START_IMPORT,
    START_REALTIME,
};
