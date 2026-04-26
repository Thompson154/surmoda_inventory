-- Attendance roster moves from "user FK only" to "free-text name + optional FK".
-- Add full_name NULLABLE, backfill from joined user.full_name, then enforce NOT NULL.
-- Relax user_id to NULLABLE and switch its FK action from RESTRICT → SET NULL so a
-- deactivated employee doesn't block historical reports.

ALTER TABLE "daily_report_attendance" ADD COLUMN "full_name" TEXT;

UPDATE "daily_report_attendance" a
SET "full_name" = u."full_name"
FROM "users" u
WHERE a."user_id" = u."id";

DO $$
DECLARE
  remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining FROM "daily_report_attendance" WHERE "full_name" IS NULL;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % attendance rows still have NULL full_name', remaining;
  END IF;
END $$;

ALTER TABLE "daily_report_attendance" ALTER COLUMN "full_name" SET NOT NULL;
ALTER TABLE "daily_report_attendance" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "daily_report_attendance" DROP CONSTRAINT IF EXISTS "daily_report_attendance_user_id_fkey";
ALTER TABLE "daily_report_attendance" ADD CONSTRAINT "daily_report_attendance_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "daily_report_attendance_daily_report_id_user_id_key";
CREATE INDEX IF NOT EXISTS "daily_report_attendance_daily_report_id_idx"
  ON "daily_report_attendance"("daily_report_id");
