-- CreateEnum
CREATE TYPE "AiPlanStatus" AS ENUM (
    'generated',
    'approved',
    'modified',
    'skipped',
    'resolved',
    'failed',
    'expired'
);

-- CreateTable
CREATE TABLE "ai_plan_snapshots" (
    "id" UUID NOT NULL,
    "surface" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "context_version" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "filters_json" JSONB,
    "context_summary" JSONB NOT NULL,
    "output_json" JSONB NOT NULL,
    "reasoning_summary" TEXT,
    "status" "AiPlanStatus" NOT NULL DEFAULT 'generated',
    "generated_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_plan_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_plan_actions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "card_id" TEXT NOT NULL,
    "intent_id" TEXT,
    "action_type" TEXT NOT NULL,
    "status" "AiPlanStatus" NOT NULL DEFAULT 'generated',
    "modified_payload" JSONB,
    "execution_result" JSONB,
    "performed_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_plan_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_alerts" (
    "id" UUID NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "internal_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_plan_snapshots_surface_created_at_idx" ON "ai_plan_snapshots"("surface", "created_at");

-- CreateIndex
CREATE INDEX "ai_plan_snapshots_status_idx" ON "ai_plan_snapshots"("status");

-- CreateIndex
CREATE INDEX "ai_plan_actions_plan_id_idx" ON "ai_plan_actions"("plan_id");

-- CreateIndex
CREATE INDEX "ai_plan_actions_card_id_idx" ON "ai_plan_actions"("card_id");

-- CreateIndex
CREATE INDEX "internal_alerts_audience_status_idx" ON "internal_alerts"("audience", "status");

-- AddForeignKey
ALTER TABLE "ai_plan_actions"
ADD CONSTRAINT "ai_plan_actions_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "ai_plan_snapshots"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
