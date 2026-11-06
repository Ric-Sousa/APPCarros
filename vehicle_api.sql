-- Tabela de cache usada pelo vehicle_api.php (MySQL, no servidor onde o PHP corre).
-- A base de dados da aplicação Node é criada automaticamente no arranque (server/db.ts).

CREATE TABLE IF NOT EXISTS scraped_vehicles (
    license_plate VARCHAR(50) PRIMARY KEY,
    data JSON,
    power_cv INT NULL,
    power_kw INT NULL,
    color VARCHAR(50) NULL,
    origin VARCHAR(100) NULL,
    brand VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    year INT NULL,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
);

CREATE INDEX idx_scraped_vehicles_license_plate ON scraped_vehicles(license_plate);
