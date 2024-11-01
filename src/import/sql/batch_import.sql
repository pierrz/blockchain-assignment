INSERT INTO transactions
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
FROM file('__INPUT_FILE__', 'LineAsString', 'gzip')
SETTINGS input_format_allow_errors_num = __ERROR_TOLERANCE__;
