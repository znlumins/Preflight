import type { FeatureSet, Prd, SpecBatch, TaskBatch } from './schemas';

/**
 * Deterministic markdown rendering.
 *
 * The model returns structure; the prose scaffolding is written here. That keeps
 * the most expensive call's output roughly half the size, and it means document
 * formatting changes cost nothing in quota.
 */

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

export function renderPrd(prd: Prd): string {
  return `# ${prd.title}

> ${prd.oneLiner}

## Masalah

${prd.problem}

## Target pengguna

${bullets(prd.targetUsers)}

## Tujuan

${bullets(prd.goals)}

## Bukan tujuan

${bullets(prd.nonGoals)}

## Ukuran keberhasilan

${bullets(prd.successMetrics)}

## Lingkup MVP

${bullets(prd.mvpScope)}

## Ditunda setelah v1

${bullets(prd.laterScope)}

## Tech stack

| Lapisan | Pilihan |
| --- | --- |
| Frontend | ${prd.techStack.frontend} |
| Backend | ${prd.techStack.backend} |
| Database | ${prd.techStack.database} |
| Deployment | ${prd.techStack.deployment} |

${prd.techStack.rationale}

## Risiko

${prd.risks.map((r) => `- **${r.risk}** — ${r.mitigation}`).join('\n')}
`;
}

export function renderPlan(
  prd: Prd,
  features: FeatureSet,
  specs: SpecBatch,
  tasks: TaskBatch,
): string {
  const specById = new Map(specs.specs.map((s) => [s.featureId, s]));

  const sections = features.features.map((f) => {
    const spec = specById.get(f.id);
    const own = tasks.tasks.filter((t) => t.featureId === f.id);

    return `## ${f.name} \`${f.id}\` · ${f.priority}

${f.benefit}

### Subfitur

${f.subfeatures.map((s) => `- \`${s.id}\` **${s.name}** — ${s.summary}`).join('\n')}

${
  spec
    ? `### Spec

**User stories**

${bullets(spec.userStories)}

**Kriteria penerimaan**

${bullets(spec.acceptanceCriteria)}

**Data & state**

${bullets(spec.dataAndState)}

**Edge case**

${bullets(spec.edgeCases)}
`
    : ''
}
### Task

${
  own.length
    ? own
        .map(
          (t) => `#### ${t.title} \`${t.id}\` · ${t.priority}

${t.description}${t.dependsOn.length ? `\n\nBergantung pada: ${t.dependsOn.map((d) => `\`${d}\``).join(', ')}` : ''}

\`\`\`text
${t.agentPrompt}
\`\`\`
`,
        )
        .join('\n')
    : '_Belum ada task._'
}`;
  });

  return `${renderPrd(prd)}
---

# Rencana kerja

${sections.join('\n---\n\n')}`;
}
