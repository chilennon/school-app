SET local check_function_bodies = off;

CREATE TABLE "public"."attendance_logs" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"         uuid                     NOT NULL,
  "enrolment_id"      uuid                     NOT NULL,
  "date"              date                     NOT NULL,
  "status"            text                     NOT NULL,
  "recorded_by"       uuid                     NOT NULL,
  "recorded_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "server_updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_logs_enrolment_id_date_key" UNIQUE (enrolment_id, date),
  CONSTRAINT "attendance_logs_pkey" PRIMARY KEY (id),
  CONSTRAINT "attendance_logs_status_check" CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text])))
);

ALTER TABLE "public"."attendance_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."audit_log" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"    uuid                     NOT NULL,
  "actor_id"     uuid                     NOT NULL,
  "actor_name"   text                     NOT NULL,
  "action"       text                     NOT NULL,
  "target_table" text                     NOT NULL,
  "target_id"    uuid,
  "target_label" text,
  "metadata"     jsonb,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."charges" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"   uuid                     NOT NULL,
  "family_id"   uuid                     NOT NULL,
  "term_id"     uuid                     NOT NULL,
  "description" text                     NOT NULL,
  "amount"      numeric                  NOT NULL,
  "created_by"  uuid,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "charges_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."charges"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."class_subjects" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"  uuid                     NOT NULL,
  "class_id"   uuid                     NOT NULL,
  "subject_id" uuid                     NOT NULL,
  "staff_id"   uuid,
  "session_id" uuid                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "class_subjects_class_id_subject_id_session_id_key" UNIQUE (class_id, subject_id, session_id),
  CONSTRAINT "class_subjects_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."class_subjects"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."classes" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "session"    text                     NOT NULL,
  "teacher_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "session_id" uuid,
  "school_id"  uuid                     NOT NULL,
  CONSTRAINT "classes_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."classes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."enrolments" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"  uuid                     NOT NULL,
  "student_id" uuid                     NOT NULL,
  "class_id"   uuid                     NOT NULL,
  "session_id" uuid                     NOT NULL,
  "status"     text                     NOT NULL DEFAULT 'active'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "enrolments_pkey" PRIMARY KEY (id),
  CONSTRAINT "enrolments_student_id_session_id_key" UNIQUE (student_id, session_id)
);

ALTER TABLE "public"."enrolments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."families" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"          uuid                     NOT NULL,
  "name"               text                     NOT NULL,
  "guardian_name"      text                     NOT NULL,
  "guardian_phone"     text                     NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at"         timestamp with time zone,
  "guardian_phone_2"   text,
  "phone_normalized"   text,
  "phone_normalized_2" text,
  CONSTRAINT "families_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."families"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."fee_items" (
  "id"          uuid    NOT NULL DEFAULT gen_random_uuid(),
  "school_id"   uuid    NOT NULL,
  "term_id"     uuid    NOT NULL,
  "class_id"    uuid,
  "name"        text    NOT NULL,
  "amount"      numeric NOT NULL,
  "is_optional" boolean DEFAULT false,
  CONSTRAINT "fee_items_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."fee_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."grade_bands" (
  "id"            uuid    NOT NULL DEFAULT gen_random_uuid(),
  "school_id"     uuid    NOT NULL,
  "min_score"     numeric NOT NULL,
  "max_score"     numeric NOT NULL,
  "grade"         text    NOT NULL,
  "remark"        text    NOT NULL,
  "display_order" integer DEFAULT 0,
  CONSTRAINT "grade_bands_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."grade_bands"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."payments" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"   uuid                     NOT NULL,
  "family_id"   uuid                     NOT NULL,
  "amount"      numeric                  NOT NULL,
  "method"      text                     NOT NULL,
  "reference"   text,
  "receipt_no"  text                     NOT NULL,
  "paid_on"     date                     NOT NULL,
  "note"        text,
  "recorded_by" uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "payments_method_check" CHECK ((method = ANY (ARRAY['cash'::text, 'transfer'::text, 'pos'::text, 'other'::text]))),
  CONSTRAINT "payments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."payments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "name"       text                     NOT NULL,
  "email"      text                     NOT NULL,
  "role"       text                     NOT NULL DEFAULT 'teacher'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "school_id"  uuid                     NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'teacher'::text, 'bursar'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."receipt_counters" (
  "school_id"   uuid    NOT NULL,
  "session_id"  uuid    NOT NULL,
  "last_number" integer NOT NULL DEFAULT 0,
  CONSTRAINT "receipt_counters_pkey" PRIMARY KEY (school_id, session_id)
);

ALTER TABLE "public"."receipt_counters"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."schools" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                 text                     NOT NULL,
  "address"              text,
  "phone"                text,
  "motto"                text,
  "ca_weight"            integer                  NOT NULL DEFAULT 40,
  "exam_weight"          integer                  NOT NULL DEFAULT 60,
  "promotion_threshold"  numeric                  NOT NULL DEFAULT 40,
  "gate_results_on_fees" boolean                  NOT NULL DEFAULT false,
  "created_at"           timestamp with time zone DEFAULT now(),
  "school_type"          text                     DEFAULT 'Primary School'::text,
  "logo_url"             text,
  CONSTRAINT "schools_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."schools"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."scores" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"         uuid                     NOT NULL,
  "enrolment_id"      uuid                     NOT NULL,
  "class_subject_id"  uuid                     NOT NULL,
  "term_id"           uuid                     NOT NULL,
  "ca_score"          numeric,
  "exam_score"        numeric,
  "status"            text                     NOT NULL DEFAULT 'draft'::text,
  "device_id"         text,
  "device_updated_at" timestamp with time zone,
  "server_updated_at" timestamp with time zone DEFAULT now(),
  "created_at"        timestamp with time zone DEFAULT now(),
  "sa_score"          numeric,
  CONSTRAINT "scores_ca_score_check" CHECK (((ca_score IS NULL) OR ((ca_score >= (0)::numeric) AND (ca_score <= (100)::numeric)))),
  CONSTRAINT "scores_enrolment_id_class_subject_id_term_id_key" UNIQUE (enrolment_id, class_subject_id, term_id),
  CONSTRAINT "scores_exam_score_check" CHECK (((exam_score IS NULL) OR ((exam_score >= (0)::numeric) AND (exam_score <= (100)::numeric)))),
  CONSTRAINT "scores_pkey" PRIMARY KEY (id),
  CONSTRAINT "scores_sa_score_check" CHECK (((sa_score IS NULL) OR ((sa_score >= (0)::numeric) AND (sa_score <= (100)::numeric))))
);

