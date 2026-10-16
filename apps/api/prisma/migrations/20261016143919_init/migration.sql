-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'parent', 'teacher', 'admin', 'reviewer');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "StudentTrack" AS ENUM ('first_timer', 'retaker');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('past', 'original', 'variant');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('draft', 'reviewed', 'live', 'flagged', 'retired');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'reviewed', 'live', 'retired');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('diagnostic', 'short_diagnostic', 'mini_mock', 'full_mock', 'practice', 'speed_drill', 'school_paper');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('guarantee', 'goodwill', 'duplicate', 'error');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('owed', 'paid', 'reversed');

-- CreateEnum
CREATE TYPE "SchoolEventType" AS ENUM ('paper_mock', 'lab_mock');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'pending', 'resolved');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "state" TEXT,
    "school_id" UUID,
    "exam_year" INTEGER,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "user_agent" TEXT,
    "label" TEXT,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "channel" "OtpChannel" NOT NULL DEFAULT 'sms',
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "user_id" UUID NOT NULL,
    "track" "StudentTrack" NOT NULL DEFAULT 'first_timer',
    "last_utme_score" INTEGER,
    "target_university_id" UUID,
    "target_course_id" UUID,
    "daily_minutes" INTEGER,
    "onboarding_done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "student_subjects" (
    "user_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_subjects_pkey" PRIMARY KEY ("user_id","subject_id")
);

-- CreateTable
CREATE TABLE "parent_links" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "parent_phone" TEXT NOT NULL,
    "parent_user_id" UUID,
    "opted_in_at" TIMESTAMP(3),
    "opted_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "question_count_in_exam" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "syllabus_ref" TEXT,
    "weight" DECIMAL(6,5) NOT NULL DEFAULT 0,
    "learnability" DECIMAL(4,3) NOT NULL DEFAULT 1,
    "parent_topic_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "state" TEXT,
    "type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_requirements" (
    "id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "utme_subjects" JSONB NOT NULL,
    "olevel_requirements" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL,
    "cutoff_hint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_config" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_option" CHAR(1) NOT NULL,
    "explanation_correct" TEXT,
    "explanations_wrong" JSONB,
    "difficulty" SMALLINT NOT NULL DEFAULT 2,
    "source" "QuestionSource" NOT NULL,
    "past_year" INTEGER,
    "asset_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" "QuestionStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "author_id" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "reward_given" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "body_md" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "reviewed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TestType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "engine_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_items" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "chosen_option" CHAR(1),
    "is_correct" BOOLEAN,
    "time_spent_ms" INTEGER,
    "answered_at" TIMESTAMP(3),
    "flagged_by_student" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "test_id" UUID,
    "total_low" INTEGER NOT NULL,
    "total_mid" INTEGER NOT NULL,
    "total_high" INTEGER NOT NULL,
    "per_subject" JSONB NOT NULL,
    "inputs_hash" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_mastery" (
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "mastery" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_practised_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_mastery_pkey" PRIMARY KEY ("user_id","topic_id")
);

-- CreateTable
CREATE TABLE "review_queue" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "interval_days" INTEGER NOT NULL DEFAULT 1,
    "ease" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "last_result" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "minutes_planned" INTEGER NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_days" (
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "questions_answered" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_days_pkey" PRIMARY KEY ("user_id","date")
);

