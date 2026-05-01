'use client';

import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { useMemo } from 'react';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type ClientSession = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    isAdmin: boolean;
  };
} | null;

function getClientDisplayName(user: ReturnType<typeof useUser>['user']): string | null {
  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.username) return user.username;
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

export function useSession(): { data: ClientSession; status: SessionStatus } {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();

  const status: SessionStatus = !isLoaded
    ? 'loading'
    : userId
      ? 'authenticated'
      : 'unauthenticated';

  const data = useMemo<ClientSession>(() => {
    if (!userId) return null;
    return {
      user: {
        id: userId,
        email: user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? null,
        name: getClientDisplayName(user),
        image: user?.imageUrl ?? null,
        isAdmin: false,
      },
    };
  }, [user, userId]);

  return { data, status };
}

export function useAuthActions() {
  const { isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();

  async function startSignIn(provider?: 'google' | 'apple', options?: { mode?: 'sign-in' | 'sign-up' }) {
    const completeUrl =
      options?.mode === 'sign-up'
        ? process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/workspace'
        : process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/workspace';

    if (provider) {
      const authResource =
        options?.mode === 'sign-up'
          ? clerk.client?.signUp
          : clerk.client?.signIn;

      if (!authResource) {
        throw new Error(`Clerk ${options?.mode === 'sign-up' ? 'sign-up' : 'sign-in'} is not ready for ${provider} OAuth.`);
      }

      const strategy = provider === 'google' ? 'oauth_google' : 'oauth_apple';
      await authResource.authenticateWithRedirect({
        strategy,
        redirectUrl: '/sso-callback',
        redirectUrlComplete: completeUrl,
      });
      return;
    }

    await clerk.redirectToSignIn();
  }

  async function startSignOut(options?: { callbackUrl?: string; redirect?: boolean }) {
    if (options?.redirect === false) {
      await clerk.signOut();
      return;
    }

    await clerk.signOut({
      redirectUrl: options?.callbackUrl ?? '/',
    });
  }

  return {
    ready: authLoaded && clerk.loaded && !!clerk.client,
    signIn: startSignIn,
    signOut: startSignOut,
  };
}