ALTER TABLE "public"."scores"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sessions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"  uuid                     NOT NULL,
  "name"       text                     NOT NULL,
  "is_current" boolean                  DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "sessions_school_id_name_key" UNIQUE (school_id, name)
);

ALTER TABLE "public"."sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."students" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "reg_no"     text                     NOT NULL,
  "class_id"   uuid,
  "gender"     text,
  "age"        text,
  "assessment" jsonb                    DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "school_id"  uuid                     NOT NULL,
  "family_id"  uuid,
  CONSTRAINT "students_pkey" PRIMARY KEY (id),
  CONSTRAINT "students_school_reg_no_key" UNIQUE (school_id, reg_no)
);

ALTER TABLE "public"."students"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."subjects" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"     uuid                     NOT NULL,
  "name"          text                     NOT NULL,
  "display_order" integer                  DEFAULT 0,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "subjects_pkey" PRIMARY KEY (id),
  CONSTRAINT "subjects_school_id_name_key" UNIQUE (school_id, name)
);

ALTER TABLE "public"."subjects"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."term_records" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"             uuid                     NOT NULL,
  "enrolment_id"          uuid                     NOT NULL,
  "term_id"               uuid                     NOT NULL,
  "days_opened"           integer,
  "days_present"          integer,
  "days_absent"           integer,
  "class_teacher_comment" text,
  "head_teacher_comment"  text,
  "approved_by"           uuid,
  "approved_at"           timestamp with time zone,
  "release_override"      boolean                  DEFAULT false,
  "override_by"           uuid,
  "server_updated_at"     timestamp with time zone DEFAULT now(),
  "status"                text                     NOT NULL DEFAULT 'draft'::text,
  CONSTRAINT "term_records_enrolment_id_term_id_key" UNIQUE (enrolment_id, term_id),
  CONSTRAINT "term_records_pkey" PRIMARY KEY (id),
  CONSTRAINT "term_records_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text])))
);

ALTER TABLE "public"."term_records"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."terms" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"        uuid                     NOT NULL,
  "session_id"       uuid                     NOT NULL,
  "name"             text                     NOT NULL,
  "sequence"         integer                  NOT NULL,
  "days_opened"      integer,
  "next_term_begins" date,
  "is_current"       boolean                  DEFAULT false,
  "created_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "terms_pkey" PRIMARY KEY (id),
  CONSTRAINT "terms_session_id_name_key" UNIQUE (session_id, name)
);

ALTER TABLE "public"."terms"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."trait_ratings" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "school_id"         uuid                     NOT NULL,
  "enrolment_id"      uuid                     NOT NULL,
  "term_id"           uuid                     NOT NULL,
  "trait_key"         text                     NOT NULL,
  "trait_domain"      text                     NOT NULL,
  "rating"            integer,
  "server_updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "trait_ratings_enrolment_id_term_id_trait_key_key" UNIQUE (enrolment_id, term_id, trait_key),
  CONSTRAINT "trait_ratings_pkey" PRIMARY KEY (id),
  CONSTRAINT "trait_ratings_rating_check" CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT "trait_ratings_trait_domain_check" CHECK ((trait_domain = ANY (ARRAY['affective'::text, 'psychomotor'::text])))
);

