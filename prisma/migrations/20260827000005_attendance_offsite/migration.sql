-- Off-site attendance (2026-08-27, owner instruction).
--
-- "If they are present inside the location given by the admin, it will
-- be marked present and the in-time calculated. If the user is checking
-- in outside the location, they will be asked 'where are you?' and enter
-- the location, and then it will calculate the time of login."
--
-- Until now the geofence BLOCKED an off-site punch outright. For a
-- business whose staff spend their days at client sites that is the
-- wrong default: a measurement executive at a villa in Saibaba Colony is
-- working, not skiving, and refusing their check-in means the day is
-- simply not recorded.
--
-- So the fence stops being a gate and becomes a label. Off-site punches
-- are accepted, tagged, and carry the place the employee typed — which
-- is more useful than a blocked punch and more honest than a silent one.
ALTER TABLE "Attendance"
  ADD COLUMN "inOffSite"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "inPlace"    TEXT,
  ADD COLUMN "outOffSite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "outPlace"   TEXT;

-- The owner's review list is "who worked away from the office today",
-- so that is the query this index serves.
CREATE INDEX IF NOT EXISTS "Attendance_offsite_idx"
  ON "Attendance" ("organizationId", "date", "inOffSite");
