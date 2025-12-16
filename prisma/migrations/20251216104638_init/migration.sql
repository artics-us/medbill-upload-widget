-- CreateTable
CREATE TABLE "case_progress_events" (
    "id" BIGSERIAL NOT NULL,
    "submission_id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "step_key" TEXT NOT NULL,
    "step_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "user_agent" TEXT,
    "ip" INET,

    CONSTRAINT "case_progress_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "case_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "current_step" TEXT,
    "progress" JSONB NOT NULL DEFAULT '{}',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "hospital_name" TEXT,
    "balance_amount" DECIMAL(65,30),
    "in_collections" BOOLEAN,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_progress_events_submission_id_key" ON "case_progress_events"("submission_id");

-- CreateIndex
CREATE INDEX "ix_case_progress_events_case_time" ON "case_progress_events"("case_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "ix_case_progress_events_step_time" ON "case_progress_events"("step_key", "received_at" DESC);

-- CreateIndex
CREATE INDEX "gin_case_progress_events_payload" ON "case_progress_events" USING GIN ("payload");

-- CreateIndex
CREATE INDEX "ix_cases_updated_at" ON "cases"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "ix_cases_contact_email" ON "cases"("contact_email");

-- CreateIndex
CREATE INDEX "gin_cases_progress" ON "cases" USING GIN ("progress");
