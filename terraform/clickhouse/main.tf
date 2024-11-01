terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

locals {
  clickhouse_version = "23.8"
  database_name     = "blockchain"
  data_directory    = "/var/lib/clickhouse"
}

resource "null_resource" "install_clickhouse" {
  provisioner "local-exec" {
    command = <<-EOT
      #!/bin/bash
      apt-get install -y apt-transport-https ca-certificates dirmngr
      apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 8919F6BD2B48D754
      echo "deb https://packages.clickhouse.com/deb stable main" | tee /etc/apt/sources.list.d/clickhouse.list
      apt-get update
      DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server=${local.clickhouse_version} clickhouse-client=${local.clickhouse_version}
      mkdir -p ${local.data_directory}
      chown -R clickhouse:clickhouse ${local.data_directory}
      systemctl start clickhouse-server
      systemctl enable clickhouse-server
    EOT
  }
}

resource "null_resource" "configure_clickhouse" {
  depends_on = [null_resource.install_clickhouse]

  provisioner "local-exec" {
    command = <<-EOT
      clickhouse-client -q "
        CREATE DATABASE IF NOT EXISTS ${local.database_name};
        
        CREATE TABLE IF NOT EXISTS ${local.database_name}.transactions (
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

        -- Create materialized view for transaction analytics
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${local.database_name}.tx_analytics
        ENGINE = SummaryState
        AS SELECT
          toDate(timestamp) as date,
          count() as tx_count,
          sum(value) as total_value,
          avg(gas_price) as avg_gas_price,
          sum(gas_used) as total_gas_used
        FROM ${local.database_name}.transactions
        GROUP BY date;

        -- Create materialized view for address analytics
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${local.database_name}.address_activity
        ENGINE = SummaryState
        AS SELECT
          from_address as address,
          count() as tx_count,
          sum(value) as total_sent,
          avg(gas_price) as avg_gas_price,
          sum(gas_used * gas_price) as total_gas_cost
        FROM ${local.database_name}.transactions
        GROUP BY from_address;
      "
    EOT
  }
}

# Data import configuration
resource "null_resource" "import_data" {
  depends_on = [null_resource.configure_clickhouse]

  provisioner "local-exec" {
    command = <<-EOT
      clickhouse-client -q "
        INSERT INTO ${local.database_name}.transactions
        FROM INFILE '/data/43114_txs.csv'
        FORMAT CSV;
      "
    EOT
  }
}

output "clickhouse_connection" {
  value = {
    host      = "localhost"
    http_port = 8123
    tcp_port  = 9000
    database  = local.database_name
  }
}
