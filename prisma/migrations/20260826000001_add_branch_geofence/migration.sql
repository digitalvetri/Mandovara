-- Branch geofence for self check-in / check-out.
-- All three nullable so existing branches without a fence keep working
-- (attendance falls back to legacy "accept any GPS" behaviour) until
-- the owner configures a location + radius in Admin.
ALTER TABLE "Branch"
  ADD COLUMN "latitude"           DECIMAL(9,6),
  ADD COLUMN "longitude"          DECIMAL(9,6),
  ADD COLUMN "attendanceRadiusM"  INTEGER;
