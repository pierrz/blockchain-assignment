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
  # clickhouse_version = "24.10.1.2812"
  database_name  = var.clickhouse_db
  table_name     = "transactions"
  data_directory = "/var/lib/clickhouse"
  domain_parts   = split(".", var.bctk_domain)
  sub_domain     = local.domain_parts[0]
  root_domain    = "${local.domain_parts[1]}.${local.domain_parts[2]}"
  region         = substr(var.scaleway_zone, 0, 6)
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
      - unzip

      snap:
        commands:
          - snap wait system seed.loaded
          - snap install certbot --classic
          - snap install aws-cli --classic
    EOF
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

      # Setup AWS credentials 
      "echo 'Setting up AWS credentials...'",
      "mkdir -p ~/.aws",

      "tee ~/.aws/credentials << EOF",
      "[default]",
      "aws_access_key_id = ${var.scaleway_access_key}",
      "aws_secret_access_key = ${var.scaleway_secret_key}",
      "EOF",

      "tee ~/.aws/config << EOF",
      "[default]",
      "region = ${local.region}",
      "output = json",
      "services = scw-${local.region}",
      "s3 =",
      "  max_concurrent_requests = 100",
      "  max_queue_size = 1000",
      "  multipart_threshold = 50 MB",
      "  multipart_chunksize = 10 MB",
      "[services scw-${local.region}]",
      "s3 =",
      "  endpoint_url = https://s3.${local.region}.scw.cloud",
      "EOF",

      # Import data
      "echo 'Importing data from bucket ...'",
      "sudo mkdir -p /srv/data/source /srv/data/processed /srv/data/failed", # creating all data directories
      "sudo chown -R ${var.scaleway_server_user}:${var.scaleway_server_user} /srv/data",
      "aws s3api get-object --bucket ${var.data_bucket} --key ${var.data_source} /srv/data/source/$(basename '${var.data_source}')",

      # Install Node.js from NodeSource
      "echo 'Installing Node.js ...'",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt-get install -y nodejs",
      "node --version",
      "npm --version",

      # Clone and setup application
      "echo 'Clone and setup application ...'",
      "sudo mkdir -p /opt/app",
      "sudo chown -R ${var.scaleway_server_user}:${var.scaleway_server_user} /opt/app",
      "CLONE_URI='https://${var.github_token}@github.com/${var.github_repo_name}.git'",
      "CLONE_FLAGS='--branch ${var.github_repo_branch} --single-branch'",
      "git clone $CLONE_FLAGS $CLONE_URI /opt/app",
      "cd /opt/app",
      "npm install --no-package-lock --no-save",

      # Install ClickHouse
      "echo 'Installing ClickHouse ...'",
      "curl -fsSL 'https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key' | sudo gpg --dearmor -o /usr/share/keyrings/clickhouse-keyring.gpg",
      "echo 'deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main' | sudo tee /etc/apt/sources.list.d/clickhouse.list",
      "sudo apt-get update",
      "USERS_CONFIG=/opt/app/db/users.xml",
      "sed -i 's/user1/${var.clickhouse_admin_user}/g' $USERS_CONFIG",
      "sed -i 's/password1/${var.clickhouse_admin_password}/g' $USERS_CONFIG",
      "sed -i 's/user2/${var.clickhouse_app_user}/g' $USERS_CONFIG",
      "sed -i 's/password2/${var.clickhouse_app_password}/g' $USERS_CONFIG",
      "sudo mkdir -p /etc/clickhouse-server/users.d /etc/clickhouse-server/config.d",
      "sudo ln -s /opt/app/db/users.xml /etc/clickhouse-server/users.d/users.xml",
      "sudo ln -s /opt/app/db/startup_scripts.xml /etc/clickhouse-server/config.d/startup_scripts.xml",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server clickhouse-client",
      # "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y clickhouse-server=${local.clickhouse_version} clickhouse-client=${local.clickhouse_version}",

      # Setup UFW
      "echo 'Configuring UFW ...'",
      "sudo ufw --force reset",
      "sudo ufw default deny incoming",
      "sudo ufw default allow outgoing",
      "sudo ufw allow 'OpenSSH'",
      "sudo ufw allow 'Nginx Full'",
      "sudo ufw --force enable",
      "sudo systemctl enable ufw",

      # Setup Nginx
      "echo 'Setting up Nginx ...'",
      "NGINX_CONF_TEMPLATE=$(cat /opt/app/terraform/bctk.conf)",
      "sudo tee /etc/nginx/sites-available/bctk.conf << EOF",
      "server {",
      "server_name ${var.bctk_domain};",
      "$NGINX_CONF_TEMPLATE",
      "}",
      "EOF",
      "sudo ln -sf /etc/nginx/sites-available/bctk.conf /etc/nginx/sites-enabled/bctk.conf",
      "sudo rm -f /etc/nginx/sites-enabled/default",
      "sudo nginx -t",

      # Setup SSL with Certbot
      "echo 'Configuring SSL ...'",
      "sudo ln -sf /snap/bin/certbot /usr/bin/certbot",
      "sudo certbot --nginx -d ${var.bctk_domain} --non-interactive --agree-tos --email ${local.sub_domain}@${local.root_domain}",
      "sudo nginx -t",

      # Create .env
      "echo 'Creating .env file ...'",
      "tee /opt/app/.env << EOF",
      "CLICKHOUSE_IP=${var.clickhouse_ip}",
      "CLICKHOUSE_PORT=${var.clickhouse_port}",
      "CLICKHOUSE_DB=${var.clickhouse_db}",
      "CLICKHOUSE_USER=${var.clickhouse_app_user}",
      "CLICKHOUSE_PASSWORD=${var.clickhouse_app_password}",
      "AVALANCHE_RPC_URL=${var.avalanche_rpc_url}",
      "NODE_ENV=production",
      "EOF",

      # Create service for Typescript components
      "echo 'Creating blockchain service...'",
      "sudo tee /etc/systemd/system/blockchain-app.service << EOF",
      "[Unit]",
      "Description=Blockchain Application",
      "After=network.target clickhouse-server.service",
      "[Service]",
      "Type=simple",
      "User=${var.scaleway_server_user}",
      "WorkingDirectory=/opt/app",
      "ExecStart=/usr/bin/npm start",
      "Restart=always",
      "RestartSec=10",
      "[Install]",
      "WantedBy=multi-user.target",
      "EOF",

      # Save Terraform scripts (avoiding permission errors)
      "mkdir -p /opt/app/tmp",
      "find /tmp -maxdepth 1 -name 'terraform_*.sh' -type f 2>/dev/null | xargs -I {} cp {} /opt/app/tmp/ || true",

    ]
  }

  provisioner "remote-exec" {
    inline = [
      # Reload systemd, enable and start the service
      "sh /terraform/init-services.sh",
      # # Configure system limits for ClickHouse
      # "echo 'Configuring system limits for ClickHouse...'",
      # "sudo tee /etc/security/limits.d/clickhouse.conf << EOF",
      # "clickhouse soft nofile 262144",
      # "clickhouse hard nofile 262144",
      # "clickhouse soft nproc 131072",
      # "clickhouse hard nproc 131072",
      # "EOF",

      # # Configure transparent hugepages
      # "echo 'Configuring transparent hugepages...'",
      # "echo madvise | sudo tee /sys/kernel/mm/transparent_hugepage/enabled",

      # # Configure numa zones if available
      # "if [ -f /proc/sys/vm/zone_reclaim_mode ]; then",
      #     "echo 0 | sudo tee /proc/sys/vm/zone_reclaim_mode",
      # "fi",

      # # Reload systemd, enable and start the service
      # "echo 'Starting services ...'",
      # "sudo systemctl daemon-reload",
      # "sudo systemctl start clickhouse-server",
      # "sudo systemctl enable clickhouse-server",
      # "sudo systemctl start clickhouse-keeper",
      # "sudo systemctl enable clickhouse-keeper",
      # "sudo systemctl restart nginx",
      # "sudo systemctl enable nginx",
      # "sudo systemctl enable blockchain-app",
      # "sudo systemctl start blockchain-app",

      # # Double checks
      # "systemctl is-active --quiet clickhouse-server || systemctl restart clickhouse-server;",
      # "systemctl is-active --quiet clickhouse-keeper || systemctl restart clickhouse-keeper;",
      # "systemctl is-active --quiet blockchain-app || systemctl restart blockchain-app;",
      # "systemctl is-active --quiet nginx || systemctl restart nginx;",

      # Print completion with actual date
      "find /tmp -maxdepth 1 -name 'terraform_*.sh' -type f 2>/dev/null | xargs -I {} cp {} /opt/app/tmp/ || true",
      "date | xargs -I {} echo 'Provisioning completed at: {}'",
    ]
  }
}

output "instance_ipv4" {
  value = scaleway_instance_ip.public_ipv4.address
}
output "instance_ipv6" {
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
