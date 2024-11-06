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
  name = var.scaleway_ssh_pub_key_name
}

locals {
  clickhouse_version = "24.10.1"
  database_name      = var.clickhouse_db
  table_name         = "transactions"
  data_directory     = "/var/lib/clickhouse"
  domain_parts       = split(".", var.bctk_domain)
  sub_domain         = local.domain_parts[0]
  root_domain        = "${local.domain_parts[1]}.${local.domain_parts[2]}"
}

# Create instance
resource "scaleway_instance_ip" "public_ipv4" {
  type = "routed_ipv4"
}
resource "scaleway_instance_ip" "public_ipv6" {
  type = "routed_ipv6"
}

resource "scaleway_instance_server" "main" {
  type = var.scaleway_instance_type
  # image = "ubuntu_noble"    # ubuntu 24.04 LTS
  image = "ubuntu_jammy" # ubuntu 22.04 LTS
  ip_ids = [
    scaleway_instance_ip.public_ipv4.id,
    scaleway_instance_ip.public_ipv6.id
  ]

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
      - ufw

      snap:
        commands:
          - snap wait system seed.loaded
          - snap install certbot --classic
          - snap install aws-cli --classic
    EOF
  }
}

resource "null_resource" "delete_dns" {
  depends_on = [scaleway_instance_server.main]

  connection {
    type        = "ssh"
    user        = var.scaleway_server_user
    host        = scaleway_instance_ip.public_ipv4.address
    private_key = var.scaleway_ssh_private_key
  }

  provisioner "remote-exec" {
    inline = [

      # Install Scaleway CLI
      "\necho 'Installing Scaleway CLI ...'",
      "curl -s https://raw.githubusercontent.com/scaleway/scaleway-cli/master/scripts/get.sh | sh",
      "mkdir -p ~/.config/scw",
      "tee ~/.config/scw/config.yaml << EOF",
      "access_key: ${var.scaleway_access_key}",
      "secret_key: ${var.scaleway_secret_key}",
      "default_organization_id: ${var.scaleway_organization_id}",
      "default_project_id: ${var.scaleway_project_id}",
      "default_zone: ${var.scaleway_zone}",
      "default_region: ${substr(var.scaleway_zone, 0, 6)}",
      "api_url: https://api.scaleway.com",
      "EOF",

      # Delete previous DNS records
      "\necho 'Deleting previous DNS records ...'",
      "scw dns record delete ${local.root_domain} name=${local.sub_domain} type=A",
      "scw dns record delete ${local.root_domain} name=${local.sub_domain} type=AAAA"
    ]
  }
}

# Create DNS records
resource "scaleway_domain_record" "ipv4" {
  dns_zone = local.root_domain
  name     = local.sub_domain
  type     = "A"
  data     = scaleway_instance_ip.public_ipv4.address
  ttl      = 3600
}
resource "scaleway_domain_record" "ipv6" {
  dns_zone = local.root_domain
  name     = local.sub_domain
  type     = "AAAA"
  data     = scaleway_instance_ip.public_ipv6.address
  ttl      = 3600
}

