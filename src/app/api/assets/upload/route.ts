import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/server/api-user';
import { prisma } from '@/server/db';
import { error, forbidden, ok, unauthorized } from '@/server/http';
import { withApiError } from '@/server/errors';
import { uploadFileToSupabaseStorage } from '@/server/supabase-storage';

const formSchema = z.object({
  projectId: z.string().uuid(),
  assetType: z.enum(['image', 'video', 'hook']).optional(),
});

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function sanitizeFilename(filename: string) {
  const cleaned = filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'upload.bin';
}

function resolveAssetLimits(assetType: 'image' | 'video' | 'hook') {
  if (assetType === 'image') {
    return {
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
    };
  }
  return {
    allowedMimeTypes: VIDEO_MIME_TYPES,
    maxBytes: MAX_VIDEO_BYTES,
  };
}

function inferAssetType(file: File): 'image' | 'video' | null {
  if (IMAGE_MIME_TYPES.includes(file.type)) return 'image';
  if (VIDEO_MIME_TYPES.includes(file.type)) return 'video';
  return null;
}

function resolveAssetExpiryDays(plan: 'free' | 'pro' | 'business') {
  if (plan === 'business') return 90;
  if (plan === 'pro') return 30;
  return 7;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApiError(async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth) return unauthorized();

  const formData = await req.formData();
  const parsed = formSchema.safeParse({
    projectId: formData.get('projectId'),
    assetType: formData.get('assetType') || undefined,
  });
  if (!parsed.success) {
    return error('VALIDATION_ERROR', 'Invalid asset upload payload', 400, parsed.error.flatten());
  }

  const fileValue = formData.get('file');
  if (!(fileValue instanceof File)) {
    return error('VALIDATION_ERROR', 'File is required', 400);
  }

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, userId: auth.userId },
    select: { id: true, userId: true },
  });
  if (!project) {
    return forbidden('Project not found or not accessible');
  }

  const inferredType = inferAssetType(fileValue);
  const assetType = parsed.data.assetType || inferredType;
  if (!assetType) {
    return error('VALIDATION_ERROR', 'Unsupported file type', 400);
  }

  const { allowedMimeTypes, maxBytes } = resolveAssetLimits(assetType);
  if (!allowedMimeTypes.includes(fileValue.type)) {
    return error('VALIDATION_ERROR', `Unsupported MIME type: ${fileValue.type || 'unknown'}`, 400);
  }
  if (fileValue.size <= 0) {
    return error('VALIDATION_ERROR', 'Uploaded file is empty', 400);
  }
  if (fileValue.size > maxBytes) {
    return error('VALIDATION_ERROR', `File exceeds the ${Math.floor(maxBytes / 1024 / 1024)}MB limit`, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, plan: true, storageUsedBytes: true },
  });
  if (!user) {
    return unauthorized();
  }

  const safeName = sanitizeFilename(fileValue.name);
  const storagePath = `users/${auth.userId}/projects/${project.id}/${Date.now()}-${safeName}`;
  const upload = await uploadFileToSupabaseStorage({
    path: storagePath,
    contentType: fileValue.type || 'application/octet-stream',
    body: await fileValue.arrayBuffer(),
  });

  const expiresAt = new Date(Date.now() + resolveAssetExpiryDays(user.plan) * 24 * 60 * 60 * 1000);
  const created = await prisma.asset.create({
    data: {
      userId: auth.userId,
      projectId: project.id,
      type: assetType,
      filename: fileValue.name,
      storageUrl: upload.publicUrl,
      sizeBytes: BigInt(fileValue.size),
      mimeType: fileValue.type || 'application/octet-stream',
      expiresAt,
    },
    select: {
      id: true,
      projectId: true,
      type: true,
      filename: true,
      storageUrl: true,
      thumbnailUrl: true,
      sizeBytes: true,
      mimeType: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      storageUsedBytes: user.storageUsedBytes + BigInt(fileValue.size),
    },
  });

  return ok({
    id: created.id,
    projectId: created.projectId,
    type: created.type,
    filename: created.filename,
    storageUrl: created.storageUrl,
    thumbnailUrl: created.thumbnailUrl,
    sizeBytes: created.sizeBytes.toString(),
    mimeType: created.mimeType,
    expiresAt: created.expiresAt.toISOString(),
    createdAt: created.createdAt.toISOString(),
  }, { status: 201 });
}, 'Failed to upload asset');