ALTER TABLE "public"."trait_ratings"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_term_charges_atomic (
  p_school_id  uuid,
  p_term_id    uuid,
  p_user_id    uuid,
  p_class_fees jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  v_family RECORD;
  v_student RECORD;
  v_class_fee numeric;
  v_generated_count integer := 0;
BEGIN
  -- 1. Security Check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id AND school_id = p_school_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Forbidden: Only the school owner can generate term charges.';
  END IF;

  -- 2. GUARD CLAUSE: Prevent double generation
  IF EXISTS (
    SELECT 1 FROM charges 
    WHERE school_id = p_school_id AND term_id = p_term_id
  ) THEN
    RAISE EXCEPTION 'Charges have already been generated for this term. Aborting to prevent double billing.';
  END IF;

  -- 3. Loop through all active families
  FOR v_family IN 
    SELECT id FROM families 
    WHERE school_id = p_school_id AND deleted_at IS NULL
  LOOP
    -- 4. Generate Tuition Charges per Student
    FOR v_student IN 
      SELECT s.id, s.name, s.class_id, c.name as class_name 
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.family_id = v_family.id AND s.school_id = p_school_id
    LOOP
      SELECT (fee->>'amount')::numeric INTO v_class_fee
      FROM jsonb_array_elements(p_class_fees) AS fee
      WHERE fee->>'class_id' = v_student.class_id::text
      LIMIT 1;

      IF v_class_fee IS NOT NULL AND v_class_fee > 0 THEN
        INSERT INTO charges (
          school_id, family_id, term_id, description, amount, created_by
        ) VALUES (
          p_school_id, v_family.id, p_term_id, 
          'Tuition - ' || v_student.name || ' (' || v_student.class_name || ')', 
          v_class_fee, p_user_id
        );
        v_generated_count := v_generated_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'generated_charges', v_generated_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.import_families_bulk (
  p_school_id  uuid,
  p_term_id    uuid,
  p_session_id uuid,
  p_user_id    uuid,
  p_rows       jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  v_row jsonb;
  v_family_name text;
  v_guardian_name text;
  v_guardian_phone text;
  v_total_due numeric;
  v_total_paid numeric;
  
  v_new_family_id uuid;
  v_existing_family_id uuid;
  
  v_inserted integer := 0;
  v_skipped integer := 0;
  
  v_next_receipt_num integer;
  v_receipt_no text;
  v_current_year text;
BEGIN
  v_current_year := extract(year from now())::text;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_family_name := trim(v_row->>'familyName');
    
    -- Safety check: skip completely empty rows
    IF v_family_name IS NULL OR v_family_name = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_guardian_name := trim(v_row->>'guardianName');
    v_guardian_phone := trim(v_row->>'guardianPhone');
    v_total_due := COALESCE((v_row->>'totalDue')::numeric, 0);
    v_total_paid := COALESCE((v_row->>'totalPaid')::numeric, 0);

    -- 1. DEDUPLICATION CHECK (Name OR Phone)
    SELECT id INTO v_existing_family_id
    FROM families
    WHERE school_id = p_school_id
      AND deleted_at IS NULL
      AND (
        lower(name) = lower(v_family_name) 
        OR (v_guardian_phone IS NOT NULL AND v_guardian_phone <> '' AND guardian_phone = v_guardian_phone)
      )
    LIMIT 1;

    IF v_existing_family_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 2. INSERT FAMILY
    INSERT INTO families (school_id, name, guardian_name, guardian_phone)
    VALUES (
      p_school_id, 
      v_family_name, 
      COALESCE(v_guardian_name, 'Guardian'), 
      COALESCE(v_guardian_phone, '0000000000')
    )
    RETURNING id INTO v_new_family_id;

    -- 3. INSERT INITIAL CHARGE
    IF v_total_due > 0 THEN
      INSERT INTO charges (school_id, family_id, term_id, description, amount, created_by)
      VALUES (p_school_id, v_new_family_id, p_term_id, 'Migrated Initial Balance', v_total_due, p_user_id);
    END IF;

    -- 4. INSERT INITIAL PAYMENT & GENERATE RECEIPT
    IF v_total_paid > 0 THEN
      -- Call the existing atomic counter function
      v_next_receipt_num := increment_receipt_counter(p_school_id, p_session_id);
      
      v_receipt_no := 'IMP-' || v_current_year || '-' || lpad(v_next_receipt_num::text, 4, '0');

      INSERT INTO payments (school_id, family_id, amount, method, receipt_no, paid_on, note, recorded_by)
      VALUES (
        p_school_id, 
        v_new_family_id, 
        v_total_paid, 
        'other', 
        v_receipt_no, 
        CURRENT_DATE, 
        'Migrated from spreadsheet', 
        p_user_id
      );
    END IF;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.import_students_atomic (
  p_school_id  uuid,
  p_session_id uuid,
  p_user_id    uuid,
  p_students   jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  v_row jsonb;
  v_student_name text;
  v_class_name text;
  v_reg_no text;
  v_guardian_name text;
  v_phone1 text;
  v_phone2 text;
  
  v_norm_phone1 text;
  v_norm_phone2 text;
  v_digits1 text;
  v_digits2 text;
  
  v_class_id uuid;
  v_family_id uuid;
  v_family_name text;
  
  v_final_reg_no text;
  v_counter integer;
  
  v_new_student_id uuid; -- ✅ FIXED: Dedicated UUID variable
  
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- 1. Security Check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id AND school_id = p_school_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Forbidden: Only admins and owners can import students.';
  END IF;

  -- 2. Loop through the JSON array
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_students)
  LOOP
    v_student_name := trim(v_row->>'studentName');
    v_class_name := trim(v_row->>'className');
    v_reg_no := trim(v_row->>'regNo');
    v_guardian_name := trim(v_row->>'guardianName');
    v_phone1 := trim(v_row->>'phone1');
    v_phone2 := trim(v_row->>'phone2');

    IF v_student_name IS NULL OR v_student_name = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- 3. Normalize Phones
    v_digits1 := regexp_replace(v_phone1, '\D', '', 'g');
    IF v_digits1 ~ '^0\d{10}$' THEN
      v_norm_phone1 := '234' || substring(v_digits1 from 2);
    ELSIF v_digits1 ~ '^[789]\d{9}$' THEN
      v_norm_phone1 := '234' || v_digits1;
    ELSE
      v_norm_phone1 := v_digits1;
    END IF;

    v_digits2 := regexp_replace(v_phone2, '\D', '', 'g');
    IF v_digits2 ~ '^0\d{10}$' THEN
      v_norm_phone2 := '234' || substring(v_digits2 from 2);
    ELSIF v_digits2 ~ '^[789]\d{9}$' THEN
      v_norm_phone2 := '234' || v_digits2;
    ELSE
      v_norm_phone2 := v_digits2;
    END IF;

    -- 4. Look up the Class ID
    SELECT id INTO v_class_id 
    FROM classes 
    WHERE school_id = p_school_id AND lower(name) = lower(v_class_name) 
    LIMIT 1;

    IF v_class_id IS NULL THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object('student', v_student_name, 'error', 'Class "' || v_class_name || '" not found');
      CONTINUE;
    END IF;

    -- 5. Find Existing Family (check both phone columns)
    v_family_id := NULL;
    IF v_norm_phone1 <> '' OR v_norm_phone2 <> '' THEN
      SELECT id INTO v_family_id
      FROM families
      WHERE school_id = p_school_id
        AND deleted_at IS NULL
        AND (
          (v_norm_phone1 <> '' AND (phone_normalized = v_norm_phone1 OR phone_normalized_2 = v_norm_phone1))
          OR
          (v_norm_phone2 <> '' AND (phone_normalized = v_norm_phone2 OR phone_normalized_2 = v_norm_phone2))
        )
      LIMIT 1;
    END IF;

    -- 6. Create Family if not found
    IF v_family_id IS NULL THEN
      v_family_name := COALESCE(NULLIF(v_guardian_name, ''), 'Unknown Guardian') || ' Family';
      INSERT INTO families (
        school_id, name, guardian_name, guardian_phone, guardian_phone_2, phone_normalized, phone_normalized_2
      ) VALUES (
        p_school_id, v_family_name, COALESCE(NULLIF(v_guardian_name, ''), 'Unknown'), 
        NULLIF(v_phone1, ''), NULLIF(v_phone2, ''), NULLIF(v_norm_phone1, ''), NULLIF(v_norm_phone2, '')
      ) RETURNING id INTO v_family_id;
    END IF;

    -- 7. Handle Reg No Collision
    v_final_reg_no := v_reg_no;
    v_counter := 1;
    WHILE EXISTS (SELECT 1 FROM students WHERE school_id = p_school_id AND reg_no = v_final_reg_no) LOOP
      v_final_reg_no := v_reg_no || '-' || v_counter;
      v_counter := v_counter + 1;
    END LOOP;

    -- 8. Create Student ✅ FIXED
    INSERT INTO students (
      school_id, name, reg_no, class_id, family_id, gender, age
    ) VALUES (
      p_school_id, v_student_name, v_final_reg_no, v_class_id, v_family_id,
      COALESCE(v_row->>'gender', ''), COALESCE(v_row->>'age', '')
    ) RETURNING id INTO v_new_student_id;

    -- 9. Create Enrolment ✅ FIXED
    INSERT INTO enrolments (
      school_id, student_id, class_id, session_id, status
    ) VALUES (
      p_school_id, v_new_student_id, v_class_id, p_session_id, 'active'
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 'inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_receipt_counter (
  p_school_id  uuid,
  p_session_id uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
declare
  v_next_number integer;
begin
  insert into receipt_counters (school_id, session_id, last_number)
  values (p_school_id, p_session_id, 1)
  on conflict (school_id, session_id)
  do update set last_number = receipt_counters.last_number + 1
  returning last_number into v_next_number;
  
  return v_next_number;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_class_teacher (
  class_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  AS $function$
  select exists (select 1 from public.classes where id = class_id and teacher_id = auth.uid());
$function$;

REVOKE ALL ON FUNCTION "public"."is_class_teacher"(uuid) FROM "anon";

CREATE OR REPLACE FUNCTION public.is_school_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  AS $function$
  select (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'owner')
$function$;

CREATE OR REPLACE FUNCTION public.is_school_owner()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  AS $function$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
$function$;

CREATE OR REPLACE FUNCTION public.is_term_draft (
  p_enrolment_id uuid,
  p_term_id      uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select coalesce(
    (
      select r.status = 'draft'
      from public.term_records r
      where r.enrolment_id = p_enrolment_id
        and r.term_id = p_term_id
      limit 1
    ),
    true
  );
$function$;

CREATE OR REPLACE FUNCTION public.merge_families_atomic (
  p_school_id           uuid,
  p_primary_family_id   uuid,
  p_duplicate_family_id uuid,
  p_user_id             uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  -- 1. Security Check
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id AND school_id = p_school_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Forbidden: Only the school owner can merge families.';
  END IF;

  IF p_primary_family_id = p_duplicate_family_id THEN
    RAISE EXCEPTION 'Cannot merge a family into itself.';
  END IF;

  -- 2. Move Charges
  UPDATE charges 
  SET family_id = p_primary_family_id 
  WHERE family_id = p_duplicate_family_id AND school_id = p_school_id;

  -- 3. Move Payments
  UPDATE payments 
  SET family_id = p_primary_family_id 
  WHERE family_id = p_duplicate_family_id AND school_id = p_school_id;

  -- 4. Move Students
  UPDATE students 
  SET family_id = p_primary_family_id 
  WHERE family_id = p_duplicate_family_id AND school_id = p_school_id;

  -- 5. Soft Delete the Duplicate
  UPDATE families 
  SET deleted_at = now() 
  WHERE id = p_duplicate_family_id AND school_id = p_school_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_school_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
$function$;

CREATE OR REPLACE FUNCTION public.owns_class_subject (
  p_class_subject_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.class_subjects cs
    join public.classes c on c.id = cs.class_id
    where cs.id = p_class_subject_id
      and (cs.staff_id = auth.uid() or c.teacher_id = auth.uid())
  )
$function$;

CREATE OR REPLACE FUNCTION public.promote_user_to_admin (
  user_email text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  update public.profiles set role = 'admin' where email = user_email;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."promote_user_to_admin"(text) FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.record_payment_atomic (
  p_school_id  uuid,
  p_session_id uuid,
  p_family_id  uuid,
  p_user_id    uuid,
  p_amount     numeric,
  p_method     text,
  p_reference  text,
  p_note       text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  v_next_receipt_num integer;
  v_receipt_no text;
  v_current_year text;
BEGIN
  -- 1. SECURITY CHECK: Ensure the caller is an owner of this school
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id 
    AND school_id = p_school_id 
    AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Forbidden: Only the school owner can record payments.';
  END IF;

  v_current_year := extract(year from now())::text;

  -- 2. Atomic Receipt Counter Increment
  INSERT INTO receipt_counters (school_id, session_id, last_number)
  VALUES (p_school_id, p_session_id, 1)
  ON CONFLICT (school_id, session_id)
  DO UPDATE SET last_number = receipt_counters.last_number + 1
  RETURNING last_number INTO v_next_receipt_num;

  -- 3. Format the Receipt Number (e.g., RCPT-2026-0001)
  v_receipt_no := 'RCPT-' || v_current_year || '-' || lpad(v_next_receipt_num::text, 4, '0');

  -- 4. Insert the Payment
  INSERT INTO payments (
    school_id, 
    family_id, 
    amount, 
    method, 
    reference, 
    note, 
    receipt_no, 
    paid_on, 
    recorded_by
  )
  VALUES (
    p_school_id, 
    p_family_id, 
    p_amount, 
    p_method, 
    p_reference, 
    p_note, 
    v_receipt_no, 
    CURRENT_DATE, 
    p_user_id
  );

  -- 5. Return the generated receipt number
  RETURN jsonb_build_object(
    'success', true,
    'receipt_no', v_receipt_no
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.teaches_class (
  p_class_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    exists (
      select 1 from public.classes
      where id = p_class_id and teacher_id = auth.uid()
    )
    or exists (
      select 1 from public.class_subjects
      where class_id = p_class_id and staff_id = auth.uid()
    )
$function$;

CREATE OR REPLACE FUNCTION public.teaches_enrolment (
  p_enrolment_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.enrolments e
    where e.id = p_enrolment_id
      and teaches_class(e.class_id)
  )
$function$;

ALTER TABLE "public"."class_subjects"
  ADD CONSTRAINT "class_subjects_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE "public"."enrolments"
  ADD CONSTRAINT "enrolments_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE "public"."attendance_logs"
  ADD CONSTRAINT "attendance_logs_enrolment_id_fkey" FOREIGN KEY (enrolment_id) REFERENCES public.enrolments(id);

ALTER TABLE "public"."charges"
  ADD CONSTRAINT "charges_family_id_fkey" FOREIGN KEY (family_id) REFERENCES public.families(id);

ALTER TABLE "public"."fee_items"
  ADD CONSTRAINT "fee_items_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id);

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_family_id_fkey" FOREIGN KEY (family_id) REFERENCES public.families(id);

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."attendance_logs"
  ADD CONSTRAINT "attendance_logs_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);

ALTER TABLE "public"."audit_log"
  ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.profiles(id);

ALTER TABLE "public"."charges"
  ADD CONSTRAINT "charges_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE "public"."class_subjects"
  ADD CONSTRAINT "class_subjects_staff_id_fkey" FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."classes"
  ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);

ALTER TABLE "public"."attendance_logs"
  ADD CONSTRAINT "attendance_logs_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."audit_log"
  ADD CONSTRAINT "audit_log_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."charges"
  ADD CONSTRAINT "charges_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."class_subjects"
  ADD CONSTRAINT "class_subjects_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."classes"
  ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."enrolments"
  ADD CONSTRAINT "enrolments_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."families"
  ADD CONSTRAINT "families_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."fee_items"
  ADD CONSTRAINT "fee_items_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."grade_bands"
  ADD CONSTRAINT "grade_bands_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."receipt_counters"
  ADD CONSTRAINT "receipt_counters_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."scores"
  ADD CONSTRAINT "scores_class_subject_id_fkey" FOREIGN KEY (class_subject_id) REFERENCES public.class_subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."scores"
  ADD CONSTRAINT "scores_enrolment_id_fkey" FOREIGN KEY (enrolment_id) REFERENCES public.enrolments(id) ON DELETE CASCADE;

ALTER TABLE "public"."scores"
  ADD CONSTRAINT "scores_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."class_subjects"
  ADD CONSTRAINT "class_subjects_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."classes"
  ADD CONSTRAINT "classes_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;

ALTER TABLE "public"."enrolments"
  ADD CONSTRAINT "enrolments_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."receipt_counters"
  ADD CONSTRAINT "receipt_counters_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id);

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."students"
  ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

ALTER TABLE "public"."students"
  ADD CONSTRAINT "students_family_id_fkey" FOREIGN KEY (family_id) REFERENCES public.families(id);

ALTER TABLE "public"."enrolments"
  ADD CONSTRAINT "enrolments_student_id_fkey" FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE "public"."students"
  ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id);

ALTER TABLE "public"."class_subjects"
  ADD CONSTRAINT "class_subjects_subject_id_fkey" FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

ALTER TABLE "public"."subjects"
  ADD CONSTRAINT "subjects_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."term_records"
  ADD CONSTRAINT "term_records_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."term_records"
  ADD CONSTRAINT "term_records_enrolment_id_fkey" FOREIGN KEY (enrolment_id) REFERENCES public.enrolments(id) ON DELETE CASCADE;

ALTER TABLE "public"."term_records"
  ADD CONSTRAINT "term_records_override_by_fkey" FOREIGN KEY (override_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."term_records"
  ADD CONSTRAINT "term_records_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."charges"
  ADD CONSTRAINT "charges_term_id_fkey" FOREIGN KEY (term_id) REFERENCES public.terms(id);

ALTER TABLE "public"."fee_items"
  ADD CONSTRAINT "fee_items_term_id_fkey" FOREIGN KEY (term_id) REFERENCES public.terms(id);

ALTER TABLE "public"."scores"
  ADD CONSTRAINT "scores_term_id_fkey" FOREIGN KEY (term_id) REFERENCES public.terms(id) ON DELETE CASCADE;

ALTER TABLE "public"."term_records"
  ADD CONSTRAINT "term_records_term_id_fkey" FOREIGN KEY (term_id) REFERENCES public.terms(id) ON DELETE CASCADE;

ALTER TABLE "public"."terms"
  ADD CONSTRAINT "terms_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."terms"
  ADD CONSTRAINT "terms_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."trait_ratings"
  ADD CONSTRAINT "trait_ratings_enrolment_id_fkey" FOREIGN KEY (enrolment_id) REFERENCES public.enrolments(id) ON DELETE CASCADE;

ALTER TABLE "public"."trait_ratings"
  ADD CONSTRAINT "trait_ratings_school_id_fkey" FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE "public"."trait_ratings"
  ADD CONSTRAINT "trait_ratings_term_id_fkey" FOREIGN KEY (term_id) REFERENCES public.terms(id) ON DELETE CASCADE;

CREATE INDEX attendance_logs_enrolment_idx ON public.attendance_logs USING btree (enrolment_id);

CREATE INDEX attendance_logs_school_date_idx ON public.attendance_logs USING btree (school_id, date);

CREATE INDEX audit_log_school_created_idx ON public.audit_log USING btree (school_id, created_at DESC);

CREATE INDEX classes_school_id_idx ON public.classes USING btree (school_id);

CREATE INDEX idx_families_phone_norm_2 ON public.families USING btree (school_id, phone_normalized_2);

CREATE INDEX idx_families_phone_norm ON public.families USING btree (school_id, phone_normalized);

CREATE INDEX profiles_school_id_idx ON public.profiles USING btree (school_id);

CREATE INDEX students_school_id_idx ON public.students USING btree (school_id);

CREATE INDEX term_records_status_idx ON public.term_records USING btree (status);

CREATE POLICY "attendance_select" ON "public"."attendance_logs"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))));

CREATE POLICY "attendance_write" ON "public"."attendance_logs"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))))
  WITH CHECK (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))));

