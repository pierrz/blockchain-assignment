# ClickHouse Terraform Configuration

This Terraform module sets up a ClickHouse instance optimized for blockchain transaction data.

## Overview

The configuration provides:
- Automated ClickHouse installation
- Optimized schema for blockchain transactions
- Real-time analytics via materialized views
- Configurable performance settings

## Schema

### Main Table: transactions
```sql
CREATE TABLE transactions (
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
1. tx_analytics - Daily statistics
2. address_activity - Per-address metrics

## Quick Start

1. Initialize:
```bash
terraform init
```

2. Configure (optional):
```bash
# terraform.tfvars
clickhouse_user = "custom_user"
clickhouse_password = "secure_password"
```

3. Deploy:
```bash
terraform apply
```

## Variables

| Name | Description | Default |
|------|-------------|---------|
| clickhouse_user | Database user | "default" |
| clickhouse_password | User password | "clickhouse" |
| data_path | CSV file location | "/data/43114_txs.csv" |
| settings | Performance configs | See variables.tf |
| retention | Data retention | 90 days |
| replication | Replication settings | disabled |

## Security

- Change default password
- Configure access controls
- Keep system updated
- Monitor logs

## Maintenance

Backup:
```sql
BACKUP TABLE blockchain.transactions 
TO '/backup/transactions'
```

Monitor:
```sql
SELECT * FROM system.metrics;
```

Cleanup:
```bash
terraform destroy
