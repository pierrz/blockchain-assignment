interface ClickhouseResponse {
    meta: Array<{ 
        name: string;
        type: string;
    }>;
    data: Array<Record<string, string>>;
    rows: number;
    statistics?: {
        elapsed: number;
        rows_read: number;
        bytes_read: number;
    };
}

// TODO: fix the typing for block_number, gas_limit and gas_used
// interface TransactionRecord {
//     timestamp: string;
//     status: boolean;
//     block_number: number;
//     tx_index: number;
//     from_address: string;
//     to_address: string;
//     value: number;
//     gas_limit: number;
//     gas_used: number;
//     gas_price: number;
// }

// interface ClickhouseListResponse {
//     meta: Array<{ 
//         name: string;
//         type: string;
//     }>;
//     data: Array<{
//         timestamp: string;
//         status: boolean;
//         block_number: number;
//         tx_index: number;
//         from_address: string;
//         to_address: string;
//         value: number;
//         gas_limit: number;
//         gas_used: number;
//         gas_price: number;}>;
//     // data: Array<TransactionRecord>;
//     rows: number;
//     statistics?: {
//         elapsed: number;
//         rows_read: number;
//         bytes_read: number;
//     };
// }

interface TransactionPaginatedResult {
    address: string;
    page: number;
    elapsed_time_in_seconds: number;
    data: Array<Record<string, any>>;
    // data: Array<TransactionRecord>;
}

interface RestartStatus {
    services: string;
    status: string;
  }

export {ClickhouseResponse, TransactionPaginatedResult, RestartStatus}