CREATE POLICY "audit_log_read_same_school" ON "public"."audit_log"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "owner_admin_charges" ON "public"."charges"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "class_subjects_admin_delete" ON "public"."class_subjects"
  FOR DELETE
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "class_subjects_admin_update" ON "public"."class_subjects"
  FOR UPDATE
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "class_subjects_insert" ON "public"."class_subjects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_class(class_id))));

CREATE POLICY "class_subjects_select" ON "public"."class_subjects"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_class(class_id))));

CREATE POLICY "classes_select" ON "public"."classes"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_class(id))));

CREATE POLICY "classes_write" ON "public"."classes"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "enrolments_select" ON "public"."enrolments"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_class(class_id))));

CREATE POLICY "enrolments_write" ON "public"."enrolments"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "owner_admin_families" ON "public"."families"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "owner_admin_fee_items" ON "public"."fee_items"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "grade_bands_admin_write" ON "public"."grade_bands"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "grade_bands_read_same_school" ON "public"."grade_bands"
  FOR SELECT
  TO PUBLIC
  USING ((school_id = public.my_school_id()));

CREATE POLICY "grade_bands_select" ON "public"."grade_bands"
  FOR SELECT
  TO PUBLIC
  USING ((school_id = public.my_school_id()));

CREATE POLICY "grade_bands_write" ON "public"."grade_bands"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "owner_admin_payments" ON "public"."payments"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "profiles_delete" ON "public"."profiles"
  FOR DELETE
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "profiles_select" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING (((id = auth.uid()) OR ((school_id = public.my_school_id()) AND public.is_school_admin())));

