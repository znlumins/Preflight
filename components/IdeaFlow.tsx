'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ProviderId } from '@/lib/ai/provider';
import type { Questionnaire } from '@/lib/ai/schemas';
import type { ExampleIdea } from '@/lib/example-ideas';
import type { KeyStatusMap } from '@/lib/keys';
import dynamic from 'next/dynamic';
import SoftBlurIn from '@/components/ui/soft-blur-in';

const DitheringShader = dynamic(
  () => import('@/components/ui/dithering-shader').then((mod) => mod.DitheringShader),
  { ssr: false }
);

/**
 * The entry flow: idea, then a short interview, then generation.
 * Styled matching the exact Figma design layout.
 */

type Step = 'idea' | 'interview';
type Answers = Record<string, string>;

export type ModelOption = {
  id: string;
  provider: ProviderId;
  model: string;
  name: string;
  description: string;
  group: string;
};

const MODEL_OPTIONS: ModelOption[] = [
  // Google models (Bawaan gratis langsung tersedia)
  {
    id: 'google:gemini-flash-lite-latest',
    provider: 'google',
    model: 'gemini-flash-lite-latest',
    name: '3.5 Flash-Lite',
    description: 'Jawaban tercepat',
    group: 'Google',
  },
  {
    id: 'google:gemini-flash-latest',
    provider: 'google',
    model: 'gemini-flash-latest',
    name: '3.6 Flash',
    description: 'Bantuan serbaguna',
    group: 'Google',
  },
  {
    id: 'google:gemini-2.5-pro',
    provider: 'google',
    model: 'gemini-2.5-pro',
    name: '3.1 Pro',
    description: 'Penalaran yang canggih',
    group: 'Google',
  },

  // Pro & Flagship providers (Bisa dibuka dengan API key Anda sendiri)
  {
    id: 'anthropic:claude-3-7-sonnet-latest',
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    description: 'Penalaran hibrida mendalam',
    group: 'Anthropic',
  },
  {
    id: 'openai:gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Tugas kompleks serbaguna',
    group: 'OpenAI',
  },
  {
    id: 'openrouter:deepseek/deepseek-r1',
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    description: 'Reasoning open-weights',
    group: 'OpenRouter',
  },
  {
    id: 'groq:llama-3.3-70b-versatile',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    name: 'LLaMA 3.3 70B',
    description: 'Kilat di Groq LPU',
    group: 'Groq',
  },
];

const STORAGE_KEY = 'preflight_preferred_model';

