'use client';

import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { Sidebar, type SidebarPlanItem } from './Sidebar';
import { SettingsModal } from './SettingsModal';
import type { KeyStatusMap } from '@/lib/keys';
import type { PoolUsage } from '@/lib/limits';

type ShellContextValue = {
  openSettings: () => void;
  toggleSidebar: () => void;
  sidebarOpen: boolean;
};

const ShellContext = createContext<ShellContextValue>({
  openSettings: () => {},
  toggleSidebar: () => {},
  sidebarOpen: true,
});

export const useAppShell = () => useContext(ShellContext);

const SIDEBAR_STORAGE_KEY = 'preflight_sidebar_open';

export function AppShell({
  children,
  plans,
  currentPlanId,
  savedKeys,
  usage,
  stage = 'ide',
  initialSidebarOpen = true,
}: {
  children: React.ReactNode;
  plans: SidebarPlanItem[];
  currentPlanId?: string;
  savedKeys?: KeyStatusMap | null;
  usage?: PoolUsage | null;
  stage?: 'ide' | 'prd' | 'task';
  initialSidebarOpen?: boolean;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  return (
    <ShellContext.Provider
      value={{
        openSettings: () => setSettingsOpen(true),
        toggleSidebar,
        sidebarOpen,
      }}
    >
      {/* Outer base container: Dark slate teal from Figma */}
      <div className="flex h-screen w-screen overflow-hidden bg-[#2b3839]">
        {/* Figma Sidebar */}
        <Sidebar
          plans={plans}
          currentPlanId={currentPlanId}
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          onOpenSettings={() => setSettingsOpen(true)}
          savedKeys={savedKeys}
          usage={usage}
        />

        {/* Main Canvas: Rounded top-left card */}
        <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden bg-white rounded-tl-[24px] shadow-2xl">
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

            {/* Right: Tuning / Sliders settings icon from Figma */}
            <div className="flex items-center ml-auto">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="Pengaturan"
                aria-label="Pengaturan"
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
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
        initialKeys={savedKeys ?? null}
        usage={usage ?? null}
      />
    </ShellContext.Provider>
  );
}
