-- Supabase setup:
-- 1. Open your Supabase project.
-- 2. Go to SQL Editor > New query.
-- 3. Paste this whole file and run it.
--
-- Local PostgreSQL setup:
-- 1. Create the database:
--    CREATE DATABASE inventory_laptop;
-- 2. Connect to it:
--    \c inventory_laptop

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS inventory_laptop;

CREATE TABLE IF NOT EXISTS inventory_laptop.admin_users (
    admin_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(120) NOT NULL DEFAULT 'Laptop Inventory Admin',
    workspace_name VARCHAR(160) NOT NULL DEFAULT 'Herald Laptop Inventory',
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    member_since VARCHAR(40) NOT NULL DEFAULT 'April 2026',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_laptop.laptop_items (
    laptop_id BIGSERIAL PRIMARY KEY,
    laptop_name VARCHAR(150) NOT NULL,
    category VARCHAR(120) NOT NULL,
    sku VARCHAR(40) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    description TEXT NOT NULL DEFAULT '',
    last_update TEXT NOT NULL DEFAULT 'Recently added laptop',
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_laptop_items_created_at
    ON inventory_laptop.laptop_items (created_at DESC);

CREATE OR REPLACE FUNCTION inventory_laptop.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_laptop_admin_users_updated_at ON inventory_laptop.admin_users;
CREATE TRIGGER trg_inventory_laptop_admin_users_updated_at
BEFORE UPDATE ON inventory_laptop.admin_users
FOR EACH ROW
EXECUTE FUNCTION inventory_laptop.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_laptop_items_updated_at ON inventory_laptop.laptop_items;
CREATE TRIGGER trg_inventory_laptop_items_updated_at
BEFORE UPDATE ON inventory_laptop.laptop_items
FOR EACH ROW
EXECUTE FUNCTION inventory_laptop.set_updated_at();

INSERT INTO inventory_laptop.admin_users (
    full_name,
    role,
    workspace_name,
    email,
    password_hash,
    member_since,
    is_active
)
VALUES (
    'Herald Admin',
    'Laptop Inventory Admin',
    'Herald Laptop Inventory',
    'herald@gmail.com',
    crypt('1234', gen_salt('bf')),
    'April 2026',
    TRUE
)
ON CONFLICT (email) DO UPDATE
SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    workspace_name = EXCLUDED.workspace_name,
    password_hash = crypt('1234', gen_salt('bf')),
    member_since = EXCLUDED.member_since,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO inventory_laptop.laptop_items (
    laptop_name,
    category,
    sku,
    quantity,
    description,
    last_update,
    image_url
)
VALUES
    (
        'Lenovo ThinkPad T14 Gen 4',
        'Business',
        'LTP-THK-001',
        12,
        '14-inch business laptop for office staff and daily productivity tasks.',
        'Recently added laptop',
        ''
    ),
    (
        'Dell Latitude 5440',
        'Office',
        'LTP-LAT-002',
        8,
        'Reliable enterprise laptop prepared for accounting and operations teams.',
        'Recently added laptop',
        ''
    ),
    (
        'ASUS ROG Zephyrus G14',
        'Performance',
        'LTP-ROG-003',
        5,
        'High-performance laptop for editing, design, and demanding workloads.',
        'Recently added laptop',
        ''
    )
ON CONFLICT (sku) DO UPDATE
SET
    laptop_name = EXCLUDED.laptop_name,
    category = EXCLUDED.category,
    quantity = EXCLUDED.quantity,
    description = EXCLUDED.description,
    last_update = EXCLUDED.last_update,
    image_url = EXCLUDED.image_url,
    updated_at = CURRENT_TIMESTAMP;
