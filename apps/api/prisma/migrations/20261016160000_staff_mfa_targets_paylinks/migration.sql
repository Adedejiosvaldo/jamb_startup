-- AlterTable
ALTER TABLE "course_requirements" ADD COLUMN     "cutoff_score" INTEGER;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "mfa_verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pay_link_token" TEXT;

-- AlterTable
ALTER TABLE "parent_links" ADD COLUMN     "last_report_sent_at" TIMESTAMP(3),
ADD COLUMN     "report_token" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "parent_links" ALTER COLUMN "report_token" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "device_type" TEXT,
ADD COLUMN     "target_score" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totp_enabled_at" TIMESTAMP(3),
ADD COLUMN     "totp_secret" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_pay_link_token_key" ON "orders"("pay_link_token");

-- CreateIndex
CREATE UNIQUE INDEX "parent_links_report_token_key" ON "parent_links"("report_token");

