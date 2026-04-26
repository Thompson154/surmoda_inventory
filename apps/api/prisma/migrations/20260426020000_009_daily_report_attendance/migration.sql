-- Feature 008: roster of staff who worked the closed day.

CREATE TABLE "daily_report_attendance" (
  "id" TEXT NOT NULL,
  "daily_report_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "daily_report_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_report_attendance_daily_report_id_user_id_key"
  ON "daily_report_attendance"("daily_report_id", "user_id");

CREATE INDEX "daily_report_attendance_user_id_idx"
  ON "daily_report_attendance"("user_id");

ALTER TABLE "daily_report_attendance" ADD CONSTRAINT "daily_report_attendance_daily_report_id_fkey"
  FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "daily_report_attendance" ADD CONSTRAINT "daily_report_attendance_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
