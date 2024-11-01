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
      apt-get update
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
      chmod +x ./setup.sh
      ./setup.sh
    EOT
  }
}

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
