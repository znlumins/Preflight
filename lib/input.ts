import { z } from 'zod';
import { LANGUAGES, questionnaireSchema } from './ai/schemas';

/**
 * Request bodies, validated at the edge.
 *
 * Every free-text field ends up inside a model prompt, and on the shared pool
 * the prompt is paid for by everyone. The upper bounds are generous for a real
 * idea and tight enough that nobody can paste a novel into the pool.
 */

const IDEA_MAX = 4000;
const CONTEXT_MAX = 4000;
const ANSWER_MAX = 1000;
const ANSWERS_MAX = 20;
const MESSAGE_MAX = 2000;
/** The questionnaire is echoed back from stage 1; a real one is a few KB. */
const QUESTIONS_JSON_MAX = 20_000;

const idea = z
  .string({ error: 'Ceritakan idenya dulu.' })
  .trim()
  .min(15, 'Ceritakan idenya sedikit lebih panjang — minimal satu kalimat utuh.')
  .max(IDEA_MAX, `Idenya terlalu panjang — maksimal ${IDEA_MAX} karakter.`);

const context = z
  .string()
  .trim()
  .max(CONTEXT_MAX, `Konteks tambahan terlalu panjang — maksimal ${CONTEXT_MAX} karakter.`)
  .optional()
  .nullable()
  .transform((v) => v || undefined);

const language = z.enum(LANGUAGES, { error: 'Bahasa tidak dikenal.' }).default('id');

export const questionsBody = z.object({ idea, context, language });

export const createBody = z.object({
  idea,
  context,
  language,
  questions: questionnaireSchema
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)
    .refine((v) => !v || JSON.stringify(v).length <= QUESTIONS_JSON_MAX, 'Kuesioner terlalu besar.'),
  answers: z
    .array(
      z.object({
        questionId: z.string().max(100),
        answer: z.string().trim().max(ANSWER_MAX, `Jawaban maksimal ${ANSWER_MAX} karakter.`),
      }),
    )
    .max(ANSWERS_MAX, 'Terlalu banyak jawaban.')
    .optional(),
});

export const reviseBody = z.object({
  message: z
    .string({ error: 'Tulis dulu perubahan yang kamu mau.' })
    .trim()
    .min(3, 'Tulis dulu perubahan yang kamu mau.')
    .max(MESSAGE_MAX, `Pesan terlalu panjang — maksimal ${MESSAGE_MAX} karakter.`),
});

const invalid = { error: 'Payload tidak valid.' };

export const taskBody = z.object({
  taskId: z.string(invalid).min(1, invalid).max(200, invalid),
  done: z.boolean(invalid),
});

export const undoBody = z.object({
  revisionId: z.number({ error: 'Revisi tidak valid.' }).int().positive(),
});

export const keyBody = z.object({
  provider: z.enum(['google', 'groq'], { error: 'Provider tidak dikenal.' }),
  apiKey: z
    .string({ error: 'API key kosong.' })
    .trim()
    .min(1, 'API key kosong.')
    .max(500, 'API key terlalu panjang.'),
});
