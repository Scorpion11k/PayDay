-- CreateTable
CREATE TABLE "custom_dashboards" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "chart_type" TEXT NOT NULL,
    "chart_config" JSONB NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_dashboards_pkey" PRIMARY KEY ("id")
);
