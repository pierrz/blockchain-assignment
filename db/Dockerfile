FROM clickhouse/clickhouse-server:24.10.1

ARG IMPORT_DATA="False" \
    DOCKER_MODE="True"

COPY db/import_data.sh db/batch_import.sql /tmp/

RUN if [ $(echo $IMPORT_DATA | tr -d '\"') = "True" ]; then \
        echo "Importing data files ..."; \
        cd /tmp; \
        sh ./import_data.sh; \
    else \
        echo "No data files to import."; \
    fi
