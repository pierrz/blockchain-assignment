#!/bin/bash

# Load environment variables
if [ $(echo $DOCKER_MODE | tr -d '\"') = "False" ]; then \
    set -a
    source .env
    set +a
fi

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Log file with timestamp
LOG_FILE="$LOG_DIR/import_$(date +%Y%m%d_%H%M%S).log"

log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" | tee -a "$LOG_FILE"
}

# Read SQL template once
SQL_TEMPLATE=$(cat "./batch_import.sql")
if [ $? -ne 0 ]; then
    log "Error: Failed to read SQL template"
    exit 1
fi

import_file() {
    local file="$1"
    local filename=$(basename "$file")
    
    log "Starting import of $filename"
    
    # Replace variables in SQL template
    local import_query="${SQL_TEMPLATE//__INPUT_FILE__/$file}"
    import_query="${import_query//__ERROR_TOLERANCE__/$ERROR_TOLERANCE}"
    
    # Execute ClickHouse query
    echo "$import_query" | clickhouse-client \
        --host "$CLICKHOUSE_HOST" \
        --port "$CLICKHOUSE_PORT" \
        --database "$CLICKHOUSE_DB" \
        --user "$CLICKHOUSE_USER" \
        --password "$CLICKHOUSE_PASSWORD" \
        --max_insert_threads "$MAX_INSERT_THREADS" \
        --max_memory_usage "$MAX_MEMORY_USAGE" \
        --max_insert_block_size "$MAX_INSERT_BLOCK_SIZE" \
        --multiquery
    
    local status=$?
    
    if [ $status -eq 0 ]; then
        log "Successfully imported $filename"
        mkdir -p "$DATA_DIR/processed"
        mv "$file" "$DATA_DIR/processed/"
    else
        log "Error importing $filename (exit code: $status)"
        mkdir -p "$DATA_DIR/failed"
        mv "$file" "$DATA_DIR/failed/"
    fi
}

# Main execution
log "Starting import process"
log "Scanning $DATA_DIR for .tar.gz files"

# Count total files
total_files=$(find "$DATA_DIR" -maxdepth 1 -name "*.tar.gz" | wc -l)
current_file=0

# Process each .tar.gz file
find "$DATA_DIR" -maxdepth 1 -name "*.tar.gz" | while read -r file; do
    ((current_file++))
    log "Processing file $current_file of $total_files: $(basename "$file")"
    import_file "$file"
done

log "Import process completed"

# Print summary
successful=$(find "$DATA_DIR/processed" -name "*.tar.gz" 2>/dev/null | wc -l)
failed=$(find "$DATA_DIR/failed" -name "*.tar.gz" 2>/dev/null | wc -l)

log "Summary:"
log "- Total files processed: $total_files"
log "- Successfully imported: $successful"
log "- Failed imports: $failed"
log "- Log file: $LOG_FILE"
