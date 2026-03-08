-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('notification_sent', 'chat_prompt', 'collection_flow_created');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "activity_name" TEXT NOT NULL,
    "description" TEXT,
    "customer_id" UUID,
    "customer_name" TEXT,
    "status" "ActivityStatus" NOT NULL,
    "metadata" JSONB,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_type_idx" ON "activity_logs"("type");

-- CreateIndex
CREATE INDEX "activity_logs_status_idx" ON "activity_logs"("status");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_customer_id_idx" ON "activity_logs"("customer_id");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