-- CreateTable
CREATE TABLE "reported_utme_results" (
    "user_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "per_subject" JSONB NOT NULL,
    "proof_asset_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reported_utme_results_pkey" PRIMARY KEY ("user_id","year")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_kobo" INTEGER NOT NULL,
    "entitlement" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "payer_phone" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "amount_kobo" INTEGER NOT NULL,
    "coupon_id" UUID,
    "referrer_code" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "paystack_reference" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "order_id" UUID,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "percent_off" INTEGER,
    "amount_off_kobo" INTEGER,
    "max_uses" INTEGER,
    "used" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "owner_teacher_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "amount_kobo" INTEGER NOT NULL,
    "approved_by" UUID,
    "paystack_refund_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarantee_claims" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "baseline_prediction_id" UUID,
    "final_prediction_id" UUID,
    "plan_completion_pct" DECIMAL(5,2),
    "eligible" BOOLEAN,
    "decision" TEXT,
    "decided_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guarantee_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "user_id" UUID NOT NULL,
    "verified_at" TIMESTAMP(3),
    "referral_code" TEXT NOT NULL,
    "commission_pct" DECIMAL(5,2) NOT NULL,
    "payout_account_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "teacher_id" UUID,
    "school_id" UUID,
    "name" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_members" (
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_members_pkey" PRIMARY KEY ("class_id","student_id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount_kobo" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'owed',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lga" TEXT,
    "state" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "consent_doc_asset_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_events" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "SchoolEventType" NOT NULL,
    "students_count" INTEGER,
    "report_asset_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "phone" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "provider_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "phone" TEXT,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "assignee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "official_source_url" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "anon_id" TEXT,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "devices_user_id_revoked_at_idx" ON "devices"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_device_id_idx" ON "refresh_tokens"("device_id");

-- CreateIndex
CREATE INDEX "otp_requests_phone_created_at_idx" ON "otp_requests"("phone", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "parent_links_student_id_parent_phone_key" ON "parent_links"("student_id", "parent_phone");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE INDEX "topics_subject_id_idx" ON "topics"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "universities_name_key" ON "universities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "courses_name_key" ON "courses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "course_requirements_university_id_course_id_key" ON "course_requirements"("university_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_config_year_key_key" ON "exam_config"("year", "key");

-- CreateIndex
CREATE INDEX "questions_subject_id_topic_id_status_idx" ON "questions"("subject_id", "topic_id", "status");

-- CreateIndex
CREATE INDEX "question_reports_question_id_status_idx" ON "question_reports"("question_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assets_storage_key_key" ON "assets"("storage_key");

-- CreateIndex
CREATE INDEX "tests_user_id_type_idx" ON "tests"("user_id", "type");

-- CreateIndex
CREATE INDEX "test_items_test_id_idx" ON "test_items"("test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_items_test_id_position_key" ON "test_items"("test_id", "position");

-- CreateIndex
CREATE INDEX "predictions_user_id_created_at_idx" ON "predictions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "topic_mastery_user_id_idx" ON "topic_mastery"("user_id");

-- CreateIndex
CREATE INDEX "review_queue_user_id_due_at_idx" ON "review_queue"("user_id", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_queue_user_id_question_id_key" ON "review_queue"("user_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_plans_user_id_date_key" ON "daily_plans"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_paystack_reference_key" ON "orders"("paystack_reference");

-- CreateIndex
CREATE INDEX "entitlements_user_id_ends_at_idx" ON "entitlements"("user_id", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_referral_code_key" ON "teachers"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "classes_join_code_key" ON "classes"("join_code");

-- CreateIndex
CREATE INDEX "message_log_phone_created_at_idx" ON "message_log"("phone", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "events_name_ts_idx" ON "events"("name", "ts");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_target_university_id_fkey" FOREIGN KEY ("target_university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_target_course_id_fkey" FOREIGN KEY ("target_course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_parent_user_id_fkey" FOREIGN KEY ("parent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_topic_id_fkey" FOREIGN KEY ("parent_topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_requirements" ADD CONSTRAINT "course_requirements_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_requirements" ADD CONSTRAINT "course_requirements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_items" ADD CONSTRAINT "test_items_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_items" ADD CONSTRAINT "test_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reported_utme_results" ADD CONSTRAINT "reported_utme_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_owner_teacher_id_fkey" FOREIGN KEY ("owner_teacher_id") REFERENCES "teachers"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_baseline_prediction_id_fkey" FOREIGN KEY ("baseline_prediction_id") REFERENCES "predictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_final_prediction_id_fkey" FOREIGN KEY ("final_prediction_id") REFERENCES "predictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_members" ADD CONSTRAINT "class_members_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
