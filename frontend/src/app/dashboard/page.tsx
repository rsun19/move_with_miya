'use client';

import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
      <div className="flex items-center gap-4 p-4 border rounded-lg">
        {user?.avatarUrl && (
          <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
        )}
        <div>
          <p className="font-medium">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-gray-600">{user?.email}</p>
        </div>
      </div>
    </div>
  );
}
