#!/bin/bash

# Reload systemd, enable and start the service
echo 'Starting services ...'"
sudo systemctl daemon-reload"
sudo systemctl start clickhouse-server"
sudo systemctl enable clickhouse-server"
sudo systemctl start clickhouse-keeper"
sudo systemctl enable clickhouse-keeper"
sudo systemctl restart nginx"
sudo systemctl enable nginx"
sudo systemctl enable blockchain-app"
sudo systemctl start blockchain-app"

# Double checks
systemctl is-active --quiet clickhouse-server || systemctl restart clickhouse-server;
systemctl is-active --quiet clickhouse-keeper || systemctl restart clickhouse-keeper;
systemctl is-active --quiet blockchain-app || systemctl restart blockchain-app;
systemctl is-active --quiet nginx || systemctl restart nginx;
