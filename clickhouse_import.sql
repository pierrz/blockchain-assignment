-- Method 1: Direct import using file function and GZIP
INSERT INTO blockchain.transactions
SELECT
    parseDateTimeBestEffort(JSONExtractString(_raw, 'timestamp')) as timestamp,
    JSONExtractString(_raw, 'status') = 'true' as status,
    toUInt64(JSONExtractString(_raw, 'block_number')) as block_number,
    toUInt32(JSONExtractString(_raw, 'tx_index')) as tx_index,
    JSONExtractString(_raw, 'from') as from_address,
    JSONExtractString(_raw, 'to') as to_address,
    toDecimal256(JSONExtractString(_raw, 'value'), 18) as value,
    toUInt64(JSONExtractString(_raw, 'gas_limit')) as gas_limit,
    toUInt64(JSONExtractString(_raw, 'gas_used')) as gas_used,
    toDecimal128(JSONExtractString(_raw, 'gas_price'), 18) as gas_price
FROM file('data/43114_txs.csv.tar.gz', 'LineAsString', 'gzip')
SETTINGS input_format_allow_errors_num = 10;

-- Alternative Method: Using external table
CREATE TABLE temp_transactions
(
    _raw String
)
ENGINE = File(CSVWithNames, 'gzip');

-- Load data into temporary table
INSERT INTO temp_transactions
FROM INFILE 'data/43114_txs.csv.tar.gz'
FORMAT CSVWithNames;

-- Transform and insert into main table
INSERT INTO blockchain.transactions
SELECT
    parseDateTimeBestEffort(JSONExtractString(_raw, 'timestamp')) as timestamp,
    JSONExtractString(_raw, 'status') = 'true' as status,
    toUInt64(JSONExtractString(_raw, 'block_number')) as block_number,
    toUInt32(JSONExtractString(_raw, 'tx_index')) as tx_index,
    JSONExtractString(_raw, 'from') as from_address,
    JSONExtractString(_raw, 'to') as to_address,
    toDecimal256(JSONExtractString(_raw, 'value'), 18) as value,
    toUInt64(JSONExtractString(_raw, 'gas_limit')) as gas_limit,
    toUInt64(JSONExtractString(_raw, 'gas_used')) as gas_used,
    toDecimal128(JSONExtractString(_raw, 'gas_price'), 18) as gas_price
FROM temp_transactions;

-- Clean up
DROP TABLE temp_transactions;
