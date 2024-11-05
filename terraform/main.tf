terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.47"
    }
  }
}

provider "scaleway" {
  access_key = var.scaleway_access_key
  secret_key = var.scaleway_secret_key
  project_id = var.scaleway_project_id
  zone       = var.scaleway_zone
}

data "scaleway_account_ssh_key" "cd_key" {
  name       = var.scaleway_ssh_pub_key_name
  project_id = var.scaleway_project_id
}

locals {
  clickhouse_version = "24.10.1"
  database_name      = var.clickhouse_db
  table_name         = "transactions"
  data_directory     = "/var/lib/clickhouse"
}

# Create instance
resource "scaleway_instance_ip" "public_ip" {}

resource "scaleway_instance_server" "main" {
  type = var.scaleway_instance_type
  # image = "ubuntu_noble"    # ubuntu 24.04 LTS
  image = "ubuntu_jammy" # ubuntu 22.04 LTS
  ip_id = scaleway_instance_ip.public_ip.id

  root_volume {
    size_in_gb = var.scaleway_instance_size
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
        - ${data.scaleway_account_ssh_key.cd_key.public_key}

      # package_update: true
      # package_upgrade: true

      packages:
      - apt-transport-https
      - ca-certificates
      - curl
      - gnupg
      - git
      - nginx
      - snapd

      snap:
        commands:
          - snap wait system seed.loaded
          - snap install --classic certbot
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
    private_key = var.scaleway_ssh_private_key
  }

  provisioner "remote-exec" {
    inline = [
      # Install Node.js from NodeSource
      "echo 'Installing Node.js ...'",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt-get install -y nodejs",
      "node --version",
      "npm --version",

      # Install ClickHouse
      "echo 'Installing ClickHouse ...'",
      "curl -fsSL https://packages.clickhouse.com/deb/clickhouse.list | sudo tee /etc/apt/sources.list.d/clickhouse.list",
      "curl -fsSL https://packages.clickhouse.com/deb/clickhouse-keyring.gpg | sudo tee /etc/apt/trusted.gpg.d/clickhouse-keyring.gpg > /dev/null",
      "sudo apt-get update",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server clickhouse-client clickhouse-keeper",

      # # Configure ClickHouse
      # "sudo mkdir -p ${local.data_directory}",
      # "sudo chown -R clickhouse:clickhouse ${local.data_directory}",

      # Clone and setup application
      "echo 'Installing Typescript components ...'",
      "sudo mkdir -p /opt/app",
      "cd /opt/app",
      "sudo chown -R ${var.scaleway_server_user}:${var.scaleway_server_user} /opt/app",
      "git clone https://${var.github_token}@github.com/${var.github_repo_name}.git .",
      "ls -la",
      "cd src",
      "npm install",
      "cd ..",
      "ln -s /opt/app/config /opt/app/dist/config",

      # Setup Nginx
      "sudo cp ./terraform/bctk.conf /etc/nginx/sites-available/",
      "sudo ln -sf /etc/nginx/sites-available/bctk.conf /etc/nginx/sites-enabled/bctk.conf",
      "sudo rm -f /etc/nginx/sites-enabled/default",
      "sudo nginx -t",

      # Setup SSL with Certbot
      "echo 'Configuring SSL ...'",
      "sudo ln -sf /snap/bin/certbot /usr/bin/certbot",
      "sudo certbot --nginx -d ${var.bctk_domain} --non-interactive --agree-tos --email admin@${var.bctk_domain}",

      # Create .env
      "echo 'Creating .env file ...'",
      "cd /opt/app",
      "echo 'CLICKHOUSE_IP=${var.clickhouse_ip}' > .env",
      "echo 'CLICKHOUSE_PORT=${var.clickhouse_port}' >> .env",
      "echo 'CLICKHOUSE_DB=${var.clickhouse_db}' >> .env",
      "echo 'CLICKHOUSE_USER=${var.clickhouse_user}' >> .env",
      "echo 'CLICKHOUSE_PASSWORD=${var.clickhouse_password}' >> .env",
      "echo 'AVALANCHE_RPC_URL=${var.avalanche_rpc_url}' >> .env",
      "echo 'NODE_ENV=production' >> .env",

      # Start services
      "echo 'Starting services ...'",
      "sudo systemctl start clickhouse-server",
      "sudo systemctl enable clickhouse-server",
      "sudo systemctl start clickhouse-keeper",
      "sudo systemctl enable clickhouse-keeper",
      "sudo systemctl restart nginx",
      "sudo systemctl enable nginx",

      # Start Typescript components
      "npm start"
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
