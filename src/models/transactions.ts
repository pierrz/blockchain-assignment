// All data components required to ensure consistency when parsing and loading transactions

// Transactions are loaded mostly as string data to cover for some TS limitations:
//  - maintain number (integers and decimals) length
//  - maintain to types of addresses (EVM and Avalanches)

const transactionTableName = "transactions";

const transactionCSVFields = [
  "timestamp",
  "status",
  "block_number",
  "tx_index",
  "from",
  "to",
  "value",
  "gas_limit",
  "gas_used",
  "gas_price",
];

const transactionFields = [
  "timestamp",
  "status",
  "block_number",
  "tx_index",
  "from_address",
  "to_address",
  "value",
  "gas_limit",
  "gas_used",
  "gas_price",
];

interface TransactionInterface {
  timestamp: string;
  status: boolean;
  block_number: string;
  tx_index: string;
  from_address: string;
  to_address: string;
  value: string;
  gas_limit: string;
  gas_used: string;
  gas_price: string;
}

type TransactionType = {
  timestamp: string;
  status: boolean;
  block_number: string;
  tx_index: string;
  from_address: string;
  to_address: string;
  value: string;
  gas_limit: string;
  gas_used: string;
  gas_price: string;
};

// Create an empty transaction object to use as type reference
const transactionTypeReference: TransactionType = {
  timestamp: "",
  status: false,
  block_number: "",
  tx_index: "",
  from_address: "",
  to_address: "",
  value: "",
  gas_limit: "",
  gas_used: "",
  gas_price: "",
};

export {
  transactionTableName,
  transactionFields,
  transactionCSVFields,
  TransactionInterface,
  TransactionType,
  transactionTypeReference,
};
