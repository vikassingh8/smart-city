-- Sensor metadata (Azure SQL). The readings live in Azure Data Explorer; this table holds
-- the slow-changing description of each sensor so the API can join on name and
-- location. Apply with: node db/seed.js

IF OBJECT_ID('dbo.sensors', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sensors (
        sensor_id    NVARCHAR(50)  NOT NULL PRIMARY KEY,  -- matches Kafka key, e.g. 'sensor-1'
        name         NVARCHAR(100) NOT NULL,
        type         NVARCHAR(50)  NOT NULL DEFAULT 'environmental',
        location     NVARCHAR(100) NOT NULL,
        latitude     FLOAT         NULL,
        longitude    FLOAT         NULL,
        installed_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        status       NVARCHAR(20)  NOT NULL DEFAULT 'active'  -- active | maintenance | retired
    );

    -- Common dashboard filters: by status and by type.
    CREATE INDEX IX_sensors_status ON dbo.sensors (status);
    CREATE INDEX IX_sensors_type   ON dbo.sensors (type);
END;
