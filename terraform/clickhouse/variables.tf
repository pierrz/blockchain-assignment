variable "clickhouse_user" {
  description = "ClickHouse default user"
  type        = string
  default     = "default"
}

variable "clickhouse_password" {
  description = "ClickHouse default user password"
  type        = string
  sensitive   = true
  default     = "clickhouse"  # Change this in production
}

variable "data_path" {
  description = "Path to the transactions CSV file"
  type        = string
  default     = "/data/43114_txs.csv"
}

variable "settings" {
  description = "ClickHouse performance and storage settings"
  type        = map(string)
  default     = {
    max_memory_usage          = "10000000000"  # 10GB
    max_concurrent_queries    = "100"
    parts_to_throw_insert    = "300"
    max_partition_size_to_drop = "50000000000"
    max_table_size_to_drop    = "0"            # Disable DROP TABLE by default
  }
}

variable "retention" {
  description = "Data retention settings"
  type        = map(number)
  default     = {
    days_to_keep          = 90
    cleanup_interval_sec  = 60
  }
}

variable "replication" {
  description = "Replication settings"
  type        = map(bool)
  default     = {
    enabled = false
    is_leader = true
  }
}
