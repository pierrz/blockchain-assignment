# ClickHouse Blockchain Data Import System

A modular system for importing and analyzing blockchain transaction data in ClickHouse.

## Directory Structure

```
import/
├── sql/
│   ├── setup_schema.sql      # Database and table setup
│   └── import_template.sql   # Import query template
├── setup.sh                 # Schema setup script
├── import_data.sh          # Data import script
└── README.md               # Documentation
```

## Setup

1. Initialize the database schema:
```bash
chmod +x setup.sh
./setup.sh
```

This creates:
- Database: `blockchain`
- Table: `transactions`
- Materialized Views:
  - `daily_stats`: Daily transaction analytics
  - `address_stats`: Per-address analytics
- Dictionary: `address_labels` (optional)

## Import Process

1. Place your .tar.gz files in `./data/`

2. Run the import:
```bash
chmod +x import_data.sh
./import_data.sh
```

## Configuration

### Database Settings (setup.sh)
```bash
CLICKHOUSE_HOST="localhost"
CLICKHOUSE_PORT="8123"
CLICKHOUSE_USER="default"
CLICKHOUSE_PASSWORD="clickhouse"
```

### Import Settings (import_data.sh)
```bash
DATA_DIR="./data"              # Input files location
LOG_DIR="./logs"               # Log files location
SQL_DIR="./sql"                # SQL templates location
ERROR_TOLERANCE=10             # Errors allowed per file
```

## Schema Details

### Transactions Table
```sql
CREATE TABLE blockchain.transactions (
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
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (block_number, tx_index)
```

### Materialized Views

1. Daily Statistics
```sql
CREATE MATERIALIZED VIEW blockchain.daily_stats
ENGINE = SummaryState
AS SELECT
    toDate(timestamp) as date,
    count() as tx_count,
    sum(value) as total_value,
    avg(gas_price) as avg_gas_price,
    sum(gas_used) as total_gas_used
FROM blockchain.transactions
GROUP BY date
```

2. Address Statistics
```sql
CREATE MATERIALIZED VIEW blockchain.address_stats
ENGINE = SummaryState
AS SELECT
    from_address as address,
    count() as tx_count,
    sum(value) as total_sent,
    avg(gas_price) as avg_gas_price,
    sum(gas_used * gas_price) as total_gas_cost
FROM blockchain.transactions
GROUP BY from_address
```

## Performance Optimizations

The schema includes optimizations for bulk loading:
- Partitioning by month
- Efficient indexing on block_number and tx_index
- Optimized insert settings
- Parallel processing support

## Monitoring

### Import Progress
- Real-time status updates
- Timestamped logs
- Success/failure tracking
- File processing status

### Log Files
Located in `./logs/` with format:
```
import_YYYYMMDD_HHMMSS.log
```

### File Organization
- `./data/`: Input files
- `./data/processed/`: Successfully imported
- `./data/failed/`: Failed imports
- `./logs/`: Import logs

## Error Handling

- Configurable error tolerance per file
- Automatic file sorting (processed/failed)
- Detailed error logging
- Transaction validation

## Example Queries

1. Daily Transaction Volume:
```sql
SELECT date, tx_count, total_value
FROM blockchain.daily_stats
ORDER BY date DESC;
```

2. Top Addresses by Activity:
```sql
SELECT address, tx_count, total_sent
FROM blockchain.address_stats
ORDER BY tx_count DESC
LIMIT 10;
```

## Maintenance

- Logs are retained indefinitely
- Processed files are preserved
- Failed imports can be retried
- Schema can be updated using setup.sh
