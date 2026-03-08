-- CreateEnum
CREATE TYPE "TemplateLanguage" AS ENUM ('en', 'he', 'ar');

-- CreateEnum
CREATE TYPE "TemplateTone" AS ENUM ('calm', 'medium', 'heavy');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "CollectionFlowStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "CollectionFlowActionType" AS ENUM ('none', 'assigned_channel', 'send_email', 'send_sms', 'send_whatsapp', 'voice_call');

-- CreateEnum
CREATE TYPE "CollectionFlowConditionType" AS ENUM ('time_elapsed');

-- CreateEnum
CREATE TYPE "CollectionFlowInstanceStatus" AS ENUM ('running', 'completed_paid', 'completed_end', 'failed');

-- CreateEnum
CREATE TYPE "CollectionFlowStateInstanceStatus" AS ENUM ('upcoming', 'waiting', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "CollectionFlowAssignmentSource" AS ENUM ('default_assigned', 'manual_override');

-- CreateEnum
CREATE TYPE "SystemMode" AS ENUM ('demo', 'development', 'production');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "preferred_channel" "NotificationChannel",
ADD COLUMN     "preferred_language" "TemplateLanguage",
ADD COLUMN     "preferred_tone" "TemplateTone";

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "language" "TemplateLanguage" NOT NULL,
    "tone" "TemplateTone" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "body_html" TEXT,
    "body_text" TEXT NOT NULL,
    "placeholders" TEXT[],
    "status" "TemplateStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_flows" (
    "id" UUID NOT NULL,
    "flow_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CollectionFlowStatus" NOT NULL DEFAULT 'draft',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collection_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_flow_states" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "state_key" TEXT NOT NULL,
    "state_name" TEXT NOT NULL,
    "action_name" TEXT NOT NULL,
    "action_type" "CollectionFlowActionType" NOT NULL,
    "tone" "TemplateTone",
    "explicit_channel" "NotificationChannel",
    "is_start" BOOLEAN NOT NULL DEFAULT false,
    "is_end" BOOLEAN NOT NULL DEFAULT false,
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collection_flow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_flow_transitions" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "from_state_id" UUID NOT NULL,
    "to_state_id" UUID NOT NULL,
    "condition_type" "CollectionFlowConditionType" NOT NULL DEFAULT 'time_elapsed',
    "wait_seconds" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collection_flow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_flow_assignments" (
    "customer_id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "source" "CollectionFlowAssignmentSource" NOT NULL DEFAULT 'default_assigned',
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collection_flow_assignments_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "collection_flow_instances" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "current_state_id" UUID,
    "status" "CollectionFlowInstanceStatus" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "next_evaluation_at" TIMESTAMPTZ,
    "last_evaluated_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collection_flow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_flow_state_instances" (
    "id" UUID NOT NULL,
    "flow_instance_id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "status" "CollectionFlowStateInstanceStatus" NOT NULL DEFAULT 'upcoming',
    "due_at" TIMESTAMPTZ,
    "entered_at" TIMESTAMPTZ,
    "executed_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "notification_id" UUID,
    "taken_transition_id" UUID,
    "error_message" TEXT,
    "attempt_no" INTEGER NOT NULL DEFAULT 0,
    "sequence_no" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collection_flow_state_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "mode" "SystemMode" NOT NULL DEFAULT 'demo',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_templates_channel_idx" ON "message_templates"("channel");

-- CreateIndex
CREATE INDEX "message_templates_language_idx" ON "message_templates"("language");

-- CreateIndex
CREATE INDEX "message_templates_tone_idx" ON "message_templates"("tone");

-- CreateIndex
CREATE INDEX "message_templates_status_idx" ON "message_templates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_key_channel_language_tone_key" ON "message_templates"("key", "channel", "language", "tone");

-- CreateIndex
CREATE INDEX "collection_flows_status_idx" ON "collection_flows"("status");

-- CreateIndex
CREATE INDEX "collection_flows_is_default_idx" ON "collection_flows"("is_default");

-- CreateIndex
CREATE UNIQUE INDEX "collection_flows_flow_key_version_key" ON "collection_flows"("flow_key", "version");

-- CreateIndex
CREATE INDEX "collection_flow_states_flow_id_idx" ON "collection_flow_states"("flow_id");

-- CreateIndex
CREATE INDEX "collection_flow_states_flow_id_is_start_idx" ON "collection_flow_states"("flow_id", "is_start");

-- CreateIndex
CREATE INDEX "collection_flow_states_flow_id_is_end_idx" ON "collection_flow_states"("flow_id", "is_end");

-- CreateIndex
CREATE UNIQUE INDEX "collection_flow_states_flow_id_state_key_key" ON "collection_flow_states"("flow_id", "state_key");

-- CreateIndex
CREATE INDEX "collection_flow_transitions_flow_id_from_state_id_idx" ON "collection_flow_transitions"("flow_id", "from_state_id");

-- CreateIndex
CREATE INDEX "collection_flow_transitions_flow_id_to_state_id_idx" ON "collection_flow_transitions"("flow_id", "to_state_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_flow_transitions_from_state_id_priority_key" ON "collection_flow_transitions"("from_state_id", "priority");

-- CreateIndex
CREATE INDEX "collection_flow_assignments_flow_id_idx" ON "collection_flow_assignments"("flow_id");

-- CreateIndex
CREATE INDEX "collection_flow_assignments_source_idx" ON "collection_flow_assignments"("source");

-- CreateIndex
CREATE INDEX "collection_flow_instances_customer_id_status_idx" ON "collection_flow_instances"("customer_id", "status");

-- CreateIndex
CREATE INDEX "collection_flow_instances_status_next_evaluation_at_idx" ON "collection_flow_instances"("status", "next_evaluation_at");

-- CreateIndex
CREATE INDEX "collection_flow_state_instances_status_due_at_idx" ON "collection_flow_state_instances"("status", "due_at");

-- CreateIndex
CREATE INDEX "collection_flow_state_instances_flow_instance_id_sequence_n_idx" ON "collection_flow_state_instances"("flow_instance_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "collection_flow_state_instances_flow_instance_id_state_id_key" ON "collection_flow_state_instances"("flow_instance_id", "state_id");

-- AddForeignKey
ALTER TABLE "collection_flow_states" ADD CONSTRAINT "collection_flow_states_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "collection_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_transitions" ADD CONSTRAINT "collection_flow_transitions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "collection_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_transitions" ADD CONSTRAINT "collection_flow_transitions_from_state_id_fkey" FOREIGN KEY ("from_state_id") REFERENCES "collection_flow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_transitions" ADD CONSTRAINT "collection_flow_transitions_to_state_id_fkey" FOREIGN KEY ("to_state_id") REFERENCES "collection_flow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_assignments" ADD CONSTRAINT "collection_flow_assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_assignments" ADD CONSTRAINT "collection_flow_assignments_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "collection_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_instances" ADD CONSTRAINT "collection_flow_instances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_instances" ADD CONSTRAINT "collection_flow_instances_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "collection_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_instances" ADD CONSTRAINT "collection_flow_instances_current_state_id_fkey" FOREIGN KEY ("current_state_id") REFERENCES "collection_flow_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_state_instances" ADD CONSTRAINT "collection_flow_state_instances_flow_instance_id_fkey" FOREIGN KEY ("flow_instance_id") REFERENCES "collection_flow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_state_instances" ADD CONSTRAINT "collection_flow_state_instances_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "collection_flow_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_state_instances" ADD CONSTRAINT "collection_flow_state_instances_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_flow_state_instances" ADD CONSTRAINT "collection_flow_state_instances_taken_transition_id_fkey" FOREIGN KEY ("taken_transition_id") REFERENCES "collection_flow_transitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