# Install and configure services
resource "null_resource" "setup_services" {
  depends_on = [scaleway_instance_server.main]

  connection {
    type        = "ssh"
    user        = var.scaleway_server_user
    host        = scaleway_instance_ip.public_ipv4.address
    private_key = var.scaleway_ssh_private_key
  }

  provisioner "remote-exec" {
    inline = [

      # # Install Scaleway CLI
      # "\necho 'Installing Scaleway CLI ...'",
      # "curl -s https://raw.githubusercontent.com/scaleway/scaleway-cli/master/scripts/get.sh | sh",
      # "mkdir -p ~/.config/scw",
      # "tee ~/.config/scw/config.yaml << EOF",
      # "access_key: ${var.scaleway_access_key}",
      # "secret_key: ${var.scaleway_secret_key}",
      # "default_organization_id: ${var.scaleway_organization_id}",
      # "default_project_id: ${var.scaleway_project_id}",
      # "default_zone: ${var.scaleway_zone}",
      # "default_region: ${substr(var.scaleway_zone, 0, 6)}",
      # "api_url: https://api.scaleway.com",
      # "EOF",

      # # Delete previous DNS records
      # "\necho 'Deleting previous DNS records ...'",
      # "scw dns record delete ${local.root_domain} name=${local.sub_domain} type=A",
      # "scw dns record delete ${local.root_domain} name=${local.sub_domain} type=AAAA",

      # Setup AWS credentials using heredoc
      "\necho 'Setting up AWS credentials...'",
      "mkdir -p ~/.aws",
      "tee ~/.aws/credentials << EOF",
      "[default]",
      "aws_access_key_id = ${var.scaleway_access_key}",
      "aws_secret_access_key = ${var.scaleway_secret_key}",
      "EOF",
      "\necho '${var.scaleway_awscli_config}' >> ~/.aws/config",

      # Import data
      "\necho 'Importing data from bucket ...'",
      "sudo mkdir -p /srv/data/source",
      "sudo chown -R ${var.scaleway_server_user}:${var.scaleway_server_user} /srv/data",
      "aws s3 ls",
      "aws s3api get-object --bucket ${var.data_bucket} --key ${var.data_source} /srv/data/source/$(basename '${var.data_source}')",

      # Install Node.js from NodeSource
      "\necho 'Installing Node.js ...'",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt-get install -y nodejs",
      "node --version",
      "npm --version",

      # Install ClickHouse
      "\necho 'Installing ClickHouse ...'",
      "curl -fsSL https://packages.clickhouse.com/deb/clickhouse.list | sudo tee /etc/apt/sources.list.d/clickhouse.list",
      "curl -fsSL https://packages.clickhouse.com/deb/clickhouse-keyring.gpg | sudo tee /etc/apt/trusted.gpg.d/clickhouse-keyring.gpg > /dev/null",
      "sudo apt-get update",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server clickhouse-client clickhouse-keeper",

      # # Configure ClickHouse
      # "sudo mkdir -p ${local.data_directory}",
      # "sudo chown -R clickhouse:clickhouse ${local.data_directory}",

      # Clone and setup application
      "\necho 'Installing Typescript components ...'",
      "sudo mkdir -p /opt/app",
      "sudo chown -R ${var.scaleway_server_user}:${var.scaleway_server_user} /opt/app",
      # "git clone https://${var.github_token}@github.com/${var.github_repo_name}.git .",
      "git clone https://${var.github_token}@github.com/${var.github_repo_name}.git \\n",
      "   --branch ${var.github_repo_branch} \\n",
      "   --single-branch git@github.com:${var.github_repo_name}.git /opt/app",
      "npm install --no-package-lock --no-save /opt/app/src",
      "ln -s /opt/app/config /opt/app/dist/config",

      # Setup UFW
      "\necho 'Configuring UFW ...'",
      "sudo ufw --force reset",
      "sudo ufw default deny incoming",
      "sudo ufw default allow outgoing",
      "sudo ufw allow 'OpenSSH'",
      "sudo ufw allow 'Nginx Full'",
      "sudo ufw --force enable",
      "sudo systemctl enable ufw",

      # Setup Nginx
      "\necho 'Setting up Nginx...'",
      "sudo cp /opt/app/terraform/bctk.conf /etc/nginx/sites-available/",
      "sudo ln -sf /etc/nginx/sites-available/bctk.conf /etc/nginx/sites-enabled/bctk.conf",
      "sudo rm -f /etc/nginx/sites-enabled/default",
      "sudo nginx -t",

      # Setup SSL with Certbot
      "\necho 'Configuring SSL ...'",
      "sudo ln -sf /snap/bin/certbot /usr/bin/certbot",
      "sudo certbot --nginx -d ${var.bctk_domain} --non-interactive --agree-tos --email ${local.sub_domain}@${local.root_domain}",
      "sudo nginx -t",

      # Create .env
      "\necho 'Creating .env file ...'",
      "tee /opt/app/.env << EOF",
      "CLICKHOUSE_IP=${var.clickhouse_ip}",
      "CLICKHOUSE_PORT=${var.clickhouse_port}",
      "CLICKHOUSE_DB=${var.clickhouse_db}",
      "CLICKHOUSE_USER=${var.clickhouse_user}",
      "CLICKHOUSE_PASSWORD=${var.clickhouse_password}",
      "AVALANCHE_RPC_URL=${var.avalanche_rpc_url}",
      # "echo 'NODE_ENV=production' >> .env",
      "EOF",

      # Create service for Typescript components
      "\necho 'Creating blockchain service...'",
      "sudo tee /etc/systemd/system/blockchain-app.service << EOF",
      "[Unit]",
      "Description=Blockchain Application",
      "After=network.target clickhouse-server.service",

      "[Service]",
      "Type=simple",
      "User=${var.scaleway_server_user}",
      "WorkingDirectory=/opt/app",
      "Environment=NODE_ENV=production",
      "ExecStart=/usr/bin/npm start",
      "Restart=always",
      "RestartSec=10",

      "[Install]",
      "WantedBy=multi-user.target",
      "EOF",

      # Reload systemd, enable and start the service
      "\necho 'Starting services ...'",
      "sudo systemctl daemon-reload",
      "sudo systemctl start clickhouse-server",
      "sudo systemctl enable clickhouse-server",
      "sudo systemctl start clickhouse-keeper",
      "sudo systemctl enable clickhouse-keeper",
      "sudo systemctl restart nginx",
      "sudo systemctl enable nginx",
      "sudo systemctl enable blockchain-app",
      "sudo systemctl start blockchain-app",

      "find /tmp -name 'terraform_*.sh' -exec cp {} /opt/app/terraform_script.sh \\;",
      "\necho 'Provisioning completed at: $(date)'"
    ]
  }
}

output "instance_ip" {
  value = scaleway_instance_ip.public_ipv6.address
}

output "clickhouse_connection" {
  value = {
    host      = scaleway_instance_ip.public_ipv6.address
    http_port = 8123
    tcp_port  = 9000
    database  = local.database_name
  }
}
