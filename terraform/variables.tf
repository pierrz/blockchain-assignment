# SCALEWAY
variable "scaleway_access_key" {
  description = "Scaleway Access Key"
  type        = string
}
variable "scaleway_secret_key" {
  description = "Scaleway Secret Key"
  type        = string
  sensitive   = true
}
variable "scaleway_project_id" {
  description = "Scaleway Project ID"
  type        = string
}
variable "scaleway_zone" {
  description = "Scaleway zone"
  type        = string
}
variable "scaleway_instance_type" {
  description = "Scaleway Instance Type"
  type        = string
  default     = "DEV1-M" # 2 vCPUs, 4GB RAM
}
variable "scaleway_instance_size" {
  description = "Scaleway Instance storage size in GB"
  type        = number
  default     = 40
}
variable "scaleway_server_user" {
  description = "Username for deployment"
  type        = string
}
variable "scaleway_ssh_pub_key_name" {
  description = "SSH pub key name"
  type        = string
}
variable "scaleway_ssh_private_key" {
  description = "Content of the private SSH key"
  type        = string
}

# DATA
variable "scaleway_awscli_config" {
  description = "AWS CLI configuration"
  type        = string
}
variable "data_bucket" {
  description = "Scaleway bucket where the data is stored"
  type        = string
}
variable "data_source" {
  description = "Data filepath in bucket"
  type        = string
}

# INSTANCE
variable "bctk_domain" {
  description = "(Sub)Domain where to deploy the app and get a certificate for"
  type        = string
}
variable "github_token" {
  description = "GitHub PAT token"
  type        = string
}
variable "github_repo_name" {
  description = "GitHub repository"
  type        = string
}
variable "github_workspace" {
  description = "GitHub Actions workspace"
  type        = string
}

# CLICKHOUSE DB
variable "clickhouse_ip" {
  description = "ClickHouse IP address"
  type        = string
}
variable "clickhouse_port" {
  description = "ClickHouse port"
  type        = number
}
variable "clickhouse_db" {
  description = "ClickHouse database name"
  type        = string
}
variable "clickhouse_user" {
  description = "ClickHouse default user"
  type        = string
}
variable "clickhouse_password" {
  description = "ClickHouse default user password"
  type        = string
  sensitive   = true
}

# variable "data_path" {
#   description = "Path to the transactions CSV file"
#   type        = string
#   default     = "../data"
# }

variable "settings" {
  description = "ClickHouse performance and storage settings"
  type        = map(string)
  default = {
    max_memory_usage           = "10000000000" # 10GB
    max_concurrent_queries     = "100"
    parts_to_throw_insert      = "300"
    max_partition_size_to_drop = "50000000000"
    max_table_size_to_drop     = "0" # Disable DROP TABLE by default
  }
}

variable "retention" {
  description = "Data retention settings"
  type        = map(number)
  default = {
    days_to_keep         = 90
    cleanup_interval_sec = 60
  }
}

variable "replication" {
  description = "Replication settings"
  type        = map(bool)
  default = {
    enabled   = false
    is_leader = true
  }
}

# TYPESCRIPT APP
variable "avalanche_rpc_url" {
  description = "URL of the Avalanche public blockchain"
  type        = string
}
