-- AlterTable
ALTER TABLE "school_events" ADD COLUMN     "coupon_code" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "paper" JSONB;

-- CreateTable
CREATE TABLE "school_event_entries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "student_name" TEXT NOT NULL,
    "class_name" TEXT,
    "parent_phone" TEXT,
    "user_id" UUID,
    "answers" JSONB NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_event_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_event_entries_event_id_idx" ON "school_event_entries"("event_id");

-- AddForeignKey
ALTER TABLE "school_event_entries" ADD CONSTRAINT "school_event_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "school_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

