#!/bin/bash

# Configure system limits for ClickHouse
echo 'Configuring system limits for ClickHouse...'
sudo tee /etc/security/limits.d/clickhouse.conf << EOF
clickhouse soft nofile 262144
clickhouse hard nofile 262144
clickhouse soft nproc 131072
clickhouse hard nproc 131072
EOF

# Configure transparent hugepages
echo 'Configuring transparent hugepages...'
echo madvise | sudo tee /sys/kernel/mm/transparent_hugepage/enabled

# Configure numa zones if available
if [ -f /proc/sys/vm/zone_reclaim_mode ]; then
    echo 0 | sudo tee /proc/sys/vm/zone_reclaim_mode
fi

# Reload systemd, enable and start the service
echo 'Starting services ...'
sudo systemctl daemon-reload
sudo systemctl start clickhouse-server
sudo systemctl enable clickhouse-server
sudo systemctl start clickhouse-keeper
sudo systemctl enable clickhouse-keeper
sudo systemctl restart nginx
sudo systemctl enable nginx
sudo systemctl enable blockchain-app
sudo systemctl start blockchain-app

# Double checks
systemctl is-active --quiet clickhouse-server || systemctl restart clickhouse-server;
systemctl is-active --quiet clickhouse-keeper || systemctl restart clickhouse-keeper;
systemctl is-active --quiet blockchain-app || systemctl restart blockchain-app;
systemctl is-active --quiet nginx || systemctl restart nginx;
