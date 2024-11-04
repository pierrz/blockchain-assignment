import { startAPI } from './api/endpoints.js';
import { startRealtime } from './realtime/monitorAndLoad.js';
import { importTransactions } from './import/batchTransactions.js';
import { START_API, START_IMPORT, START_REALTIME } from './config.js';

async function main() {

    if (START_IMPORT) {
        console.log('--> IMPORT');
        await importTransactions();
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