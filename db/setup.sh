#!/bin/bash

# Load environment variables
set -a
source .env
set +a

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Setting up ClickHouse schema..."

# Execute schema setup
clickhouse-client \
    --host "$CLICKHOUSE_HOST" \
    --port "$CLICKHOUSE_PORT" \
    --user "$CLICKHOUSE_USER" \
    --password "$CLICKHOUSE_PASSWORD" \
    --max_memory_usage "$MAX_MEMORY_USAGE" \
    --multiquery < setup_schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Schema setup completed successfully${NC}"
    echo "Created:"
    echo "- Database: $CLICKHOUSE_DB"
    echo "- Table: transactions"
    echo "- Materialized Views:"
    echo "  - daily_stats"
    echo "  - address_stats"
else
    echo -e "${RED}Error setting up schema${NC}"
    exit 1
fi

# Verify setup
echo -e "\nVerifying setup..."
clickhouse-client \
    --host "$CLICKHOUSE_HOST" \
    --port "$CLICKHOUSE_PORT" \
    --user "$CLICKHOUSE_USER" \
    --password "$CLICKHOUSE_PASSWORD" \
    --query "SHOW TABLES FROM $CLICKHOUSE_DB"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}Setup verification completed successfully${NC}"
    echo "You can now run ./import_data.sh to import your data"
else
    echo -e "\n${RED}Setup verification failed${NC}"
    exit 1
fi
