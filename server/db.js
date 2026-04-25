import { Pool } from 'pg'
import dotenv from 'dotenv'
import process from 'node:process'

dotenv.config()

export const dbSchema = process.env.DB_SCHEMA || 'inventory_laptop'

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || ''
const shouldUseSsl =
  process.env.DB_SSL === 'true' ||
  process.env.NODE_ENV === 'production' ||
  connectionString.includes('supabase.co')

const poolConfig = connectionString
  ? {
      connectionString,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_laptop',
      port: Number(process.env.DB_PORT || 5432),
    }

export const pool = new Pool({
  ...poolConfig,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
})
