'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Questionnaire } from '@/lib/ai/schemas';
import type { ExampleIdea } from '@/lib/example-ideas';

/**
 * The entry flow: idea, then a short interview, then generation.
 *
 * Both steps live on one route and swap in place. Sending someone to a new page
 * to answer five questions makes the interview feel like a form to fill in;
 * keeping it here keeps it a conversation about the thing they just typed.
 */

type Step = 'idea' | 'interview';
type Answers = Record<string, string>;

/**
 * `example` is picked on the server, per request: choosing it here with
 * Math.random would render one idea on the server and another on hydration.
 */
export function IdeaFlow({ example }: { example: ExampleIdea }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idea');
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = idea.trim().length < 15;

  async function startInterview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/plan/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, context, language: 'id' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestionnaire(data);
      setStep('interview');
    } catch (err) {
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
          context,
          language: 'id',
          questions: questionnaire,
          answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // The plan row exists even when the PRD call failed; the plan page shows
      // the error and offers a retry, which beats stranding the user here.
      router.push(`/plans/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat plan.');
      setBusy(false);
    }
  }

  if (step === 'interview' && questionnaire) {
    return (
      <div className="settle">
        <p className="text-[15px] leading-relaxed text-muted">
          Lima pertanyaan. Jawabannya mengubah isi rencana — lewati kalau belum tahu.
        </p>

        <ol className="mt-10 space-y-9">
          {questionnaire.questions.map((q, i) => (
            <li key={q.id} className="border-l border-rule pl-5">
              <div className="flex gap-3">
                <span className="mt-0.5 font-mono text-[12px] text-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-medium leading-snug text-ink">{q.question}</h2>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-faint">{q.why}</p>

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
                            className={`rounded-[3px] border px-3 py-3 text-[14px] leading-snug transition-colors duration-150 sm:py-1.5
                              ${
                                active
                                  ? 'border-signal bg-signal-soft font-medium text-signal'
                                  : 'border-rule bg-paper text-muted hover:border-faint hover:text-ink'
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
                      placeholder="Jawab singkat saja"
                      className="mt-3.5 w-full max-w-lg border-b border-rule bg-transparent pb-1.5
                                 text-[15px] text-ink placeholder:text-faint focus:border-muted"
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {error && <Problem message={error} />}

        <div className="mt-11 flex items-center gap-5">
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="rounded-[3px] bg-ink px-5 py-3 text-[15px] font-medium text-paper sm:py-2.5
                       transition-colors hover:opacity-90 disabled:bg-rule disabled:text-faint"
          >
            {busy ? 'Menyusun rencana' : 'Susun rencana'}
          </button>
          <span className="text-[13.5px] text-faint">
            {Object.keys(answers).length} dari {questionnaire.questions.length} terjawab
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="idea" className="block text-[15px] leading-relaxed text-muted">
        Tulis apa adanya. Belum perlu rapi.
      </label>

      <textarea
        id="idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder={example.idea}
        rows={5}
        // Taller on a phone: the rotating examples run up to ~150 characters,
        // which is seven lines at 320px, and a cut-off example reads as broken.
        className="mt-4 w-full resize-none rounded-[3px] border border-rule bg-paper-sunk px-4 py-3.5
                   text-[17px] leading-relaxed text-ink placeholder:text-faint
                   focus:bg-paper max-sm:h-56"
      />

      {/* A one-line textarea rather than an input, so on a narrow screen the
          example wraps instead of being cut off mid-word. It grows to fit
          where field-sizing is supported; Enter still does not add a line. */}
      <textarea
        rows={1}
        value={context}
        onChange={(e) => setContext(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        aria-label="Batasan"
        placeholder={`Batasannya apa? Misal: ${example.constraints}`}
        className="mt-3 w-full resize-none border-b border-rule bg-transparent pb-1.5 text-[15px] leading-normal
                   text-ink [field-sizing:content] placeholder:text-faint focus:border-muted"
      />

      {error && <Problem message={error} />}

      <div className="mt-8 flex items-center gap-5">
        <button
          type="button"
          onClick={startInterview}
          disabled={busy || tooShort}
          className="rounded-[3px] bg-ink px-5 py-3 text-[15px] font-medium text-paper sm:py-2.5
                     transition-colors hover:opacity-90 disabled:bg-rule disabled:text-faint"
        >
          {busy ? 'Menyiapkan pertanyaan' : 'Mulai'}
        </button>
        {tooShort && idea.length > 0 && (
          <span className="text-[13.5px] text-faint">Satu kalimat utuh dulu.</span>
        )}
      </div>
    </div>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-6 border-l-2 border-warn bg-[#fdf6ee] px-4 py-3 text-[14px] leading-relaxed text-warn"
    >
      {message}
    </p>
  );
}
