-- 1. Add `server_updated_at` to the 4 tables that are missing it
ALTER TABLE classes ADD COLUMN server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE class_subjects ADD COLUMN server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE enrolments ADD COLUMN server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE students ADD COLUMN server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Add sync metadata columns to all 8 tables
ALTER TABLE classes ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE classes ADD COLUMN client_mutation_id UUID;
ALTER TABLE class_subjects ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE class_subjects ADD COLUMN client_mutation_id UUID;
ALTER TABLE enrolments ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE enrolments ADD COLUMN client_mutation_id UUID;
ALTER TABLE students ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN client_mutation_id UUID;
ALTER TABLE scores ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE scores ADD COLUMN client_mutation_id UUID;
ALTER TABLE trait_ratings ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE trait_ratings ADD COLUMN client_mutation_id UUID;
ALTER TABLE term_records ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE term_records ADD COLUMN client_mutation_id UUID;
ALTER TABLE attendance_logs ADD COLUMN client_updated_at TIMESTAMPTZ;
ALTER TABLE attendance_logs ADD COLUMN client_mutation_id UUID;

-- 3. Add indexes for the pull cursor (performance)
CREATE INDEX idx_classes_server_updated ON classes(server_updated_at);
CREATE INDEX idx_class_subjects_server_updated ON class_subjects(server_updated_at);
CREATE INDEX idx_enrolments_server_updated ON enrolments(server_updated_at);
CREATE INDEX idx_students_server_updated ON students(server_updated_at);
CREATE INDEX idx_scores_server_updated ON scores(server_updated_at);
CREATE INDEX idx_trait_ratings_server_updated ON trait_ratings(server_updated_at);
CREATE INDEX idx_term_records_server_updated ON term_records(server_updated_at);
CREATE INDEX idx_attendance_logs_server_updated ON attendance_logs(server_updated_at);

-- 4. Create the trigger function to update the clock automatically
CREATE OR REPLACE FUNCTION set_server_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.server_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger to all 8 tables
CREATE TRIGGER tr_classes_server_updated BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
CREATE TRIGGER tr_class_subjects_server_updated BEFORE UPDATE ON class_subjects FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
CREATE TRIGGER tr_enrolments_server_updated BEFORE UPDATE ON enrolments FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
CREATE TRIGGER tr_students_server_updated BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
CREATE TRIGGER tr_scores_server_updated BEFORE UPDATE ON scores FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
CREATE TRIGGER tr_trait_ratings_server_updated BEFORE UPDATE ON trait_ratings FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
CREATE TRIGGER tr_term_records_server_updated BEFORE UPDATE ON term_records FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();
CREATE TRIGGER tr_attendance_logs_server_updated BEFORE UPDATE ON attendance_logs FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- 6. Backfill server_updated_at for the newly added tables using created_at
UPDATE classes SET server_updated_at = created_at WHERE created_at IS NOT NULL;
UPDATE class_subjects SET server_updated_at = created_at WHERE created_at IS NOT NULL;
UPDATE enrolments SET server_updated_at = created_at WHERE created_at IS NOT NULL;
UPDATE students SET server_updated_at = created_at WHERE created_at IS NOT NULL;