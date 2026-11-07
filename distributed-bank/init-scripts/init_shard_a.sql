CREATE TABLE IF NOT EXISTS accounts (
    account_id VARCHAR(10) PRIMARY KEY,
    balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO accounts (account_id, balance)
SELECT 
    'A' || LPAD(i::text, 4, '0'),
    1000.00
FROM generate_series(1, 1000) AS i
ON CONFLICT (account_id) DO NOTHING;