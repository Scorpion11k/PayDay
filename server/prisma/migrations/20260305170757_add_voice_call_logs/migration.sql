-- CreateTable
CREATE TABLE "voice_call_logs" (
    "id" UUID NOT NULL,
    "notification_id" UUID,
    "customer_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "message_text" TEXT NOT NULL,
    "description" TEXT,
    "kol_kasher_call_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "status_code" INTEGER,
    "status_message" TEXT,
    "api_response_body" JSONB,
    "callback_body" JSONB,
    "error_message" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 1,
    "duration" INTEGER,
    "answered_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "voice_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_call_logs_customer_id_idx" ON "voice_call_logs"("customer_id");

-- CreateIndex
CREATE INDEX "voice_call_logs_notification_id_idx" ON "voice_call_logs"("notification_id");

-- CreateIndex
CREATE INDEX "voice_call_logs_status_idx" ON "voice_call_logs"("status");

-- CreateIndex
CREATE INDEX "voice_call_logs_created_at_idx" ON "voice_call_logs"("created_at");

-- AddForeignKey
ALTER TABLE "voice_call_logs" ADD CONSTRAINT "voice_call_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_call_logs" ADD CONSTRAINT "voice_call_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
