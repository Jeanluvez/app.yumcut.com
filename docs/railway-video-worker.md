# Railway Video Worker

This repo now includes a dedicated background worker for video rendering.

Important: the current in-repo worker does **not** consume BullMQ jobs directly. It polls
`video_jobs` rows in the database for `pending` work and updates the database itself after
rendering. Redis is still required today because the app enqueues jobs during
`POST /api/projects/[projectId]/video-jobs/create`, and that request currently fails if
`REDIS_URL` is missing.

## Local development

When testing create -> render locally, you must run both the web app and the worker.

Web app:

```bash
cd /Users/jeanzhu/Sprokl
set -a; source .env.local; set +a
REDIS_URL=redis://127.0.0.1:6379 npm run dev -- --port 3001
```

Worker:

```bash
cd /Users/jeanzhu/Sprokl
set -a; source .env.local; set +a
REDIS_URL=redis://127.0.0.1:6379 npm run video-jobs:worker
```

If the worker is not running, newly created video jobs will stay in `pending` even though
`POST /api/projects/[projectId]/video-jobs/create` succeeds.

For debugging one project only, you can target a single project id:

```bash
cd /Users/jeanzhu/Sprokl
set -a; source .env.local; set +a
REDIS_URL=redis://127.0.0.1:6379 npm run video-jobs:worker -- --project-id <project-id>
```

## Runtime

- Railway worker start command: `npm run video-jobs:worker`
- Keep the worker service scaled to **1 instance**.
- Recommended poll interval: `VIDEO_JOB_WORKER_POLL_MS=5000`

## Railway setup

Use the same repo to create **two Railway services**:

1. Web app service
2. Video worker service

Set the start command manually for each service:

Web app:

```bash
npm start
```

Worker:

```bash
npm run video-jobs:worker
```

Do not rely on the repo `Procfile` to choose the correct process automatically. Railway's
current builder flow supports only one default start command per service, so the web app and
worker should be configured explicitly in the Railway dashboard.

Suggested dashboard setup:

1. Create a web service from this repo.
2. Set the web service start command to `npm start`.
3. Create a second service from the same repo for the worker.
4. Set the worker service start command to `npm run video-jobs:worker`.
5. Attach the same Redis instance to both services.
6. Copy the same database and Supabase env vars to both services.
7. Keep the worker at one replica while validating the pipeline.
8. Trigger one real project and watch the worker logs for `processed job ... status=done`.

## Build / deploy packages

The worker requires `ffmpeg` and `ffprobe` at runtime. Railway's current builder supports
installing apt packages through environment variables.

Set these on the worker service:

- `RAILPACK_BUILD_APT_PACKAGES=ffmpeg`
- `RAILPACK_DEPLOY_APT_PACKAGES=ffmpeg`

The worker now checks `ffmpeg` on startup and exits early with a clear error if the binary is
missing or older than `7.1.1`.

If local development uses an older FFmpeg build, the worker only warns by default.
Railway should keep strict mode enabled.

## Required environment

Set the same database and storage variables used by the main app.

Required on both web app and worker:

- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_URL`
- `VIDEO_JOBS_QUEUE_NAME`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `VIDEO_JOB_STATUS_WEBHOOK_SECRET`
- `TTS_PROVIDER`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `VOLCENGINE_TTS_APP_ID`
- `VOLCENGINE_TTS_ACCESS_TOKEN`
- `VOLCENGINE_TTS_CLUSTER`
- `VOLCENGINE_TTS_VOICE_TYPE`

Recommended on the worker:

- `VIDEO_JOB_WORKER_POLL_MS=5000`
- `VIDEO_JOB_WORKER_STRICT_FFMPEG_CHECK=1`

For FFmpeg/FFprobe inside Railway, keep:

- `FFMPEG_BIN=ffmpeg`
- `FFPROBE_BIN=ffprobe`

## Webhook status route

This repo still includes:

- `POST /api/railway/tasks/status`

That route is useful for an external worker that reports status back through HTTP.

The current in-repo Railway worker does **not** use this callback path during normal execution,
because it writes job state directly to the database.

If you later switch to an external worker, send the shared secret through:

- `VIDEO_JOB_STATUS_WEBHOOK_SECRET`

## Behavior

- The app inserts `video_jobs` rows and also enqueues Redis jobs.
- The in-repo worker currently polls the database for `pending` rows.
- It processes one pending job at a time.
- Job status flow is:
  - `pending`
  - `processing`
  - `done`
  - `failed`

If the worker is not running, projects will stay in `generating` and their jobs will remain
in `pending`.

## Local check

You can run the same worker locally with:

```bash
npm run video-jobs:worker
```
