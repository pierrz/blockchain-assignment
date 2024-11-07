import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config();

// Initialize ClickHouse client
export const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_APP_USER,
  password: process.env.CLICKHOUSE_APP_PASSWORD,
  database: process.env.CLICKHOUSE_DB
});
