'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { KeyStatusMap } from '@/lib/keys';
import type { PoolUsage } from '@/lib/limits';
import type { AuthUser } from '@/lib/auth';

export type SidebarPlanItem = {
  id: string;
  title: string | null;
  idea: string;
  status: string;
  createdAt: string | Date;
};

export function Sidebar({
  plans,
  currentPlanId,
  isOpen,
  onToggle,
  onOpenSettings,
  onOpenAuthModal,
  savedKeys,
  user,
}: {
  plans: SidebarPlanItem[];
  currentPlanId?: string;
  isOpen: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
  onOpenAuthModal?: () => void;
  savedKeys?: KeyStatusMap | null;
  usage?: PoolUsage | null;
  user?: AuthUser | null;
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [filter, setFilter] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (!confirm('Log out from your account?')) return;
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    } catch {
      setIsLoggingOut(false);
    }
  }

  const planList = useMemo(
    () => plans.filter((p) => !deletedIds.includes(p.id)),
    [plans, deletedIds],
  );

  // Grouping plans by date
  const grouped = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const filtered = query
      ? planList.filter(
          (p) =>
            (p.title && p.title.toLowerCase().includes(query)) ||
            p.idea.toLowerCase().includes(query),
        )
      : planList;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

    const groups: { label: string; items: SidebarPlanItem[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Previous 7 days', items: [] },
      { label: 'Earlier', items: [] },
    ];

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    for (const item of sorted) {
      const time = new Date(item.createdAt).getTime();
      if (time >= startOfToday) {
        groups[0].items.push(item);
      } else if (time >= sevenDaysAgo) {
        groups[1].items.push(item);
      } else {
        groups[2].items.push(item);
      }
    }

    return groups.filter((g) => g.items.length > 0);
  }, [planList, filter]);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this plan?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/plan/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeletedIds((prev) => [...prev, id]);
        if (currentPlanId === id) {
          router.push('/');
        }
      }
    } catch {
      alert('Failed to delete plan.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onToggle}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 h-full bg-[#2b3839] text-gray-200 md:static shrink-0 select-none overflow-hidden ${
          mounted ? 'sidebar-smooth' : ''
        } ${
          isOpen ? 'w-60 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-16'
        }`}
      >
        <div className="relative w-full h-full overflow-hidden">
          {/* EXPANDED VIEW: Locked to 240px (w-60), preventing text reflow during width transition */}
          <div
            className={`absolute inset-y-0 left-0 w-60 min-w-[240px] flex flex-col h-full ${
              isOpen
                ? 'opacity-100 pointer-events-auto transition-opacity duration-150 delay-100 ease-out'
                : 'opacity-0 pointer-events-none transition-opacity duration-100 ease-in'
            }`}
          >
            {/* Top Header */}
            <div className="flex h-14 items-center justify-between px-4 pt-2 shrink-0">
              <Link
                href="/"
                className="text-white font-semibold tracking-tight text-[15px] hover:text-gray-300 transition-colors"
              >
                preflight
              </Link>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowSearch((v) => !v)}
                  title="Search ideas"
                  aria-label="Search ideas"
                  className={`rounded p-1.5 transition-colors ${
                    showSearch ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Hide sidebar"
                  title="Hide sidebar"
                  className="rounded p-1.5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                    <path d="M9 3v18" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Create & Search Section */}
            <div className="px-3 pt-3 shrink-0">
              {showSearch && (
                <div className="mb-3 px-1">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      autoFocus
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search ideas..."
                      className="w-full rounded-md bg-white/10 pl-8 pr-7 py-1.5 text-[12.5px] text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <svg className="absolute left-2.5 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {filter && (
                      <button
                        type="button"
                        onClick={() => setFilter('')}
                        className="absolute right-2 text-xs text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="px-3 pb-2 text-[12px] font-medium uppercase tracking-wider text-gray-400/80">
                Create
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-gray-200 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New chat</span>
                </Link>
              </div>
            </div>

            {/* Plan History List */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-4">
              {grouped.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] text-gray-400">
                  {filter ? 'No matching plans.' : 'No history yet.'}
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400/70">
                      {group.label}
                    </div>
                    <ul className="space-y-0.5">
                      {group.items.map((plan) => {
                        const isActive = plan.id === currentPlanId;
                        return (
                          <li key={plan.id} className="group relative">
                            <Link
                              href={`/plans/${plan.id}`}
                              className={`flex items-center justify-between rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                                isActive
                                  ? 'bg-white/10 font-medium text-white'
                                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <span className="truncate pr-5">
                                {plan.title ?? plan.idea.slice(0, 32)}
                              </span>

                              {plan.status !== 'done' && (
                                <span className="shrink-0 rounded bg-black/20 px-1 py-0.5 text-[10px] text-orange-400 font-mono">
                                  {plan.status === 'error' ? '!' : '...'}
                                </span>
                              )}
                            </Link>

                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, plan.id)}
                              disabled={deletingId === plan.id}
                              title="Delete plan"
                              className="absolute right-1.5 top-1.5 hidden rounded p-1 text-gray-400 hover:text-red-400 group-hover:block transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {/* Profile Footer */}
            <div className="p-3 mt-auto shrink-0 border-t border-white/5">
              {user ? (
                <div className="flex items-center justify-between w-full p-2 rounded-lg text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0 select-none border border-white/10"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-signal text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs select-none">
                        {user.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-white truncate">{user.name}</div>
                      <div className="text-[11px] text-[#8fa8a8] truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      title="Settings"
                      aria-label="Settings"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="4" y1="21" x2="4" y2="14" />
                        <line x1="4" y1="10" x2="4" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12" y2="3" />
                        <line x1="20" y1="21" x2="20" y2="16" />
                        <line x1="20" y1="12" x2="20" y2="3" />
                        <line x1="1" y1="14" x2="7" y2="14" />
                        <line x1="9" y1="8" x2="15" y2="8" />
                        <line x1="17" y1="16" x2="23" y2="16" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      title="Log out"
                      aria-label="Log out"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="flex flex-1 items-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer text-[13px] font-medium border border-white/5 shadow-xs"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span className="truncate">Sign in with Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    title="Settings"
                    aria-label="Settings"
                    className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer border border-white/5"
                  >
                    <svg
                      className="w-4.5 h-4.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="21" x2="4" y2="14" />
                      <line x1="4" y1="10" x2="4" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12" y2="3" />
                      <line x1="20" y1="21" x2="20" y2="16" />
                      <line x1="20" y1="12" x2="20" y2="3" />
                      <line x1="1" y1="14" x2="7" y2="14" />
                      <line x1="9" y1="8" x2="15" y2="8" />
                      <line x1="17" y1="16" x2="23" y2="16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* COLLAPSED VIEW (Desktop): Locked to 64px (w-16) */}
          <div
            className={`hidden md:flex absolute inset-y-0 left-0 w-16 min-w-[64px] flex-col h-full items-center ${
              !isOpen
                ? 'opacity-100 pointer-events-auto transition-opacity duration-150 delay-100 ease-out'
                : 'opacity-0 pointer-events-none transition-opacity duration-100 ease-in'
            }`}
          >
            {/* Top Header */}
            <div className="flex h-14 w-full items-center justify-center pt-2 shrink-0">
              <button
                type="button"
                onClick={onToggle}
                aria-label="Show sidebar"
                title="Show sidebar"
                className="rounded p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                  <path d="M9 3v18" strokeWidth="1.5" />
                </svg>
              </button>
            </div>

            {/* Navigation Section */}
            <div className="pt-3 px-2 flex flex-col items-center gap-1.5 shrink-0">
              <Link
                href="/"
                title="New chat"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <svg className="h-5 w-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>

              <button
                type="button"
                onClick={() => {
                  onToggle();
                  setShowSearch(true);
                }}
                title="Search"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>

            {/* Plan History List */}
            <div className="flex-1 w-full overflow-y-auto no-scrollbar px-2 py-3 flex flex-col items-center gap-1.5">
              <div className="w-6 h-px bg-white/10 my-1 shrink-0" />
              {planList.slice(0, 10).map((plan) => {
                const isActive = plan.id === currentPlanId;
                return (
                  <Link
                    key={plan.id}
                    href={`/plans/${plan.id}`}
                    title={plan.title ?? plan.idea}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </Link>
                );
              })}
            </div>

            {/* Profile Footer */}
            <div className="p-3 mt-auto shrink-0 border-t border-white/5 flex flex-col items-center gap-2">
              {user ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title={`${user.name} (${user.email})`}
                  className="w-8 h-8 rounded-full overflow-hidden border border-white/20 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-signal text-white font-bold text-xs flex items-center justify-center">
                      {user.name[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  title="Sign in with Google"
                  aria-label="Sign in with Google"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSettings}
                title="Settings"
                aria-label="Settings"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
