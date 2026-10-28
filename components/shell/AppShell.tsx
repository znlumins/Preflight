'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Sidebar, type SidebarPlanItem } from './Sidebar';
import { SettingsModal } from './SettingsModal';
import { AuthModal } from './AuthModal';
import type { KeyStatusMap } from '@/lib/keys';
import type { PoolUsage } from '@/lib/limits';
import type { AuthUser } from '@/lib/auth';

type ShellContextValue = {
  openSettings: () => void;
  openAuthModal: () => void;
  toggleSidebar: () => void;
  sidebarOpen: boolean;
  isIncognito: boolean;
  toggleIncognito: () => void;
  user: AuthUser | null;
};

const ShellContext = createContext<ShellContextValue>({
  openSettings: () => {},
  openAuthModal: () => {},
  toggleSidebar: () => {},
  sidebarOpen: true,
  isIncognito: false,
  toggleIncognito: () => {},
  user: null,
});

export const useAppShell = () => useContext(ShellContext);

const SIDEBAR_STORAGE_KEY = 'preflight_sidebar_open';

export function AppShell({
  children,
  plans,
  currentPlanId,
  savedKeys,
  usage,
  user = null,
  stage = 'ide',
  initialSidebarOpen = true,
}: {
  children: React.ReactNode;
  plans: SidebarPlanItem[];
  currentPlanId?: string;
  savedKeys?: KeyStatusMap | null;
  usage?: PoolUsage | null;
  user?: AuthUser | null;
  stage?: 'ide' | 'prd' | 'task';
  initialSidebarOpen?: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [keys, setKeys] = useState<KeyStatusMap | null>(savedKeys ?? null);
  const [isIncognito, setIsIncognito] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preflight_default_incognito') === 'true';
    }
    return false;
  });

  // Listen to live key changes, settings changes, and theme
  useEffect(() => {
    function applyTheme() {
      try {
        const theme = localStorage.getItem('preflight_theme') || 'system';
        const isDark =
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch {}
    }

    applyTheme();

    // Check for auth status params in URL
    try {
      const params = new URLSearchParams(window.location.search);
      const authErr = params.get('auth_error');
      if (authErr) {
        if (authErr === 'google_credentials_missing') {
          alert(
            'Konfigurasi Google OAuth belum diisi di .env.local (GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET).',
          );
        } else if (authErr === 'database_error') {
          alert('Gagal menghubungkan ke database produksi (Supabase sedang paused / dijeda). Silakan aktifkan / unpause database di dashboard Supabase.');
        } else {
          alert(`Gagal masuk dengan Google (${authErr}). Silakan coba lagi.`);
        }
        window.history.replaceState({}, '', window.location.pathname);
      } else if (params.get('auth_success')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {}

    function handleKeysChange(e: Event) {
      const custom = e as CustomEvent<KeyStatusMap>;
      if (custom.detail) setKeys(custom.detail);
    }
    function handleSettingsChange() {
      try {
        const incognitoDefault = localStorage.getItem('preflight_default_incognito') === 'true';
        setIsIncognito(incognitoDefault);
      } catch {}
      applyTheme();
    }
    window.addEventListener('preflight-keys-change', handleKeysChange);
    window.addEventListener('preflight-settings-change', handleSettingsChange);
    return () => {
      window.removeEventListener('preflight-keys-change', handleKeysChange);
      window.removeEventListener('preflight-settings-change', handleSettingsChange);
    };
  }, []);

  const sidebarOpen = useSyncExternalStore(
    (callback) => {
      window.addEventListener('preflight-sidebar-change', callback);
      window.addEventListener('storage', callback);
      return () => {
        window.removeEventListener('preflight-sidebar-change', callback);
        window.removeEventListener('storage', callback);
      };
    },
    () => {
      try {
        const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (saved !== null) return saved === 'true';
        if (window.innerWidth < 768) return false;
      } catch {}
      return initialSidebarOpen;
    },
    () => initialSidebarOpen,
  );

  function toggleSidebar() {
    const nextState = !sidebarOpen;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextState));
      document.cookie = `preflight_sidebar_open=${nextState}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new Event('preflight-sidebar-change'));
    } catch {}
  }

  // Global Ctrl+B shortcut to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  // Ensure the outer window never scrolls when inside AppShell
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <ShellContext.Provider
      value={{
        openSettings: () => setSettingsOpen(true),
        openAuthModal: () => setAuthModalOpen(true),
        toggleSidebar,
        sidebarOpen,
        isIncognito,
        toggleIncognito: () => {
          setIsIncognito((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('preflight_default_incognito', String(next));
              window.dispatchEvent(new CustomEvent('preflight-settings-change'));
            } catch {}
            return next;
          });
        },
        user,
      }}
    >
      {/* Outer base container: Dark slate teal from Figma - fixed inset-0 ensures full viewport without window scrolling */}
      <div className="fixed inset-0 flex overflow-hidden bg-[#2b3839]">
        {/* Figma Sidebar */}
        <Sidebar
          plans={plans}
          currentPlanId={currentPlanId}
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          savedKeys={keys}
          usage={usage}
          user={user}
        />

        {/* Main Canvas: Rounded top-left card */}
        <div data-canvas="main" className="flex flex-1 flex-col min-w-0 h-full overflow-hidden bg-white text-[#0f172a] rounded-tl-[24px] shadow-lg border-l border-t border-black/5 [color-scheme:light]">
          {/* Top Bar with Stepper */}
          <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6">
            {/* Left toggle on mobile (when sidebar is offscreen) */}
            <div className="flex items-center md:hidden">
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Buka sidebar"
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                    <path d="M9 3v18" strokeWidth="1.5" />
                  </svg>
                </button>
              )}
            </div>

            {/* Perfectly Centered Stepper from Figma: ● Ide ────── ● PDR ────── ● Task */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 text-[13px] font-medium select-none">
              <div className="flex items-center gap-1.5 text-gray-700">
                <span className="h-2 w-2 rounded-full bg-gray-700" />
                <span>Idea</span>
              </div>

              {/* Line 1 */}
              <div
                className={`w-10 sm:w-16 h-[1.5px] ${
                  stage === 'prd' || stage === 'task' ? 'bg-[#f97316]' : 'bg-gray-300'
                }`}
              />

              {/* PDR */}
              <div
                className={`flex items-center gap-1.5 ${
                  stage === 'prd' || stage === 'task' ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    stage === 'prd' || stage === 'task' ? 'bg-gray-700' : 'bg-gray-400'
                  }`}
                />
                <span>PDR</span>
              </div>

              {/* Line 2 */}
              <div
                className={`w-10 sm:w-16 h-[1.5px] ${
                  stage === 'task' ? 'bg-[#f97316]' : 'bg-gray-300'
                }`}
              />

              {/* Task */}
              <div
                className={`flex items-center gap-1.5 ${
                  stage === 'task' ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    stage === 'task' ? 'bg-gray-700' : 'bg-gray-400'
                  }`}
                />
                <span>Task</span>
              </div>
            </div>

            {/* Right: Incognito Chat Toggle */}
            <div className="flex items-center ml-auto">
              <button
                type="button"
                onClick={() => setIsIncognito((prev) => !prev)}
                title={
                  isIncognito
                    ? 'Keluar dari Incognito Chat'
                    : 'Aktifkan Incognito Chat'
                }
                aria-label={
                  isIncognito
                    ? 'Keluar dari Incognito Chat'
                    : 'Aktifkan Incognito Chat'
                }
                className={`relative flex items-center justify-center h-8 w-8 rounded-lg transition-colors cursor-pointer ${
                  isIncognito
                    ? 'bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
              >
                {isIncognito ? (
                  <svg
                    className="h-4.5 w-4.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
                    <circle cx="9" cy="10" r="1.25" fill="currentColor" stroke="none" />
                    <circle cx="15" cy="10" r="1.25" fill="currentColor" stroke="none" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {children}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialKeys={keys}
        usage={usage ?? null}
        plans={plans}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </ShellContext.Provider>
  );
}
