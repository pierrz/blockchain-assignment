terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.0"
    }
  }
}

provider "scaleway" {
  access_key = var.scaleway_access_key
  secret_key = var.scaleway_secret_key
  project_id = var.scaleway_project_id
  zone       = var.scaleway_zone
}

locals {
  clickhouse_version  = "24.10.1"
  database_name       = var.clickhouse_db
  table_name          = "transactions"
  data_directory      = "/var/lib/clickhouse"
}

# Create instance
resource "scaleway_instance_ip" "public_ip" {}

resource "scaleway_instance_server" "main" {
  type  = var.scaleway_instance_type
  image = "ubuntu_jammy"
  ip_id = scaleway_instance_ip.public_ip.id

  root_volume {
    size_in_gb = 50
  }

  user_data = {
    cloud-init = <<-EOF
      #cloud-config
      users:
        - name: ${var.scaleway_server_user}
          sudo: ['ALL=(ALL) NOPASSWD:ALL']
          groups: sudo
          shell: /bin/bash
          ssh_authorized_keys:
            - ${file("~/.ssh/id_rsa.pub")}
      
      package_update: true
      package_upgrade: true
      
      packages:
        - apt-transport-https
        - ca-certificates
        - curl
        - gnupg
        - nginx
        - git
    EOF
  }
}

# Create DNS records
resource "scaleway_domain_record" "main" {
  dns_zone = var.bctk_domain
  name     = "@"
  type     = "A"
  data     = scaleway_instance_ip.public_ip.address
  ttl      = 300
}

resource "scaleway_domain_record" "www" {
  dns_zone = var.bctk_domain
  name     = "www"
  type     = "A"
  data     = scaleway_instance_ip.public_ip.address
  ttl      = 300
}

# Install and configure services
resource "null_resource" "setup_services" {
  depends_on = [scaleway_instance_server.main]

  connection {
    type        = "ssh"
    user        = var.scaleway_server_user
    host        = scaleway_instance_ip.public_ip.address
    private_key = file("~/.ssh/id_rsa")
  }

  provisioner "remote-exec" {
    inline = [
      # Install ClickHouse
      "curl -fsSL 'https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key' | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse-keyring.gpg",
      "echo \"deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main\" | sudo tee /etc/apt/sources.list.d/clickhouse.list",
      "sudo apt-get update",
      "sudo apt-get install -y clickhouse-server=${local.clickhouse_version} clickhouse-client=${local.clickhouse_version} clickhouse-keeper=${local.clickhouse_version}",

      # Configure ClickHouse
      "sudo mkdir -p ${local.data_directory}",
      "sudo chown -R clickhouse:clickhouse ${local.data_directory}",

      # Clone and setup application
      "sudo mkdir -p /opt/app",
      "sudo chown -R ${var.scaleway_server_user}:${var.scaleway_server_user} /opt/app",
      "cd /opt/app",
      "git clone https://${var.github_token}@github.com/${var.github_repo_name}.git .",
      "sudo cp /opt/app/terraform/bctk.conf /etc/nginx/sites-available",
      "sudo ln -s /etc/nginx/sites-available/bctk.conf /etc/nginx/sites-enabled/bctk.conf",
      
      # Setup SSL with Certbot
      "sudo snap install --classic certbot",
      "sudo ln -s /snap/bin/certbot /usr/bin/certbot",
      "sudo certbot --nginx -d ${var.bctk_domain} --non-interactive --agree-tos --email admin@${var.bctk_domain}",

      # Start services
      "sudo systemctl start clickhouse-server",
      "sudo systemctl enable clickhouse-server",
      "sudo systemctl start clickhouse-keeper",
      "sudo systemctl enable clickhouse-keeper",
      "sudo systemctl start nginx",
      "sudo systemctl enable nginx"
    ]
  }
}

output "instance_ip" {
  value = scaleway_instance_ip.public_ip.address
}

output "clickhouse_connection" {
  value = {
    host      = scaleway_instance_ip.public_ip.address
    http_port = 8123
    tcp_port  = 9000
    database  = local.database_name
  }
}
