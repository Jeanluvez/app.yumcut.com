"use client";
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PopoverClose } from '@/components/ui/popover';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useTokenSummary } from '@/hooks/useTokenSummary';
import { CONTACT_EMAIL } from '@/shared/constants/app';
import { Activity, Loader2, LogOut, Mail, Shield, User } from 'lucide-react';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import { useAuthActions, useSession } from '@/lib/auth-client';

type AccountMenuCopy = {
  settings: string;
  balance: string;
  tokens: string;
  administrator: string;
  account: string;
  tokenActivity: string;
  support: string;
  logOut: string;
  signOutTitle: string;
  signOutDescription: string;
  cancel: string;
  loggingOut: string;
};

const COPY: Record<AppLanguageCode, AccountMenuCopy> = {
  en: {
    settings: 'Settings',
    balance: 'Balance:',
    tokens: 'tokens',
    administrator: 'Administrator',
    account: 'Account',
    tokenActivity: 'Token activity',
    support: 'Support',
    logOut: 'Log out',
    signOutTitle: 'Sign out',
    signOutDescription: 'Are you sure you want to log out?',
    cancel: 'Cancel',
    loggingOut: 'Logging out…',
  },
  ru: {
    settings: 'Настройки',
    balance: 'Баланс:',
    tokens: 'токенов',
    administrator: 'Администратор',
    account: 'Аккаунт',
    tokenActivity: 'История токенов',
    support: 'Поддержка',
    logOut: 'Выйти',
    signOutTitle: 'Выйти из аккаунта',
    signOutDescription: 'Вы уверены, что хотите выйти?',
    cancel: 'Отмена',
    loggingOut: 'Выходим…',
  },
};

export function AccountMenuContent() {
  const { language } = useAppLanguage();
  const t = COPY[language];
  const { data: session } = useSession();
  const { signOut } = useAuthActions();
  const isAdmin = !!(session?.user as any)?.isAdmin;
  const { loading: tokensLoading, balance: tokenBalance } = useTokenSummary();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <>
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="text-sm font-medium text-zinc-100">{t.settings}</div>
        <div className="mt-2 text-xs text-zinc-500">
          <span>{t.balance}</span>
          <span className="ml-1 font-semibold text-zinc-100">{tokensLoading ? '—' : tokenBalance.toLocaleString()}</span>
          <span className="ml-1">{t.tokens}</span>
        </div>
      </div>
      <div className="p-2 space-y-1">
        {isAdmin ? (
          <PopoverClose asChild>
            <Button asChild variant="ghost" className="w-full justify-start gap-2 text-rose-300 hover:bg-zinc-800 hover:text-rose-200">
              <Link href="/admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>{t.administrator}</span>
              </Link>
            </Button>
          </PopoverClose>
        ) : null}
        <PopoverClose asChild>
          <Button asChild variant="ghost" className="w-full justify-start gap-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
            <Link href="/account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{t.account}</span>
            </Link>
          </Button>
        </PopoverClose>
        <PopoverClose asChild>
          <Button asChild variant="ghost" className="w-full justify-start gap-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
            <Link href="/tokens/activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span>{t.tokenActivity}</span>
            </Link>
          </Button>
        </PopoverClose>
        <PopoverClose asChild>
          <Button asChild variant="ghost" className="w-full justify-start gap-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>{t.support}</span>
            </a>
          </Button>
        </PopoverClose>
      </div>
      <Separator />
      <div>
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex w-full items-center gap-2 px-4 py-3 text-sm text-rose-300 transition hover:bg-zinc-800">
              <LogOut className="h-4 w-4 text-rose-300" />
              <span>{t.logOut}</span>
            </button>
          </DialogTrigger>
          <DialogContent className="border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">{t.signOutTitle}</DialogTitle>
            </DialogHeader>
            <DialogDescription className="text-zinc-400">
              {t.signOutDescription}
            </DialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" className="text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">{t.cancel}</Button>
              </DialogClose>
              <Button
                variant="destructive"
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={signingOut}
                onClick={async () => {
                  if (signingOut) return;
                  setSigningOut(true);
                  try {
                    await signOut({ callbackUrl: '/' });
                  } finally {
                    setSigningOut(false);
                  }
                }}
              >
                {signingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.loggingOut}
                  </>
                ) : (
                  t.logOut
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
