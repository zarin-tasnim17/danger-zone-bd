-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Trigger function for Report
CREATE OR REPLACE FUNCTION update_report_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Report
DROP TRIGGER IF EXISTS trg_update_report_location ON "Report";
CREATE TRIGGER trg_update_report_location
BEFORE INSERT OR UPDATE OF latitude, longitude
ON "Report"
FOR EACH ROW
EXECUTE FUNCTION update_report_location();

-- Trigger function for SafeZone
CREATE OR REPLACE FUNCTION update_safezone_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for SafeZone
DROP TRIGGER IF EXISTS trg_update_safezone_location ON "SafeZone";
CREATE TRIGGER trg_update_safezone_location
BEFORE INSERT OR UPDATE OF latitude, longitude
ON "SafeZone"
FOR EACH ROW
EXECUTE FUNCTION update_safezone_location();
