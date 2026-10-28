'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { KeyStatusMap } from '@/lib/keys';
import type { PoolUsage } from '@/lib/limits';
import type { ProviderId } from '@/lib/ai/provider';
import type { SidebarPlanItem } from './Sidebar';

type SettingsTab = 'general' | 'models' | 'mcp' | 'appearance' | 'shortcuts';
type AgentType = 'claude' | 'cursor' | 'antigravity' | 'windsurf' | 'vscode';

const PROVIDERS = [
  {
    id: 'google' as const,
    name: 'Google AI Studio',
    href: 'https://aistudio.google.com/apikey',
    detail: 'Sekitar 500 permintaan/hari (Gemini 2.5 Flash & Flash-Lite). Gratis, tanpa kartu kredit.',
    placeholder: 'AIza…',
  },
  {
    id: 'anthropic' as const,
    name: 'Anthropic Claude',
    href: 'https://console.anthropic.com/settings/keys',
    detail: 'Model Claude 3.7 Sonnet & 3.5 Haiku. Reasoning & arsitektur coding terbaik.',
    placeholder: 'sk-ant-…',
  },
  {
    id: 'openai' as const,
    name: 'OpenAI',
    href: 'https://platform.openai.com/api-keys',
    detail: 'Model GPT-4o & GPT-4o-mini. Fleksibel, tangguh, dan standar industri.',
    placeholder: 'sk-…',
  },
  {
    id: 'openrouter' as const,
    name: 'OpenRouter (Universal)',
    href: 'https://openrouter.ai/keys',
    detail: 'Akses 100+ model AI sekaligus: DeepSeek R1, Llama 3.3, Qwen, Claude, dll.',
    placeholder: 'sk-or-…',
  },
  {
    id: 'groq' as const,
    name: 'Groq',
    href: 'https://console.groq.com/keys',
    detail: 'Inference ultra-cepat (Llama 3.3 70B OSS), batas throughput lebih ketat.',
    placeholder: 'gsk_…',
  },
];

const PROVIDER_NAMES: Record<ProviderId, string> = {
  google: 'Google AI Studio',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
};

const AGENTS: { id: AgentType; name: string; file: string; desc: string }[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    file: '.mcp.json di root proyek, atau ~/.claude.json',
    desc: 'Jalankan `claude` di terminal, agent langsung mendeteksi tool Preflight.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    file: '.cursor/mcp.json atau Cursor Settings → Features → MCP',
    desc: 'Ketik di Composer: "kerjakan rencana Preflight-ku".',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    file: 'MCP settings / mcp_config.json',
    desc: 'Terintegrasi langsung sebagai universal MCP server.',
  },
  {
    id: 'windsurf',
    name: 'Windsurf (Cascade)',
    file: '~/.codeium/windsurf/mcp_config.json',
    desc: 'Cascade akan otomatis menggunakan tools `preflight_*`.',
  },
  {
    id: 'vscode',
    name: 'VS Code / Roo Code / Cline',
    file: 'cline_mcp_settings.json atau .vscode/mcp.json',
    desc: 'Dukungan MCP standar untuk ekstensi AI agent di VS Code.',
  },
];

