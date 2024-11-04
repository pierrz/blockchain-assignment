# blockchain-assignment

#### Description
Repository used for the Blockchain technical assignment.

#### Table of Contents
- [Overview](#overview)
- [Schema](#schema)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Deployment with Terraform (WIP)](#deployment-with-terraform-wip)
- [APIs](#apis)
- [Technical Debt](#technical-debt)

<hr>

### Database setup adn schema

Cf. [`db/startup_scripts.xml`](db/startup_scripts.xml)

- Optimized schema for the `blockchain.transactions` table
- Real-time analytics via materialized views
    - tx_analytics - Daily statistics
    - address_activity - Per-address metrics
- Configurable performance settings

<br>

### Installation
- Create the `.env` based on the provided [`.env.example`](.env.example)
- Tweak `src/config/production.json`(src/config/production.json) to decide which Typescript components will be running (import, realtime, APIs).
- If using the "import" mode, you have to put your source `.tar.gz` data in `$DATA_DIR` (Cf. `.env`)

<br>

### Quick Start

Run the Docker Compose command:
```
docker compose up --build
```

<br>

### Deployment with Terraform (WIP)

The Terraform setup 
- install this repository
- install a ClickHouse database
- install NGinx with the required configurations

1. Initialize:
```bash
terraform init
```

2. Configure (optional):
```bash
# terraform.tfvars
clickhouse_user = "custom_user"
clickhouse_password = "secure_password"
```

3. Deploy:
```bash
terraform apply
```


### APIs
When using Docker, you can access the APIs via the following queries:
- Transactions list: 
```
curl -s "http://localhost:3000/transactions?address=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&page=2&limit=5" | jq '.'
```
- Transactions list, sorted by values: 
```
curl -s "http://localhost:3000/transactions/by-value?address=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&page=2&limit=5" | jq '.'
```
- Transactions count: 
```
curl -s "http://localhost:3000/transactions/count?address=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&
```

### Technical Debt
- Finalise Terraform setup
- Implement complete authentication for ClicHouse
- Tests for the Typescript components
- Linting, coverage
