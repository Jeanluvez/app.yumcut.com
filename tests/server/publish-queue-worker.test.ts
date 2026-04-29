import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockProject = {
  id: string;
  promoInfo: Record<string, unknown>;
  videos: Array<{ id: string }>;
  user: {
    channels: Array<{ id: string; status: 'connected' | 'disconnected' }>;
  };
};

const { mockState, prismaMock } = vi.hoisted(() => {
  const state = {
    projects: [] as MockProject[],
  };

  return {
    mockState: state,
    prismaMock: {
      project: {
        findMany: vi.fn(async () => state.projects.map((project) => ({ ...project }))),
        update: vi.fn(async (args: any) => {
          const projectId = args?.where?.id as string;
          const promoInfo = args?.data?.promoInfo as Record<string, unknown>;
          state.projects = state.projects.map((project) =>
            project.id === projectId ? { ...project, promoInfo } : project,
          );
          return state.projects.find((project) => project.id === projectId) ?? null;
        }),
      },
    },
  };
});

vi.mock('@/server/db', () => ({ prisma: prismaMock }));

import { processPublishQueue } from '@/server/publishing/publish-queue-worker';

function setMockProjects(projects: MockProject[]) {
  mockState.projects = projects.map((project) => ({
    ...project,
    promoInfo: JSON.parse(JSON.stringify(project.promoInfo)),
    videos: project.videos.map((video) => ({ ...video })),
    user: {
      channels: project.user.channels.map((channel) => ({ ...channel })),
    },
  }));
}

function readPublishQueue(projectId: string) {
  const project = mockState.projects.find((entry) => entry.id === projectId);
  if (!project) throw new Error(`Missing mock project: ${projectId}`);
  return (project.promoInfo.publishQueue ?? []) as Array<Record<string, unknown>>;
}

describe('processPublishQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    setMockProjects([]);
    prismaMock.project.findMany.mockClear();
    prismaMock.project.update.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions due scheduled items to ready', async () => {
    setMockProjects([
      {
        id: 'project-1',
        promoInfo: {
          publishQueue: [
            {
              id: 'item-1',
              videoId: 'video-1',
              platform: 'tiktok',
              publishAt: '2026-04-29T11:59:00.000Z',
              status: 'scheduled',
              createdAt: '2026-04-29T11:00:00.000Z',
              updatedAt: '2026-04-29T11:00:00.000Z',
            },
          ],
        },
        videos: [{ id: 'video-1' }],
        user: { channels: [] },
      },
    ]);

    const result = await processPublishQueue({ publishReady: false });
    const [item] = readPublishQueue('project-1');

    expect(result).toMatchObject({
      scannedProjects: 1,
      readyTransitions: 1,
      publishedTransitions: 0,
      failedTransitions: 0,
      touchedProjects: 1,
    });
    expect(item.status).toBe('ready');
    expect(item.updatedAt).toBe('2026-04-29T12:00:00.000Z');
  });

  it('publishes ready items and records publish metadata', async () => {
    setMockProjects([
      {
        id: 'project-2',
        promoInfo: {
          publishQueue: [
            {
              id: 'item-2',
              videoId: 'video-2',
              platform: 'youtube_shorts',
              publishAt: '2026-04-29T11:59:00.000Z',
              status: 'ready',
              createdAt: '2026-04-29T11:00:00.000Z',
              updatedAt: '2026-04-29T11:00:00.000Z',
            },
          ],
        },
        videos: [{ id: 'video-2' }],
        user: { channels: [] },
      },
    ]);

    const result = await processPublishQueue({ publishReady: true });
    const [item] = readPublishQueue('project-2');

    expect(result).toMatchObject({
      scannedProjects: 1,
      readyTransitions: 0,
      publishedTransitions: 1,
      failedTransitions: 0,
      touchedProjects: 1,
    });
    expect(item.status).toBe('published');
    expect(item.publishedAt).toBe('2026-04-29T12:00:00.000Z');
    expect(item.lastAttemptAt).toBe('2026-04-29T12:00:00.000Z');
    expect(item.providerPostId).toBe('youtube_shorts-item-2-1777464000000');
    expect(item.publishedUrl).toBeNull();
    expect(item.errorMessage).toBeNull();
  });

  it('fails ready items when the linked channel is disconnected', async () => {
    setMockProjects([
      {
        id: 'project-3',
        promoInfo: {
          publishQueue: [
            {
              id: 'item-3',
              videoId: 'video-3',
              platform: 'instagram_reels',
              channelId: 'channel-3',
              publishAt: '2026-04-29T11:59:00.000Z',
              status: 'ready',
              createdAt: '2026-04-29T11:00:00.000Z',
              updatedAt: '2026-04-29T11:00:00.000Z',
            },
          ],
        },
        videos: [{ id: 'video-3' }],
        user: {
          channels: [{ id: 'channel-3', status: 'disconnected' }],
        },
      },
    ]);

    const result = await processPublishQueue({ publishReady: true });
    const [item] = readPublishQueue('project-3');

    expect(result).toMatchObject({
      scannedProjects: 1,
      readyTransitions: 0,
      publishedTransitions: 0,
      failedTransitions: 1,
      touchedProjects: 1,
    });
    expect(item.status).toBe('failed');
    expect(item.lastAttemptAt).toBe('2026-04-29T12:00:00.000Z');
    expect(item.publishedAt).toBeNull();
    expect(item.providerPostId).toBeNull();
    expect(item.publishedUrl).toBeNull();
    expect(item.errorMessage).toBe('Linked channel is disconnected.');
  });
});
