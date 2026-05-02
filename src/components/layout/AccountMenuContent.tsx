"use client";
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PopoverClose } from '@/components/ui/popover';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, LogOut, Shield } from 'lucide-react';
import { useAppLanguage } from '@/components/providers/AppLanguageProvider';
import type { AppLanguageCode } from '@/shared/constants/app-language';
import { useAuthActions, useSession } from '@/lib/auth-client';

type AccountMenuCopy = {
  settings: string;
  administrator: string;
  logOut: string;
  signOutTitle: string;
  signOutDescription: string;
  cancel: string;
  loggingOut: string;
};

const COPY: Record<AppLanguageCode, AccountMenuCopy> = {
  en: {
    settings: 'Settings',
    administrator: 'Administrator',
    logOut: 'Log out',
    signOutTitle: 'Sign out',
    signOutDescription: 'Are you sure you want to log out?',
    cancel: 'Cancel',
    loggingOut: 'Logging out…',
  },
  ru: {
    settings: 'Настройки',
    administrator: 'Администратор',
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
  const [signingOut, setSigningOut] = useState(false);
  const name = session?.user?.name?.trim() || session?.user?.email?.split('@')[0] || 'Account';
  const email = session?.user?.email || 'No email';
  const avatarLetter = name.charAt(0).toUpperCase();

  return (
    <>
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="text-sm font-medium text-zinc-100">{t.settings}</div>
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
          <Button asChild variant="ghost" className="h-auto w-full justify-start rounded-xl px-3 py-2.5 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
            <Link href="/account" className="flex w-full items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-xl font-semibold text-zinc-100">
                {avatarLetter}
              </div>
              <div className="min-w-0 text-left">
                <div className="truncate text-base font-medium leading-5 text-zinc-100">{name}</div>
                <div className="truncate text-sm text-zinc-500">{email}</div>
              </div>
            </Link>
          </Button>
        </PopoverClose>
      </div>
      <div className="mx-3 h-px bg-zinc-800/70" />
      <div className="p-1.5">
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-zinc-100 transition hover:bg-zinc-800">
              <LogOut className="h-4 w-4 text-zinc-100" />
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
