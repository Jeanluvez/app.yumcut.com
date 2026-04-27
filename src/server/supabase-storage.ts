const DEFAULT_STORAGE_BUCKET = 'assets';

function encodeStoragePath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function getSupabaseStorageConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    bucket,
  };
}

export function buildSupabasePublicUrl(path: string) {
  const { supabaseUrl, bucket } = getSupabaseStorageConfig();
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`;
}

export async function uploadFileToSupabaseStorage(params: {
  path: string;
  contentType: string;
  body: ArrayBuffer;
  upsert?: boolean;
}) {
  const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseStorageConfig();
  const objectPath = encodeStoragePath(params.path);
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'content-type': params.contentType,
        'x-upsert': params.upsert ? 'true' : 'false',
      },
      body: Buffer.from(params.body),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase storage upload failed (${response.status}): ${text || response.statusText}`);
  }

  return {
    path: params.path,
    publicUrl: buildSupabasePublicUrl(params.path),
  };
}