CREATE POLICY "profiles_update" ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING (((id = auth.uid()) OR ((school_id = public.my_school_id()) AND public.is_school_admin())));

CREATE POLICY "schools_delete" ON "public"."schools"
  FOR DELETE
  TO PUBLIC
  USING (((id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "schools_select" ON "public"."schools"
  FOR SELECT
  TO PUBLIC
  USING ((id = public.my_school_id()));

CREATE POLICY "schools_update" ON "public"."schools"
  FOR UPDATE
  TO PUBLIC
  USING (((id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "scores_select" ON "public"."scores"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.owns_class_subject(class_subject_id))));

CREATE POLICY "scores_write" ON "public"."scores"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.owns_class_subject(class_subject_id))))
  WITH CHECK (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.owns_class_subject(class_subject_id))));

CREATE POLICY "sessions_admin_write" ON "public"."sessions"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "sessions_read_same_school" ON "public"."sessions"
  FOR SELECT
  TO PUBLIC
  USING ((school_id = public.my_school_id()));

CREATE POLICY "sessions_select" ON "public"."sessions"
  FOR SELECT
  TO PUBLIC
  USING ((school_id = public.my_school_id()));

CREATE POLICY "sessions_write" ON "public"."sessions"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "students_admin_all" ON "public"."students"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "students_select" ON "public"."students"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR ((class_id IS NOT NULL) AND public.teaches_class(class_id)))));

