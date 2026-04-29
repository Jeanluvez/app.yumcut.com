-- CreateEnum
CREATE TYPE "public"."ChannelPlatform" AS ENUM ('tiktok', 'instagram_reels', 'youtube_shorts');

-- CreateEnum
CREATE TYPE "public"."ChannelStatus" AS ENUM ('connected', 'disconnected');

-- CreateTable
CREATE TABLE "public"."channel_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" "public"."ChannelPlatform" NOT NULL,
    "display_name" TEXT NOT NULL,
    "handle" TEXT,
    "status" "public"."ChannelStatus" NOT NULL DEFAULT 'connected',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."channel_connections" ADD CONSTRAINT "channel_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
