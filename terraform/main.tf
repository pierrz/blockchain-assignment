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
  table_name     = "transactions"
  data_directory    = "/var/lib/clickhouse"
}

resource "null_resource" "install_clickhouse" {
  provisioner "local-exec" {
    command = <<-EOT
      #!/bin/bash

      # Install
      sudo apt-get install -y apt-transport-https ca-certificates curl gnupg
      curl -fsSL 'https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key' | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse-keyring.gpg
      echo "deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main" | sudo tee \
      /etc/apt/sources.list.d/clickhouse.list
      sudo apt-get update
      # DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server=${local.clickhouse_version} clickhouse-client=${local.clickhouse_version}
      sudo apt-get install -y clickhouse-server=${local.clickhouse_version} clickhouse-client=${local.clickhouse_version} clickhouse-keeper=${local.clickhouse_version}
      mkdir -p ${local.data_directory}
      chown -R clickhouse:clickhouse ${local.data_directory}

      # Configuration
      cp db/startup_scripts.xml /etc/clickhouse-server/config.d/startup_scripts.xml

      # CLickHouse Server
      sudo service clickhouse-server start
      sudo service clickhouse-server enable
      # systemctl start clickhouse-server
      # systemctl enable clickhouse-server

      # CLickHouse Keeper
      sudo systemctl enable clickhouse-keeper
      sudo systemctl start clickhouse-keeper
      # sudo systemctl status clickhouse-keeper

    EOT
  }
}

# resource "null_resource" "configure_clickhouse" {
#   depends_on = [null_resource.install_clickhouse]

#   provisioner "local-exec" {
#     command = <<-EOT
#       cd db
#       chmod +x ./setup.sh
#       ./setup.sh
#     EOT
#   }
# }

# # Data import configuration
# resource "null_resource" "import_data" {
#   depends_on = [null_resource.configure_clickhouse]

#   provisioner "local-exec" {
#     command = <<-EOT
#       clickhouse-client -q "
#         INSERT INTO ${local.database_name}.${local.table_name}
#         FROM INFILE '/data/43114_txs.csv'
#         FORMAT CSV;
#       "
#     EOT
#   }
# }

output "clickhouse_connection" {
  value = {
    host      = "localhost"
    http_port = 8123
    tcp_port  = 9000
    database  = local.database_name
  }
}