export function IdeaFlow({
  example,
  savedKeys,
}: {
  example: ExampleIdea;
  savedKeys?: KeyStatusMap | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idea');
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [showConstraints, setShowConstraints] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExitingHero, setIsExitingHero] = useState(false);
  const [shaderReady, setShaderReady] = useState(false);

  useEffect(() => {
    // Gentle deferral so initial DOM render & hero typography reveal is 100% 60fps locked
    const timer = setTimeout(() => setShaderReady(true), 250);
    return () => clearTimeout(timer);
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea up to max 180px, then scroll
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(nextHeight, 38)}px`;
  }, [idea]);

  // Filter model: hanya tampilkan model yang siap digunakan
  // (Google bawaan selalu siap; provider lain hanya muncul jika key-nya sudah dimasukkan & teruji di Pengaturan)
  const availableModels = MODEL_OPTIONS.filter((m) => {
    if (m.provider === 'google') return true;
    return Boolean(savedKeys && savedKeys[m.provider]);
  });

  const selectedModelId = useSyncExternalStore(
    (callback) => {
      window.addEventListener('preflight-model-change', callback);
      window.addEventListener('storage', callback);
      return () => {
        window.removeEventListener('preflight-model-change', callback);
        window.removeEventListener('storage', callback);
      };
    },
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && availableModels.some((m) => m.id === saved)) return saved;
      } catch {}
      return availableModels[0]?.id ?? MODEL_OPTIONS[0].id;
    },
    () => availableModels[0]?.id ?? MODEL_OPTIONS[0].id,
  );

  function handleModelChange(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new Event('preflight-model-change'));
    } catch {}
  }

  const selectedOption =
    availableModels.find((m) => m.id === selectedModelId) ?? availableModels[0] ?? MODEL_OPTIONS[0];

  const tooShort = idea.trim().length < 15;

  async function startInterview() {
    setBusy(true);
    setError(null);
    setIsExitingHero(true);
    try {
      const [res] = await Promise.all([
        fetch('/api/plan/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea,
            context: context || undefined,
            language: 'id',
            provider: selectedOption.provider,
            model: selectedOption.model,
          }),
        }),
        // Ensure exit blur animation is seen smoothly for at least 400ms
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestionnaire(data);
      setStep('interview');
    } catch (err) {
      setIsExitingHero(false);
      setError(err instanceof Error ? err.message : 'Gagal menyiapkan pertanyaan.');
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/plan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          context: context || undefined,
          language: 'id',
          questions: questionnaire,
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
          provider: selectedOption.provider,
          model: selectedOption.model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/plans/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat plan.');
      setBusy(false);
    }
  }

  if (step === 'interview' && questionnaire) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-8 sm:py-12 settle">
        <div className="border-b border-gray-200/80 pb-4">
          <h2 className="text-xl font-semibold text-gray-800">5 Pertanyaan Rancangan</h2>
          <p className="mt-1 text-[14px] text-gray-500">
            Jawabannya menyesuaikan fitur dan arsitektur rencana — lewati jika belum pasti.
          </p>
        </div>

        <ol className="mt-8 space-y-8">
          {questionnaire.questions.map((q, i) => (
            <li key={q.id} className="border-l-2 border-orange-200 pl-4">
              <div className="flex gap-3">
                <span className="mt-0.5 font-mono text-[12px] text-gray-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16.5px] font-medium leading-snug text-gray-900">{q.question}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-gray-500">{q.why}</p>

                  {q.options.length > 0 ? (
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {q.options.map((o) => {
                        const active = answers[q.id] === o.label;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              setAnswers((a) => {
                                const next = { ...a };
                                if (active) delete next[q.id];
                                else next[q.id] = o.label;
                                return next;
                              })
                            }
                            aria-pressed={active}
                            className={`rounded-lg border px-3 py-2 text-[13.5px] leading-snug transition-colors ${
                              active
                                ? 'border-[#f97316] bg-orange-50 font-medium text-[#f97316]'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Jawab singkat saja..."
                      enterKeyHint="next"
                      className="mt-3 w-full max-w-lg border-b border-gray-200 bg-transparent pb-1.5 text-[14.5px] text-gray-800 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {error && <Problem message={error} />}

        <div className="mt-10 flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200/80">
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-[#f97316] px-5 py-2.5 text-[14.5px] font-medium text-white shadow-xs hover:bg-[#ea580c] disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            {busy ? 'Menyusun rencana...' : 'Susun rencana'}
          </button>
          <ModelDropdown
            models={availableModels}
            selectedOption={selectedOption}
            onSelect={handleModelChange}
            disabled={busy}
          />
          <span className="text-[13px] text-gray-500">
            {Object.keys(answers).length} dari {questionnaire.questions.length} terjawab
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col justify-between min-h-[500px] overflow-hidden">
      {/* Subtle animated dithering shader background: fades away on conversation */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-out z-0 overflow-hidden ${
          step !== 'idea' || isExitingHero || !shaderReady ? 'opacity-0' : 'opacity-45'
        }`}
      >
        {shaderReady && (
          <DitheringShader
            shape="wave"
            type="8x8"
            colorBack="#ffffff"
            colorFront="#cbd5e1"
            pxSize={3}
            speed={0.4}
          />
        )}
      </div>

      {/* Center Hero with SoftBlurIn entrance & exit */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center my-auto pb-10">
        <SoftBlurIn
          as="h1"
          isExiting={isExitingHero}
          className="text-3xl sm:text-4xl md:text-[42px] font-semibold text-[#1e293b] tracking-tight"
        >
          What are we building today?
        </SoftBlurIn>
        <SoftBlurIn
          as="p"
          delay={400}
          isExiting={isExitingHero}
          className="mt-2 text-[15px] sm:text-[16px] text-[#64748b]"
        >
          Share your raw concept, get a clear PRD and actionable task list.
        </SoftBlurIn>

        {error && (
          <div className="mt-4 max-w-md">
            <Problem message={error} />
          </div>
        )}
      </div>

      {/* Bottom Podium Container */}
      <div className="relative w-full shrink-0 z-10">
        {/* Dark horizontal base line flanking the podium left & right */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#2b3839]" />

        {/* Center Dark Podium Container */}
        <div className="relative w-full max-w-2xl mx-auto bg-[#2b3839] rounded-t-2xl px-2.5 pt-2.5 pb-2 shadow-2xl z-10">
          {/* White Input Card inside Podium */}
          <div className="rounded-xl bg-white p-3 shadow-xs border-0 outline-none ring-0">
            {/* Optional constraints input */}
            {showConstraints && (
              <div className="mb-2 pb-2 border-b border-gray-100 flex items-center gap-2">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider shrink-0">
                  Konteks:
                </span>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={`Batasannya apa? Misal: ${example.constraints}`}
                  style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
                  className="w-full text-xs text-gray-700 bg-transparent placeholder:text-gray-400 border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                />
              </div>
            )}

            {/* Auto-growing Textarea matching Figma "Ask anything" without any borders */}
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy && !tooShort) startInterview();
                }
              }}
              placeholder="Ask anything"
              rows={1}
              style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              className="w-full resize-none border-0 bg-transparent p-0 text-[14.5px] leading-relaxed text-gray-800 placeholder:text-gray-400 border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 max-h-[180px] overflow-y-auto transition-[height] duration-75"
            />

            {/* Bottom Toolbar inside White Card */}
            <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-gray-100/80">
              {/* Left tools: +, document icon, Preflight 0.0.1 ⌵ */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConstraints((v) => !v)}
                  title="Tambah batasan teknis / context"
                  className={`p-1 text-gray-500 hover:text-gray-800 transition-colors ${
                    showConstraints ? 'text-[#f97316]' : ''
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setIdea(example.idea)}
                  title="Coba contoh ide acak"
                  className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </button>

                <ModelDropdown
                  models={availableModels}
                  selectedOption={selectedOption}
                  onSelect={handleModelChange}
                  disabled={busy}
                />
              </div>

              {/* Right tools: mic + Orange submit button with ↑ */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
                  title="Voice prompt"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={startInterview}
                  disabled={busy || tooShort}
                  aria-label="Kirim"
                  title={tooShort ? 'Tulis minimal satu kalimat utuh' : 'Kirim ide (Enter)'}
                  className="flex items-center justify-center rounded-lg bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-40 p-2 text-white shadow-xs transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Centered disclaimer text from Figma */}
          <p className="mt-2 text-[11px] text-gray-400 text-center select-none">
            Preflight can make mistakes, so double-check it
          </p>
        </div>
      </div>
    </div>
  );
}

function ModelDropdown({
  models,
  selectedOption,
  onSelect,
  disabled,
}: {
  models: ModelOption[];
  selectedOption: ModelOption;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Dark Pill Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Model: ${selectedOption.name}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#27272a] text-white hover:bg-[#323236] active:scale-[0.98] transition-all text-[13px] font-medium shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>{selectedOption.name}</span>
        <svg
          className={`h-3.5 w-3.5 text-gray-300 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Dark Card Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          style={{ colorScheme: 'dark' }}
          className="absolute left-0 bottom-full mb-2 z-50 w-[260px] sm:w-[275px] rounded-2xl border border-white/10 bg-[#18181b] p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="space-y-1">
            {models.map((opt) => {
              const isSelected = opt.id === selectedOption.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(opt.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-start gap-2.5 px-3 py-2 text-left rounded-xl transition-all ${
                    isSelected
                      ? 'border border-white/40 bg-white/[0.06] text-white shadow-xs'
                      : 'hover:bg-white/5 text-gray-200'
                  }`}
                >
                  {/* Left Icon: Checkmark if selected, blank spacer otherwise */}
                  <div className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center">
                    {isSelected ? (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>

                  {/* Title & subtitle */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[13.5px] leading-none ${isSelected ? 'font-semibold text-white' : 'font-medium text-gray-200'}`}>
                        {opt.name}
                      </span>
                    </div>
                    {opt.description && (
                      <p className="mt-1 text-[11.5px] text-gray-400 leading-tight">
                        {opt.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-4 border-l-2 border-red-400 bg-red-50 px-4 py-2.5 text-[13.5px] leading-relaxed text-red-700 rounded-r-md"
    >
      {message}
    </p>
  );
}
