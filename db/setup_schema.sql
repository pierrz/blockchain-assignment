-- Create database
CREATE DATABASE IF NOT EXISTS blockchain;

-- Main transactions table
CREATE TABLE IF NOT EXISTS blockchain.transactions (
    timestamp DateTime,
    status Bool,
    block_number UInt64,
    tx_index UInt32,
    from_address String,
    to_address String,
    value Decimal256(18),
    gas_limit UInt64,
    gas_used UInt64,
    gas_price Decimal128(18)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (block_number, tx_index)
SETTINGS index_granularity = 8192;

-- Daily transaction statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS blockchain.daily_stats
ENGINE = SummaryState
AS SELECT
    toDate(timestamp) as date,
    count() as tx_count,
    sum(value) as total_value,
    avg(gas_price) as avg_gas_price,
    sum(gas_used) as total_gas_used
FROM blockchain.transactions
GROUP BY date;

-- Address activity statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS blockchain.address_stats
ENGINE = SummaryState
AS SELECT
    from_address as address,
    count() as tx_count,
    sum(value) as total_sent,
    avg(gas_price) as avg_gas_price,
    sum(gas_used * gas_price) as total_gas_cost
FROM blockchain.transactions
GROUP BY from_address;

-- Optimize table settings for bulk loading
ALTER TABLE blockchain.transactions SETTINGS
    max_insert_threads = 8,
    max_insert_block_size = 1048576,
    min_insert_block_size_rows = 1048576,
    min_insert_block_size_bytes = 268435456;