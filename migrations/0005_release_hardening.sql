ALTER TABLE v2_events ADD COLUMN course_version TEXT;
ALTER TABLE v2_events ADD COLUMN course_data_json TEXT;
CREATE INDEX IF NOT EXISTS idx_v2_event_status_date ON v2_events(status,event_date);