CREATE POLICY "students_teacher_update" ON "public"."students"
  FOR UPDATE
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (class_id IS NOT NULL) AND public.teaches_class(class_id)))
  WITH CHECK (((school_id = public.my_school_id()) AND (class_id IS NOT NULL) AND public.teaches_class(class_id)));

CREATE POLICY "subjects_admin_delete" ON "public"."subjects"
  FOR DELETE
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "subjects_admin_update" ON "public"."subjects"
  FOR UPDATE
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "subjects_insert" ON "public"."subjects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((school_id = public.my_school_id()));

CREATE POLICY "subjects_select" ON "public"."subjects"
  FOR SELECT
  TO PUBLIC
  USING ((school_id = public.my_school_id()));

CREATE POLICY "term_records_select" ON "public"."term_records"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))));

CREATE POLICY "term_records_write" ON "public"."term_records"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))))
  WITH CHECK (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))));

CREATE POLICY "terms_admin_write" ON "public"."terms"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "terms_read_same_school" ON "public"."terms"
  FOR SELECT
  TO PUBLIC
  USING ((school_id = public.my_school_id()));

CREATE POLICY "terms_select" ON "public"."terms"
  FOR SELECT
  TO PUBLIC
  USING ((school_id = public.my_school_id()));

CREATE POLICY "terms_write" ON "public"."terms"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND public.is_school_admin()))
  WITH CHECK (((school_id = public.my_school_id()) AND public.is_school_admin()));

