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

  async function sendEmailCode(
    email: string,
    options?: { mode?: 'sign-in' | 'sign-up'; password?: string },
  ) {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      throw new Error('Email is required.');
    }

    if (options?.mode === 'sign-up') {
      const signUp = clerk.client?.signUp;
      if (!signUp) {
        throw new Error('Clerk sign-up is not ready for email verification.');
      }

      const password = options?.password?.trim();
      await signUp.create({
        emailAddress: normalizedEmail,
        ...(password ? { password } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      return;
    }

    const signIn = clerk.client?.signIn;
    if (!signIn) {
      throw new Error('Clerk sign-in is not ready for email verification.');
    }

    await signIn.create({ identifier: normalizedEmail });
    const emailCodeFactor = signIn.supportedFirstFactors?.find(
      (factor) => factor.strategy === 'email_code' && 'emailAddressId' in factor,
    );

    if (!emailCodeFactor || !('emailAddressId' in emailCodeFactor)) {
      throw new Error('Email code sign-in is not enabled in Clerk.');
    }

    await signIn.prepareFirstFactor({
      strategy: 'email_code',
      emailAddressId: emailCodeFactor.emailAddressId,
    });
  }

  async function resendEmailCode(
    email: string,
    options?: { mode?: 'sign-in' | 'sign-up'; password?: string },
  ) {
    return sendEmailCode(email, options);
  }

  async function verifyEmailCode(code: string, options?: { mode?: 'sign-in' | 'sign-up' }) {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new Error('Verification code is required.');
    }

    if (options?.mode === 'sign-up') {
      const signUp = clerk.client?.signUp;
      if (!signUp) {
        throw new Error('Clerk sign-up is not ready for email verification.');
      }

      const result = await signUp.attemptEmailAddressVerification({ code: normalizedCode });
      if (result.status !== 'complete' || !result.createdSessionId) {
        const missing = Array.isArray(result.missingFields) && result.missingFields.length > 0
          ? ` Missing fields: ${result.missingFields.join(', ')}.`
          : '';
        const unverified = Array.isArray(result.unverifiedFields) && result.unverifiedFields.length > 0
          ? ` Unverified fields: ${result.unverifiedFields.join(', ')}.`
          : '';
        throw new Error(`Email verification is not complete yet. Status: ${result.status}.${missing}${unverified}`);
      }

      await clerk.setActive({
        session: result.createdSessionId,
        redirectUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/workspace',
      });
      return;
    }

    const signIn = clerk.client?.signIn;
    if (!signIn) {
      throw new Error('Clerk sign-in is not ready for email verification.');
    }

    const result = await signIn.attemptFirstFactor({
      strategy: 'email_code',
      code: normalizedCode,
    });

    if (result.status !== 'complete' || !result.createdSessionId) {
      throw new Error(`Email verification is not complete yet. Status: ${result.status}.`);
    }

    await clerk.setActive({
      session: result.createdSessionId,
      redirectUrl: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/workspace',
    });
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
    sendEmailCode,
    resendEmailCode,
    verifyEmailCode,
    signOut: startSignOut,
  };
}
