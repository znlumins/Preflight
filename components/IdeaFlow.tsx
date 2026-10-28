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
import { useAppShell } from '@/components/shell/AppShell';

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
    id: 'google:gemini-3.8-flash',
    provider: 'google',
    model: 'gemini-3.8-flash',
    name: '3.8 Flash',
    description: 'Model Google terbaru & terlengkap',
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
    id: 'groq:openai/gpt-oss-120b',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    description: 'Model open-source flagship di Groq LPU',
    group: 'Groq',
  },
  {
    id: 'groq:qwen/qwen3.8-27b',
    provider: 'groq',
    model: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    description: 'Ringan & kilat di Groq LPU',
    group: 'Groq',
  },
];

const STORAGE_KEY = 'preflight_preferred_model';

async function processImageFile(file: File): Promise<{ id: string; name: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            dataUrl: e.target?.result as string,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          dataUrl,
        });
      };
      img.onerror = () => {
        resolve({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          dataUrl: e.target?.result as string,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function IdeaFlow({
  example,
  savedKeys,
}: {
  example: ExampleIdea;
  savedKeys?: KeyStatusMap | null;
}) {
  const router = useRouter();
  const { isIncognito } = useAppShell();
  const [step, setStep] = useState<Step>('idea');
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [showConstraints, setShowConstraints] = useState(false);
  const [images, setImages] = useState<Array<{ id: string; name: string; dataUrl: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExitingHero, setIsExitingHero] = useState(false);
  const [shaderReady, setShaderReady] = useState(false);

  async function handleAddFiles(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith('image/')).slice(0, 4 - images.length);
    if (imageFiles.length === 0) return;

    try {
      const processed = await Promise.all(imageFiles.map(processImageFile));
      setImages((prev) => [...prev, ...processed].slice(0, 4));
    } catch (err) {
      console.error('Failed to process image:', err);
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await handleAddFiles(files);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      await handleAddFiles(files);
    }
  }

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

  const [keys, setKeys] = useState<KeyStatusMap | null>(savedKeys ?? null);

  // Listen to live key changes
  useEffect(() => {
    function handleKeysChange(e: Event) {
      const custom = e as CustomEvent<KeyStatusMap>;
      if (custom.detail) setKeys(custom.detail);
    }
    window.addEventListener('preflight-keys-change', handleKeysChange);
    return () => window.removeEventListener('preflight-keys-change', handleKeysChange);
  }, []);

  // Listen to live shader toggle
  const isShaderEnabled = useSyncExternalStore(
    (callback) => {
      window.addEventListener('preflight-settings-change', callback);
      window.addEventListener('storage', callback);
      return () => {
        window.removeEventListener('preflight-settings-change', callback);
        window.removeEventListener('storage', callback);
      };
    },
    () => {
      try {
        const saved = localStorage.getItem('preflight_shader_enabled');
        if (saved !== null) return saved === 'true';
      } catch {}
      return true;
    },
    () => true,
  );

  // Filter model: hanya tampilkan model yang siap digunakan
  // (Google bawaan selalu siap; provider lain hanya muncul jika key-nya sudah dimasukkan & teruji di Pengaturan)
  const availableModels = MODEL_OPTIONS.filter((m) => {
    if (m.provider === 'google') return true;
    return Boolean(keys && keys[m.provider]);
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

  const tooShort = images.length > 0 ? idea.trim().length < 3 : idea.trim().length < 15;

  function getDocLanguage(): 'id' | 'en' {
    try {
      const saved = localStorage.getItem('preflight_doc_language');
      if (saved === 'en') return 'en';
    } catch {}
    return 'id';
  }

  function getEnrichedContext(rawContext: string): string | undefined {
    let depth = 'full';
    let langSetting = 'id';
    try {
      depth = localStorage.getItem('preflight_spec_depth') ?? 'full';
      langSetting = localStorage.getItem('preflight_doc_language') ?? 'id';
    } catch {}

    const instructions: string[] = [];
    if (depth === 'mvp') {
      instructions.push('Format spesifikasi: MVP Ringkas (fokus pada fitur inti paling esensial dan task coding minimal untuk rilis cepat).');
    } else if (depth === 'standard') {
      instructions.push('Format spesifikasi: Standar (PRD terstruktur dengan checklist fitur utama dan task coding esensial).');
    } else if (depth === 'full') {
      instructions.push('Format spesifikasi: Lengkap & Detail (PRD komprehensif, arsitektur teknis menyeluruh, user stories terperinci, dan daftar task coding granular).');
    }

    if (langSetting === 'mixed') {
      instructions.push('Bahasa dokumen: Bilingual (Gunakan istilah teknis, tech stack, dan instruksi prompt terminal dalam Bahasa Inggris standar industri, dipadukan dengan penjelasan arsitektur dalam Bahasa Indonesia yang lugas).');
    }

    const appended = instructions.join(' ');
    if (!rawContext.trim() && !appended) return undefined;
    if (!rawContext.trim()) return appended;
    if (!appended) return rawContext.trim();
    return `${rawContext.trim()}\n\n[Preferensi]: ${appended}`;
  }

  async function handleSubmit() {
    if (busy || tooShort) return;
    let clarify = 'ask';
    try {
      clarify = localStorage.getItem('preflight_clarify_mode') ?? 'ask';
    } catch {}

    if (clarify === 'skip') {
      await generateDirectly();
    } else {
      await startInterview();
    }
  }

  async function generateDirectly() {
    setBusy(true);
    setError(null);
    setIsExitingHero(true);
    const lang = getDocLanguage();
    try {
      const res = await fetch('/api/plan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          context: getEnrichedContext(context),
          language: lang,
          provider: selectedOption.provider,
          model: selectedOption.model,
          images: images.length > 0 ? images.map((i) => i.dataUrl) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/plans/${data.planId}`);
    } catch (err) {
      setIsExitingHero(false);
      setError(err instanceof Error ? err.message : 'Gagal membuat rencana.');
      setBusy(false);
    }
  }

  async function startInterview() {
    setBusy(true);
    setError(null);
    setIsExitingHero(true);
    const lang = getDocLanguage();
    try {
      const [res] = await Promise.all([
        fetch('/api/plan/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idea,
            context: getEnrichedContext(context),
            language: lang,
            provider: selectedOption.provider,
            model: selectedOption.model,
            images: images.length > 0 ? images.map((i) => i.dataUrl) : undefined,
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
    const lang = getDocLanguage();
    try {
      const res = await fetch('/api/plan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          context: getEnrichedContext(context),
          language: lang,
          questions: questionnaire,
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
          provider: selectedOption.provider,
          model: selectedOption.model,
          images: images.length > 0 ? images.map((i) => i.dataUrl) : undefined,
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

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-200/80">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-[#f97316] px-5 py-2.5 text-[14.5px] font-medium text-white shadow-xs hover:bg-[#ea580c] disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer"
            >
              {busy ? 'Menyusun rencana...' : 'Susun rencana'}
            </button>
            <span className="text-[13px] text-gray-500">
              {Object.keys(answers).length} dari {questionnaire.questions.length} terjawab
            </span>
          </div>

          <span className="text-[12px] text-gray-400 font-mono">
            Model: {selectedOption.name}
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
          step !== 'idea' || isExitingHero || !shaderReady
            ? 'opacity-0'
            : isIncognito
            ? 'opacity-35'
            : 'opacity-45'
        }`}
      >
        {shaderReady && isShaderEnabled && (
          <DitheringShader
            key={isIncognito ? 'incognito-red-wave' : 'default-wave'}
            shape="wave"
            type="8x8"
            colorBack="#ffffff"
            colorFront={isIncognito ? '#f87171' : '#cbd5e1'}
            pxSize={3}
            speed={0.4}
          />
        )}
      </div>

      {/* Center Hero with SoftBlurIn entrance & exit */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center my-auto pb-10">
        <SoftBlurIn
          key={isIncognito ? 'hero-title-incognito' : 'hero-title-default'}
          as="h1"
          isExiting={isExitingHero}
          className="text-3xl sm:text-4xl md:text-[42px] font-semibold text-[#1e293b] tracking-tight"
        >
          {isIncognito ? "Shh... What's on your mind?" : 'What are we building today?'}
        </SoftBlurIn>
        <SoftBlurIn
          key={isIncognito ? 'hero-sub-incognito' : 'hero-sub-default'}
          as="p"
          delay={isIncognito ? 150 : 400}
          isExiting={isExitingHero}
          className="mt-2 text-[15px] sm:text-[16px] text-[#64748b]"
        >
          {isIncognito
            ? 'Private idea canvas. Nothing is saved.'
            : 'Share your raw concept, get a clear PRD and actionable task list.'}
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
          <div
            onPaste={handlePaste}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl bg-white p-3 shadow-xs border-0 outline-none ring-0 transition-all ${
              isDragging ? 'ring-2 ring-orange-400 bg-orange-50/20' : ''
            }`}
          >
            {/* Image Preview Thumbnails */}
            {images.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-2 pt-0.5">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 shadow-xs shrink-0"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      title="Hapus gambar"
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-black/90 transition-opacity cursor-pointer"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {images.length < 4 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Tambah gambar lain (Maks 4)"
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-100/50 flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium">Tambah</span>
                  </button>
                )}
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
                  if (!busy && !tooShort) handleSubmit();
                }
              }}
              placeholder="Ask anything (ketik ide atau paste gambar)..."
              rows={1}
              style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              className="w-full resize-none border-0 bg-transparent p-0 text-[14.5px] leading-relaxed text-gray-800 placeholder:text-gray-400 border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 max-h-[180px] overflow-y-auto transition-[height] duration-75 selection:bg-[#0e7c86] selection:text-white"
            />

            {/* Bottom Toolbar inside White Card */}
            <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-gray-100/80">
              {/* Left tools: +, document icon, Preflight 0.0.1 ⌵ */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Unggah gambar / screenshot (atau Paste Ctrl+V)"
                  className="p-1 text-gray-500 hover:text-gray-800 transition-colors relative cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleAddFiles(Array.from(e.target.files));
                        e.target.value = '';
                      }
                    }}
                  />
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
                  onClick={handleSubmit}
                  disabled={busy || tooShort}
                  aria-label="Kirim"
                  title={
                    tooShort
                      ? images.length > 0
                        ? 'Tulis deskripsi singkat untuk gambar (min 3 huruf)'
                        : 'Tulis minimal satu kalimat utuh'
                      : 'Kirim ide (Enter)'
                  }
                  className="flex items-center justify-center rounded-lg bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-40 p-2 text-white shadow-xs transition-colors cursor-pointer"
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