CREATE POLICY "trait_ratings_select" ON "public"."trait_ratings"
  FOR SELECT
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))));

CREATE POLICY "trait_ratings_write" ON "public"."trait_ratings"
  FOR ALL
  TO PUBLIC
  USING (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))))
  WITH CHECK (((school_id = public.my_school_id()) AND (public.is_school_admin() OR public.teaches_enrolment(enrolment_id))));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."charges";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."families";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."payments";

GRANT EXECUTE ON FUNCTION "public"."generate_term_charges_atomic"(uuid, uuid, uuid, jsonb) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."generate_term_charges_atomic"(uuid, uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."generate_term_charges_atomic"(uuid, uuid, uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."generate_term_charges_atomic"(uuid, uuid, uuid, jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."import_families_bulk"(uuid, uuid, uuid, uuid, jsonb) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."import_families_bulk"(uuid, uuid, uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_families_bulk"(uuid, uuid, uuid, uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_families_bulk"(uuid, uuid, uuid, uuid, jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."import_students_atomic"(uuid, uuid, uuid, jsonb) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."import_students_atomic"(uuid, uuid, uuid, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_students_atomic"(uuid, uuid, uuid, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."import_students_atomic"(uuid, uuid, uuid, jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."increment_receipt_counter"(uuid, uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."increment_receipt_counter"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."increment_receipt_counter"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."increment_receipt_counter"(uuid, uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_class_teacher"(uuid) TO PUBLIC, "authenticated";

REVOKE ALL ON FUNCTION "public"."is_class_teacher"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_class_teacher"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_class_teacher"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_school_admin"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."is_school_admin"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_school_admin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_school_admin"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_school_owner"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."is_school_owner"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_school_owner"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_school_owner"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_term_draft"(uuid, uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."is_term_draft"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_term_draft"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_term_draft"(uuid, uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."merge_families_atomic"(uuid, uuid, uuid, uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."merge_families_atomic"(uuid, uuid, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."merge_families_atomic"(uuid, uuid, uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."merge_families_atomic"(uuid, uuid, uuid, uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."my_school_id"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."my_school_id"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."my_school_id"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."my_school_id"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."owns_class_subject"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."owns_class_subject"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_class_subject"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."owns_class_subject"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."promote_user_to_admin"(text) TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."promote_user_to_admin"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."promote_user_to_admin"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."promote_user_to_admin"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."record_payment_atomic"(uuid, uuid, uuid, uuid, numeric, text, text, text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."record_payment_atomic"(uuid, uuid, uuid, uuid, numeric, text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_payment_atomic"(uuid, uuid, uuid, uuid, numeric, text, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_payment_atomic"(uuid, uuid, uuid, uuid, numeric, text, text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."teaches_class"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."teaches_class"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."teaches_class"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."teaches_class"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."teaches_enrolment"(uuid) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."teaches_enrolment"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."teaches_enrolment"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."teaches_enrolment"(uuid) TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attendance_logs" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."attendance_logs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attendance_logs" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attendance_logs" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_log" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."audit_log" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_log" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."audit_log" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."charges" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."charges" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."charges" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."charges" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."class_subjects" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."class_subjects" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."class_subjects" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."class_subjects" TO "service_role";

REVOKE ALL ON TABLE "public"."classes" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."classes" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."classes" TO "authenticated";

REVOKE ALL ON TABLE "public"."classes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."classes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."classes" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."enrolments" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."enrolments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."enrolments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."enrolments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."families" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."families" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."families" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."families" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fee_items" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."fee_items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fee_items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fee_items" TO "service_role";

REVOKE ALL ON TABLE "public"."grade_bands" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."grade_bands" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."grade_bands" TO "authenticated";

REVOKE ALL ON TABLE "public"."grade_bands" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."grade_bands" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."grade_bands" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payments" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."payments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payments" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."profiles" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."receipt_counters" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."receipt_counters" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."receipt_counters" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."receipt_counters" TO "service_role";

REVOKE ALL ON TABLE "public"."schools" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."schools" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."schools" TO "authenticated";

REVOKE ALL ON TABLE "public"."schools" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."schools" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."schools" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scores" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."scores" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scores" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scores" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "service_role";

REVOKE ALL ON TABLE "public"."students" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."students" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."students" TO "authenticated";

REVOKE ALL ON TABLE "public"."students" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."students" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."students" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subjects" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."subjects" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subjects" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."subjects" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."term_records" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."term_records" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."term_records" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."term_records" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."terms" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."terms" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."terms" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."terms" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trait_ratings" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."trait_ratings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trait_ratings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."trait_ratings" TO "service_role";

