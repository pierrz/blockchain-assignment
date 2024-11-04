import { startAPI } from './api/endpoints.js';
import { startRealtime } from './realtime/monitorAndLoad.js';
import { importTransactions } from './import/batchTransactions.js';
import config from 'config';

const apiMode = config.get('modes.api'),
    importMode = config.get('modes.import'),
    realtimeMode = config.get('modes.realtime');

async function main() {
    if (importMode) {
        console.log('--> IMPORT');
        await importTransactions();
    }
    if (realtimeMode) {
        console.log('--> REALTIME');
        await startRealtime();
    }
    if (apiMode) {
        console.log('--> API');
        await startAPI();
    }
}

main().catch(console.error);
