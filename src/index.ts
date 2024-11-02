import { startAPI } from './api/endpoints.js';
import { startRealtime } from './realtime/monitorAndLoad.js';
import { startImport } from './import/batchTransactions.js';

// Allow components to be started independently via environment variables
// const START_API = process.env.START_API !== 'false';
// const START_IMPORT = process.env.START_IMPORT !== 'false';
// const START_REALTIME = process.env.START_REALTIME !== 'false';
const START_API = process.env.START_API !== 'false',
    START_IMPORT = process.env.START_IMPORT !== 'false',
    START_REALTIME = process.env.START_REALTIME !== 'false';


async function main() {

    console.log('- IMPORT:', START_IMPORT);
    console.log('- REALTIME:', START_REALTIME);
    console.log('- API:', START_API);

    if (START_IMPORT) {
        console.log('--> IMPORT');
        await startImport();
    }
    if (START_REALTIME) {
        console.log('--> REALTIME');
        await startRealtime();
    }
    if (START_API) {
        console.log('--> API');
        await startAPI();
    }
}

main().catch(console.error);