export function SettingsModal({
  isOpen,
  onClose,
  initialKeys,
  usage,
  plans = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  initialKeys: KeyStatusMap | null;
  usage?: PoolUsage | null;
  plans?: SidebarPlanItem[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [keys, setKeys] = useState<KeyStatusMap | null>(initialKeys);

  // General settings state (persisted in localStorage)
  const [clarifyMode, setClarifyMode] = useState<'ask' | 'skip'>('ask');
  const [specDepth, setSpecDepth] = useState<'full' | 'standard' | 'mvp'>('full');
  const [docLanguage, setDocLanguage] = useState<'id' | 'en' | 'mixed'>('id');
  const [defaultIncognito, setDefaultIncognito] = useState(false);

  // Models / BYOK state
  const [activeProvider, setActiveProvider] = useState<ProviderId>('google');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  // MCP / Agent Token state
  const [activeAgent, setActiveAgent] = useState<AgentType>('cursor');
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [tokenHint, setTokenHint] = useState<string | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Appearance state
  const [themeMode, setThemeMode] = useState<'dark' | 'system' | 'light'>('dark');
  const [enableDithering, setEnableDithering] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedClarify = localStorage.getItem('preflight_clarify_mode') as 'ask' | 'skip' | null;
      if (savedClarify) setClarifyMode(savedClarify);

      const savedDepth = localStorage.getItem('preflight_spec_depth') as 'full' | 'standard' | 'mvp' | null;
      if (savedDepth) setSpecDepth(savedDepth);

      const savedLang = localStorage.getItem('preflight_doc_language') as 'id' | 'en' | 'mixed' | null;
      if (savedLang) setDocLanguage(savedLang);

      const savedIncognito = localStorage.getItem('preflight_default_incognito');
      if (savedIncognito !== null) setDefaultIncognito(savedIncognito === 'true');

      const savedShader = localStorage.getItem('preflight_shader_enabled');
      if (savedShader !== null) setEnableDithering(savedShader === 'true');

      const savedTheme = localStorage.getItem('preflight_theme') as 'dark' | 'system' | 'light' | null;
      if (savedTheme) setThemeMode(savedTheme);
    } catch {}
  }, []);

  // Sync keys, preferences & agent token status when opened
  useEffect(() => {
    if (isOpen) {
      try {
        const savedIncognito = localStorage.getItem('preflight_default_incognito');
        if (savedIncognito !== null) setDefaultIncognito(savedIncognito === 'true');
      } catch {}

      fetch('/api/key')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setKeys(data);
        })
        .catch(() => {});

      fetch('/api/agent-token')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.hint) setTokenHint(data.hint);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      clearTimeout(copyTimer.current);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function updateClarifyMode(mode: 'ask' | 'skip') {
    setClarifyMode(mode);
    try {
      localStorage.setItem('preflight_clarify_mode', mode);
      window.dispatchEvent(new CustomEvent('preflight-settings-change'));
    } catch {}
  }

  function updateSpecDepth(depth: 'full' | 'standard' | 'mvp') {
    setSpecDepth(depth);
    try {
      localStorage.setItem('preflight_spec_depth', depth);
      window.dispatchEvent(new CustomEvent('preflight-settings-change'));
    } catch {}
  }

  function updateDocLanguage(lang: 'id' | 'en' | 'mixed') {
    setDocLanguage(lang);
    try {
      localStorage.setItem('preflight_doc_language', lang);
      window.dispatchEvent(new CustomEvent('preflight-settings-change'));
    } catch {}
  }

  function toggleDefaultIncognito() {
    const next = !defaultIncognito;
    setDefaultIncognito(next);
    try {
      localStorage.setItem('preflight_default_incognito', String(next));
      window.dispatchEvent(new CustomEvent('preflight-settings-change'));
    } catch {}
  }

  function toggleShader() {
    const next = !enableDithering;
    setEnableDithering(next);
    try {
      localStorage.setItem('preflight_shader_enabled', String(next));
      window.dispatchEvent(new CustomEvent('preflight-shader-change'));
      window.dispatchEvent(new CustomEvent('preflight-settings-change'));
    } catch {}
  }

  function updateTheme(mode: 'dark' | 'system' | 'light') {
    setThemeMode(mode);
    try {
      localStorage.setItem('preflight_theme', mode);
      const isDark =
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new CustomEvent('preflight-settings-change'));
    } catch {}
  }

  async function handleSaveKey() {
    if (!apiKeyInput.trim()) return;
    setIsSavingKey(true);
    setKeyError(null);
    setKeySuccess(null);
    try {
      const res = await fetch('/api/key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: activeProvider, apiKey: apiKeyInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan API key');
      setKeys(data);
      setApiKeyInput('');
      setKeySuccess(`Kunci ${PROVIDER_NAMES[activeProvider]} berhasil disimpan!`);
      window.dispatchEvent(new CustomEvent('preflight-keys-change', { detail: data }));
      setTimeout(() => setKeySuccess(null), 3500);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Gagal menyimpan key.');
    } finally {
      setIsSavingKey(false);
    }
  }

  async function handleDeleteKey(pId: ProviderId) {
    if (!confirm(`Hapus API key untuk ${PROVIDER_NAMES[pId]}?`)) return;
    setIsSavingKey(true);
    setKeyError(null);
    try {
      const res = await fetch('/api/key', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeys(data);
      window.dispatchEvent(new CustomEvent('preflight-keys-change', { detail: data }));
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Gagal menghapus key.');
    } finally {
      setIsSavingKey(false);
    }
  }

  async function handleIssueAgentToken() {
    setIsGeneratingToken(true);
    try {
      const res = await fetch('/api/agent-token', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.token) {
        setAgentToken(data.token);
        if (data.status?.hint) setTokenHint(data.status.hint);
      }
    } catch {}
    finally {
      setIsGeneratingToken(false);
    }
  }

  async function handleRevokeAgentToken() {
    if (!confirm('Cabut token MCP agent ini? Coding agent yang sedang tersambung tidak akan bisa menarik task lagi.')) return;
    try {
      await fetch('/api/agent-token', { method: 'DELETE' });
      setAgentToken(null);
      setTokenHint(null);
    } catch {}
  }

  const selectedProviderMeta = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0];
  const savedKeysList = keys ? Object.values(keys).filter(Boolean) : [];
  const hasByok = savedKeysList.length > 0;

  // MCP snippet generator
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const effectiveToken = agentToken ?? (tokenHint ? `<token-${tokenHint}>` : '<klik-buat-token-di-bawah>');
  const mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        preflight: {
          command: 'npx',
          args: ['-y', 'mcp-handler', `${currentOrigin}/api/mcp/sse`],
          env: {
            PREFLIGHT_TOKEN: effectiveToken,
          },
        },
      },
    },
    null,
    2,
  );

  function copyMcpConfig() {
    navigator.clipboard.writeText(mcpConfigSnippet);
    setCopiedSnippet(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedSnippet(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none">
      {/* Backdrop without blur */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Settings Modal Window - Clean White Theme */}
      <div
        className="relative z-10 flex h-[630px] max-h-[92vh] w-full max-w-[960px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl shadow-black/20 antialiased no-scrollbar [color-scheme:light]"
        style={{ colorScheme: 'light' }}
      >
        {/* Left Sidebar */}
        <aside className="flex w-56 sm:w-64 shrink-0 flex-col justify-between border-r border-gray-200 bg-gray-50/80 p-3 text-[13px]">
          <div className="space-y-4 overflow-y-auto no-scrollbar pr-1">
            {/* Group: Pengaturan */}
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Pengaturan
              </div>
              <nav className="mt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left transition-colors cursor-pointer ${
                    activeTab === 'general'
                      ? 'bg-white font-medium text-gray-900 shadow-xs border border-gray-200/70'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  Umum & Alur Rencana
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('models')}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-colors cursor-pointer ${
                    activeTab === 'models'
                      ? 'bg-white font-medium text-gray-900 shadow-xs border border-gray-200/70'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span>Model AI & API Key</span>
                  {hasByok && (
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shadow-xs" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('mcp')}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-colors cursor-pointer ${
                    activeTab === 'mcp'
                      ? 'bg-white font-medium text-gray-900 shadow-xs border border-gray-200/70'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span>Integrasi Agent (MCP)</span>
                  {tokenHint && (
                    <span className="text-[10.5px] rounded bg-teal-50 text-teal-700 px-1 py-0.5 font-mono border border-teal-200">
                      aktif
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left transition-colors cursor-pointer ${
                    activeTab === 'appearance'
                      ? 'bg-white font-medium text-gray-900 shadow-xs border border-gray-200/70'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  Tampilan & Visual
                </button>
              </nav>
            </div>

            {/* Group: Rencana Saya */}
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Rencana Saya ({plans.length})
              </div>
              <nav className="mt-1 space-y-0.5">
                {plans.length === 0 ? (
                  <div className="px-3 py-1 text-[12px] text-gray-400 italic">
                    Belum ada rencana dibuat
                  </div>
                ) : (
                  plans.slice(0, 4).map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/plans/${plan.id}`);
                      }}
                      className="flex w-full items-center truncate rounded-lg px-3 py-1.5 text-left text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                      title={plan.title || plan.idea}
                    >
                      <span className="truncate">{plan.title || plan.idea}</span>
                    </button>
                  ))
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/');
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-1 text-[12px] text-teal-600 hover:text-teal-700 transition-colors cursor-pointer"
                >
                  <span>+ Buat Rencana Baru</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Bottom Sidebar: Shortcuts & Documentation */}
          <div className="border-t border-gray-200 pt-2 space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('shortcuts')}
              className={`flex w-full items-center rounded-lg px-3 py-1.5 text-left transition-colors cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-white font-medium text-gray-900 shadow-xs border border-gray-200/70'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Pintasan Keyboard
            </button>
            <Link
              href="/docs"
              onClick={onClose}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <span>Dokumentasi</span>
              <span className="text-[11px] text-gray-400">↗</span>
            </Link>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="relative flex flex-1 flex-col overflow-y-auto no-scrollbar bg-white p-6 sm:p-8">
          {/* Close button in top-right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="absolute top-6 right-6 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* TAB: GENERAL (UMUM) */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">Umum & Alur Rencana</h1>
                <p className="mt-1 text-[13px] text-gray-500">
                  Konfigurasikan bagaimana AI membantu kamu menyusun rencana arsitektur dan spesifikasi aplikasi.
                </p>
              </div>

              {/* Alur Perencanaan */}
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Alur Perencanaan (Workflow)
                </h2>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-gray-50/50">
                  {/* Mode Klarifikasi Pertanyaan */}
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="text-[13.5px] font-medium text-gray-900">
                        Pertanyaan Klarifikasi Ide
                      </div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        Apakah AI perlu mengajukan pertanyaan sebelum menyusun dokumen PRD lengkap?
                      </div>
                    </div>

                    <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-[12px] shrink-0">
                      <button
                        type="button"
                        onClick={() => updateClarifyMode('ask')}
                        className={`rounded-md px-3 py-1 font-medium transition-colors cursor-pointer ${
                          clarifyMode === 'ask'
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Tanyakan Dulu
                      </button>
                      <button
                        type="button"
                        onClick={() => updateClarifyMode('skip')}
                        className={`rounded-md px-3 py-1 font-medium transition-colors cursor-pointer ${
                          clarifyMode === 'skip'
                            ? 'bg-white text-gray-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Langsung Buat PRD
                      </button>
                    </div>
                  </div>

                  {/* Kedalaman PRD */}
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="text-[13.5px] font-medium text-gray-900">Kedalaman Spesifikasi</div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        Tingkat rincian dokumen arsitektur, user stories, dan daftar task coding.
                      </div>
                    </div>

                    <select
                      value={specDepth}
                      onChange={(e) => updateSpecDepth(e.target.value as any)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-900 outline-none cursor-pointer hover:border-gray-300 transition-colors shadow-2xs"
                    >
                      <option value="full">Lengkap (PRD + Arsitektur + Tasks)</option>
                      <option value="standard">Standar (PRD + Checklist)</option>
                      <option value="mvp">Ringkas (MVP Prototype Cepat)</option>
                    </select>
                  </div>

                  {/* Bahasa Dokumen */}
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="text-[13.5px] font-medium text-gray-900">Bahasa Keluaran Dokumen</div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        Bahasa utama yang digunakan AI saat menyusun PRD dan prompt coding agent.
                      </div>
                    </div>

                    <select
                      value={docLanguage}
                      onChange={(e) => updateDocLanguage(e.target.value as any)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-900 outline-none cursor-pointer hover:border-gray-300 transition-colors shadow-2xs"
                    >
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                      <option value="mixed">Bilingual (Tech English)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Privasi & Keamanan */}
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Privasi & Keamanan
                </h2>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-gray-50/50">
                  {/* Default Incognito */}
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="text-[13.5px] font-medium text-gray-900">Mode Incognito Otomatis</div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        Jangan simpan riwayat chat dan rencana baru ke database secara otomatis.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={toggleDefaultIncognito}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        defaultIncognito ? 'bg-teal-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          defaultIncognito ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MODELS (API KEY & BYOK) */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">Model AI & API Key (BYOK)</h1>
                <p className="mt-1 text-[13px] text-gray-500">
                  Pasang kunci provider kamu sendiri agar bebas dari batasan kuota bersama dan dapat memakai model reasoning tercanggih.
                </p>
              </div>

              {/* Active Keys Overview */}
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Kunci Provider Tersimpan
                </h2>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  {savedKeysList.length > 0 ? (
                    <div className="space-y-2">
                      {savedKeysList.map((k) => (
                        <div
                          key={k.provider}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="h-2 w-2 rounded-full bg-teal-500 shadow-xs" />
                            <span className="text-[13.5px] font-medium text-gray-900">
                              {PROVIDER_NAMES[k.provider]}
                            </span>
                            <span className="font-mono text-[11.5px] text-gray-400">({k.hint})</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteKey(k.provider)}
                            disabled={isSavingKey}
                            className="text-[12px] text-red-500 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[13px] text-gray-500">
                      {usage ? (
                        <span>
                          Kuota gratis tersisa <strong className="text-gray-900 font-medium">{usage.sessionRemaining} rencana</strong> hari ini.
                        </span>
                      ) : (
                        'Belum ada API key tersimpan.'
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Configure API Key */}
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Tambah / Ubah API Key
                </h2>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
                  <div>
                    <label className="text-[12.5px] font-medium text-gray-700 block mb-2">
                      Pilih Provider:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PROVIDERS.map((p) => {
                        const isSelected = activeProvider === p.id;
                        const isSaved = !!keys?.[p.id];
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setActiveProvider(p.id);
                              setApiKeyInput('');
                              setKeyError(null);
                            }}
                            className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'border-teal-600 bg-teal-50/80 text-teal-950 ring-1 ring-teal-600'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-[13px] font-medium flex items-center gap-1.5">
                              {p.name}
                              {isSaved && (
                                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3 text-[12.5px] text-gray-600 border border-gray-200 shadow-2xs">
                    <p>{selectedProviderMeta.detail}</p>
                    <a
                      href={selectedProviderMeta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-teal-600 hover:underline font-medium"
                    >
                      Buka konsol {selectedProviderMeta.name} untuk ambil API key ↗
                    </a>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12.5px] font-medium text-gray-700 block">
                      Tempel API Key untuk {selectedProviderMeta.name}:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={selectedProviderMeta.placeholder}
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] text-gray-900 placeholder-gray-400 outline-none focus:border-teal-600 transition-colors shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={handleSaveKey}
                        disabled={isSavingKey || !apiKeyInput.trim()}
                        className="rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 px-4 py-2 text-[13px] font-medium text-white transition-colors cursor-pointer shrink-0 shadow-2xs"
                      >
                        {isSavingKey ? 'Menyimpan…' : 'Simpan Key'}
                      </button>
                    </div>

                    {keyError && (
                      <p className="text-[12px] text-red-500 mt-1">{keyError}</p>
                    )}
                    {keySuccess && (
                      <p className="text-[12px] text-teal-600 mt-1">{keySuccess}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MCP / AGENT INTEGRATION */}
          {activeTab === 'mcp' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">Integrasi Coding Agent (MCP)</h1>
                <p className="mt-1 text-[13px] text-gray-500">
                  Hubungkan Preflight ke AI editor favoritmu agar coding agent (Cursor, Claude Code, Antigravity, dll.) dapat langsung mengeksekusi rencana tanpa copy-paste manual.
                </p>
              </div>

              {/* Agent Token Management */}
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Kredensial Sesi MCP
                </h2>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[13.5px] font-medium text-gray-900">Token Akses Agent</div>
                      <div className="mt-0.5 text-[12px] text-gray-500">
                        {tokenHint
                          ? `Token aktif terpasang (akhiran ...${tokenHint}).`
                          : 'Belum ada token aktif. Buat token baru untuk menghubungkan editor.'}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleIssueAgentToken}
                        disabled={isGeneratingToken}
                        className="rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors cursor-pointer shadow-2xs"
                      >
                        {isGeneratingToken ? 'Membuat…' : tokenHint ? 'Buat Token Baru' : 'Buat Token'}
                      </button>
                      {tokenHint && (
                        <button
                          type="button"
                          onClick={handleRevokeAgentToken}
                          className="rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer"
                        >
                          Cabut
                        </button>
                      )}
                    </div>
                  </div>

                  {agentToken && (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <div className="text-[12px] font-medium text-amber-800">
                        ⚠️ Salin token ini sekarang (hanya ditampilkan sekali):
                      </div>
                      <div className="mt-1 font-mono text-[11.5px] text-gray-900 break-all select-all bg-white p-2 rounded border border-amber-200 shadow-2xs">
                        {agentToken}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent Configuration Snippet */}
              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Konfigurasi untuk Editor
                </h2>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
                  {/* Agent Tabs */}
                  <div className="flex flex-wrap gap-2">
                    {AGENTS.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => setActiveAgent(agent.id)}
                        className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors cursor-pointer ${
                          activeAgent === agent.id
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {agent.name}
                      </button>
                    ))}
                  </div>

                  {/* Selected Agent info */}
                  <div className="text-[12.5px] text-gray-600">
                    <span className="font-semibold text-gray-900">Lokasi file:</span>{' '}
                    <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11.5px] text-teal-700 border border-gray-200">
                      {AGENTS.find((a) => a.id === activeAgent)?.file}
                    </code>
                    <p className="mt-1 text-gray-500">
                      {AGENTS.find((a) => a.id === activeAgent)?.desc}
                    </p>
                  </div>

                  {/* Code snippet */}
                  <div className="relative rounded-lg bg-gray-950 border border-gray-800 p-3">
                    <pre className="font-mono text-[11.5px] text-teal-300 overflow-x-auto no-scrollbar">
                      {mcpConfigSnippet}
                    </pre>
                    <button
                      type="button"
                      onClick={copyMcpConfig}
                      className="absolute top-2.5 right-2.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1 text-[11px] font-medium text-gray-200 transition-colors cursor-pointer"
                    >
                      {copiedSnippet ? '✓ Tersalin' : 'Salin JSON'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: APPEARANCE (TAMPILAN) */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">Tampilan & Visual</h1>
                <p className="mt-1 text-[13px] text-gray-500">
                  Sesuaikan preferensi efek visual dan animasi latar belakang aplikasi.
                </p>
              </div>

              <div>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Efek Visual & Animasi
                </h2>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13.5px] font-medium text-gray-900">Animasi Gelombang Shader</div>
                      <div className="text-[12px] text-gray-500">
                        Tampilkan efek gelombang shader dithering di halaman awal penyusunan ide.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={toggleShader}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        enableDithering ? 'bg-teal-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          enableDithering ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SHORTCUTS (PINTASAN KEYBOARD) */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">Pintasan Keyboard</h1>
                <p className="mt-1 text-[13px] text-gray-500">
                  Gunakan pintasan keyboard untuk navigasi cepat dan efisien saat menyusun rencana.
                </p>
              </div>

              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-gray-50/50 text-[13px]">
                <div className="flex items-center justify-between p-3.5">
                  <span className="text-gray-700">Tutup jendela / modal aktif</span>
                  <kbd className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-600 shadow-2xs">
                    Esc
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-3.5">
                  <span className="text-gray-700">Buka / Sembunyikan Sidebar</span>
                  <kbd className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-600 shadow-2xs">
                    Ctrl + B
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-3.5">
                  <span className="text-gray-700">Kirim ide / Lanjutkan ke tahap berikutnya</span>
                  <kbd className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-600 shadow-2xs">
                    Ctrl + Enter
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-3.5">
                  <span className="text-gray-700">Buka Pengaturan</span>
                  <kbd className="rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-600 shadow-2xs">
                    Klik Ikon Sliders
                  </kbd>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
