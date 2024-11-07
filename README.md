# blockchain-assignment

#### Description
Repository used for the Blockchain technical assignment.

#### Table of Contents
- [Overview](#overview)
- [Schema](#schema)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Deployment with GitHub Actions and Terraform](#deployment-with-github-actions-and-terraform)
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
- Tweak the `src/config/*.json`(src/config) files to decide which Typescript components will be running (import, realtime, APIs).
- If using the "import" mode, you have to put your source `.tar.gz` data in `$DATA_DIR` (Cf. `.env`)

<br>

### Quick Start

Run the Docker Compose command:
```
docker compose up --build
```

<br>

### Deployment with GitHub Actions and Terraform

For this step, there are many secrets created in GitHub Actions 
to support the CD workflow and the Terraform provisionning. 
Follow what is available in the `.env` and `.github/workflows/cd.yml` files to gather what is required.

The Terraform setup work:
- fetch the sample data from a Scaleway bucket
- install this repository and all the Node environment
- install a ClickHouse database
- install NGinx with the required configurations
- implement a Letsencrypt certificate with Certbot 

NB: The last point is currently disabled 
as a DNSSEC issue related to the created IPs or DNS records
is still in the way (Scaleway support WIP).

<br>

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

<br>

### Technical Debt
- Implement complete authentication for ClicHouse in Compose setup (Terraform OK)
- Multithreading and improved error handling for the Realtime mode.
- Tests for the Typescript components
- Linting, coverage
