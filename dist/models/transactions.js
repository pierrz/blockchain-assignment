// All data components required to ensure consistency when parsing and loading transactions
// Transactions are loaded mostly as string data to cover for some TS limitations:
//  - maintain number (integers and decimals) length
//  - maintain to types of addresses (EVM and Avalanches)
const transactionTableName = 'transactions';
const transactionCSVFields = [
  'timestamp',
  'status',
  'block_number',
  'tx_index',
  'from',
  'to',
  'value',
  'gas_limit',
  'gas_used',
  'gas_price',
];
const transactionFields = [
  'timestamp',
  'status',
  'block_number',
  'tx_index',
  'from_address',
  'to_address',
  'value',
  'gas_limit',
  'gas_used',
  'gas_price',
];
// Create an empty transaction object to use as type reference
const transactionTypeReference = {
  timestamp: '',
  status: false,
  block_number: '',
  tx_index: '',
  from_address: '',
  to_address: '',
  value: '',
  gas_limit: '',
  gas_used: '',
  gas_price: '',
};
export {
  transactionTableName,
  transactionFields,
  transactionCSVFields,
  transactionTypeReference,
};
