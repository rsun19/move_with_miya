import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import DashboardClient from '@/components/DashboardClient';
import type { AuthUser, Registration } from '@/lib/types';
import { BACKEND_URL, USER_SERVICE_URL } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Dashboard | Move with Miya',
  description: 'Your Move with Miya dashboard.',
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();

  let user: AuthUser | null = null;
  try {
    const res = await fetch(`${USER_SERVICE_URL}/auth/me`, {
      cache: 'no-store',
      headers: { cookie: cookieString },
    });
    if (res.ok) {
      user = (await res.json()) as AuthUser;
    }
  } catch (error) {
    console.error('Failed to load dashboard user:', error);
  }

  if (!user) {
    redirect('/login');
  }

  let registrations: Registration[] = [];
  try {
    const registrationsResponse = await fetch(
      `${BACKEND_URL}/registration/me`,
      {
        cache: 'no-store',
        headers: { cookie: cookieString },
      },
    );
    if (registrationsResponse.ok) {
      registrations = (await registrationsResponse.json()) as Registration[];
    }
  } catch (error) {
    console.error('Failed to load registrations:', error);
  }

  return <DashboardClient user={user} registrations={registrations} />;
}
