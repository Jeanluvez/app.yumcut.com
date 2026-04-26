-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('free', 'pro', 'business');

-- CreateEnum
CREATE TYPE "public"."Language" AS ENUM ('en', 'es');

-- CreateEnum
CREATE TYPE "public"."AspectRatio" AS ENUM ('vertical_9_16', 'square_1_1', 'horizontal_16_9');

-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('draft', 'scripts_generated', 'generating', 'done', 'failed');

-- CreateEnum
CREATE TYPE "public"."AssetType" AS ENUM ('video', 'image', 'hook');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" "public"."Plan" NOT NULL DEFAULT 'free',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "generation_count_this_month" INTEGER NOT NULL DEFAULT 0,
    "generation_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storage_used_bytes" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_description" TEXT NOT NULL,
    "selling_points" TEXT NOT NULL,
    "target_audience" TEXT NOT NULL,
    "promo_enabled" BOOLEAN NOT NULL DEFAULT false,
    "promo_info" JSONB,
    "selected_asset_ids" TEXT[],
    "hook_asset_id" TEXT,
    "duration_seconds" INTEGER NOT NULL,
    "aspect_ratio" "public"."AspectRatio" NOT NULL DEFAULT 'vertical_9_16',
    "language" "public"."Language" NOT NULL DEFAULT 'en',
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "type" "public"."AssetType" NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "duration_seconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scripts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "style_label" TEXT NOT NULL,
    "hook_text" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "cta_text" TEXT NOT NULL,
    "estimated_duration_seconds" INTEGER,
    "original_hook_text" TEXT NOT NULL,
    "original_body_text" TEXT NOT NULL,
    "original_cta_text" TEXT NOT NULL,
    "is_selected" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "edited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."video_jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "script_id" TEXT NOT NULL,
    "variant_index" INTEGER NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "voiceover_url" TEXT,
    "tts_timestamps_url" TEXT,
    "raw_footage_url" TEXT,
    "music_url" TEXT,
    "final_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "video_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."videos" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "duration_seconds" INTEGER NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "variant_label" TEXT,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "videos_job_id_key" ON "public"."videos"("job_id");

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scripts" ADD CONSTRAINT "scripts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_jobs" ADD CONSTRAINT "video_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."video_jobs" ADD CONSTRAINT "video_jobs_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."videos" ADD CONSTRAINT "videos_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."videos" ADD CONSTRAINT "videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."videos" ADD CONSTRAINT "videos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
