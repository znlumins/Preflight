import { config as loadEnv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Pipeline } from '../lib/ai/pipeline';
import { renderPlan } from '../lib/ai/render';
import { listProviderModels, type ProviderId } from '../lib/ai/provider';
import type { Language } from '../lib/ai/schemas';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PROVIDERS: { id: ProviderId; name: string }[] = [
  { id: 'google', name: 'Google AI Studio (Gemini)' },
  { id: 'anthropic', name: 'Anthropic Claude (3.7 Sonnet & 3.5 Haiku)' },
  { id: 'openai', name: 'OpenAI (GPT-4o & GPT-4o-mini)' },
  { id: 'openrouter', name: 'OpenRouter (DeepSeek R1/V3, Llama 3.3, dll)' },
  { id: 'groq', name: 'Groq (High-speed OSS)' },
];

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('\n===========================================');
    console.log('       PREFLIGHT - AI CODING PLANNER       ');
    console.log('===========================================\n');

    let provider = arg('provider') as ProviderId | undefined;
    if (!provider) {
      console.log('Pilih AI Provider:');
      PROVIDERS.forEach((p, idx) => {
        console.log(`  [${idx + 1}] ${p.name} (${p.id})`);
      });
      const choice = (await rl.question('\nPilihan [1-5] (default 1): ')).trim();
      const num = parseInt(choice, 10);
      if (num >= 1 && num <= PROVIDERS.length) {
        provider = PROVIDERS[num - 1].id;
      } else {
        provider = 'google';
      }
    }
    console.log(`> Menggunakan provider: ${provider}\n`);

    let model = arg('model');
    if (!model && !process.argv.includes('--no-interview')) {
      const modelChoice = (
        await rl.question(
          'Model yang digunakan:\n  [1] Rekomendasi otomatis (Fast + Deep)\n  [2] Deteksi model dari API Key\n  [3] Tulis ID model custom\nPilihan [1-3] (default 1): ',
        )
      ).trim();

      if (modelChoice === '2') {
        console.log(`\nMemeriksa model yang aktif untuk ${provider}...`);
        const detected = await listProviderModels(provider);
        if (detected.length > 0) {
          console.log(`Ditemukan ${detected.length} model yang didukung:`);
          const displayCount = Math.min(detected.length, 12);
          for (let i = 0; i < displayCount; i++) {
            const m = detected[i];
            console.log(`  [${i + 1}] ${m.id} ${m.name ? `— ${m.name}` : ''}`);
          }
          const pick = (await rl.question(`\nPilih nomor model [1-${displayCount}]: `)).trim();
          const pickNum = parseInt(pick, 10);
          if (pickNum >= 1 && pickNum <= displayCount) {
            model = detected[pickNum - 1].id;
          }
        } else {
          console.log('Tidak ada model yang terdeteksi atau API key belum diset di .env.local.');
        }
      } else if (modelChoice === '3') {
        const customInput = (await rl.question('Masukkan ID model (cth: gpt-4o, claude-3-7-sonnet-latest): ')).trim();
        if (customInput) model = customInput;
      }
    }

    if (model) {
      console.log(`> Model aktif: ${model}\n`);
    } else {
      console.log('> Model aktif: Rantai otomatis (Fast + Deep)\n');
    }

    let idea = arg('idea');
    if (!idea) {
      idea = (await rl.question('Ceritakan ide produk yang ingin kamu buat:\n> ')).trim();
      while (idea.length < 10) {
        console.log('Ide terlalu pendek, ceritakan minimal satu kalimat.');
        idea = (await rl.question('> ')).trim();
      }
    }

    let context = arg('context');
    if (context === undefined) {
      const ans = (
        await rl.question('\nBatasan / konteks (cth: solo dev, 3 minggu, budget nol, tech stack):\n(Tekan enter jika tidak ada)> ')
      ).trim();
      context = ans || undefined;
    }

    const language = (arg('lang', 'id') as Language) || 'id';

    const pipeline = new Pipeline({ provider, model });
    const started = Date.now();

    console.log('\n[1/5] Menyiapkan 5 pertanyaan penting...');
    const questionnaire = await pipeline.questions({ idea, language, context });

    const answers: { questionId: string; answer: string }[] = [];
    const skipQuestions = process.argv.includes('--no-interview');

    if (skipQuestions) {
      for (const q of questionnaire.questions) {
        answers.push({
          questionId: q.id,
          answer: q.options[0]?.label ?? 'default',
        });
      }
    } else {
      console.log('\nJawab 5 pertanyaan berikut untuk mematangkan arsitektur:\n');
      for (let i = 0; i < questionnaire.questions.length; i++) {
        const q = questionnaire.questions[i];
        console.log(`${i + 1}. ${q.question}`);
        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, optIdx) => {
            console.log(`   [${optIdx + 1}] ${opt.label}`);
          });
          const reply = (await rl.question(`   Pilihan [1-${q.options.length}] atau ketik jawaban sendiri: `)).trim();
          const optNum = parseInt(reply, 10);
          if (optNum >= 1 && optNum <= q.options.length) {
            answers.push({ questionId: q.id, answer: q.options[optNum - 1].label });
          } else if (reply.length > 0) {
            answers.push({ questionId: q.id, answer: reply });
          } else {
            answers.push({ questionId: q.id, answer: q.options[0].label });
          }
        } else {
          const reply = (await rl.question('   Jawaban: ')).trim();
          answers.push({ questionId: q.id, answer: reply || 'standar' });
        }
        console.log('');
      }
    }

    console.log('[2/5] Menyusun PRD & Tech Stack...');
    const prd = await pipeline.prd({ idea, language, context, answers });
    console.log(`      ✓ PRD "${prd.title}" selesai.`);
    console.log(`      Tech stack: ${prd.techStack.frontend} / ${prd.techStack.backend} / ${prd.techStack.database}`);

    console.log('\n[3/5] Merinci Fitur & Subfitur...');
    const features = await pipeline.features(prd, language);
    const subCount = features.features.reduce((n, f) => n + f.subfeatures.length, 0);
    console.log(`      ✓ ${features.features.length} fitur, ${subCount} subfitur terdefinisi.`);

    console.log('\n[4/5] Membuat Spesifikasi Teknis...');
    const specs = await pipeline.specs(prd, features, language);
    console.log(`      ✓ ${specs.specs.length} modul spesifikasi selesai.`);

    console.log('\n[5/5] Memecah menjadi Task & Agent Prompt Siap Tempel...');
    const tasks = await pipeline.tasks(prd, features, specs, language);
    console.log(`      ✓ ${tasks.tasks.length} task berhasil disusun.`);

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\nSelesai dalam ${elapsed}s! Total model calls: ${pipeline.meter.calls.length}`);

    // Render markdown document
    const md = renderPlan(prd, features, specs, tasks);
    const outDir = join(process.cwd(), 'out');
    mkdirSync(outDir, { recursive: true });

    const safeTitle = prd.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `plan-${safeTitle}-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    const fullPath = join(outDir, filename);

    writeFileSync(fullPath, md, 'utf-8');

    console.log('\n===========================================');
    console.log(` Dokumen tersimpan di:\n ${fullPath}`);
    console.log('===========================================');
    console.log(`\nKamu bisa langsung membuka file di atas atau menyalin prompt task ke Claude Code, Cursor, Antigravity, dll.\n`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('\nError:', err instanceof Error ? err.message : err);
  process.exit(1);
});
