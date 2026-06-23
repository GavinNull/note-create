export const meta = {
  name: 'build-prompts',
  description: 'Render the 4 stage prompts with profile values substituted, for manual copy-paste use with any AI tool. Pass a profile object via args.profile.',
  phases: [
    { title: 'Load Profile', detail: 'Read and prepare the course profile' },
    { title: 'Render Prompts', detail: 'Render all 4 stage prompts with profile injection' },
  ],
}

// =============================================================================
// Build Prompts — Profile → Fully-Rendered Prompt Files
// =============================================================================
// Usage:
//   /workflow .pipeline/build-prompts.js
//       profile='{"name":"my-course","domain":"physics","languages":{"target":"zh-CN"},...}'
//
// Or use the embedded minimal demo to see the prompt structure.
// The output is 4 rendered prompt strings ready for copy-paste to any AI tool.
// =============================================================================

const LANGUAGE_NAMES = {
  'en': 'English', 'zh-CN': '中文', 'zh-TW': '繁體中文',
  'ja': '日本語', 'ko': '한국어', 'fr': 'Français', 'de': 'Deutsch',
  'es': 'Español', 'pt': 'Português', 'it': 'Italiano', 'ru': 'Русский',
  'same': 'English',
}

function langName(code) { return LANGUAGE_NAMES[code] || code || 'English' }

const MINIMAL_PROFILE = {
  name: 'minimal-demo', display: 'Demo Course', domain: 'general',
  languages: { source: 'en', target: 'en', annotation: null, annotation_style: null, field_suffix_source: '_en', field_suffix_target: '_en' },
  source: { chapter_pattern: 'Chapter (\\d+)', section_pattern: '^(\\d+\\.\\d+)', section_style: 'dotted', code_language: null, code_comment_style: null, math: { inline: '$', display: '$$' }},
  content_types: ['definition', 'example', 'note', 'figure', 'paragraph'],
  template: { title: '# Chapter {chapter}: {title_en}', epigraph: null, section: '## {number} {title_en}', subsection: '### {title_en}', separator: '---', toc_heading: '## Contents', toc_entry: '{idx}. [{section} {title_en}](#{anchor})', end_sections: [{id:'highlights',heading:'## Highlights',optional:true},{id:'glossary',heading:'## Key Terms',optional:false}] },
  labels: { definition: {en:'Definition'}, example: {en:'Example'}, note: {en:'Note'}, figure: {en:'Figure'} },
  tables: { glossary: {headers:['Term','Definition']} },
  formatting: { definition_order: 'source_only', term_annotation: 'never', table_first_column_bold: true },
  review: { check_term_consistency: false, check_latex: false, check_code_comments: false, check_missing_summaries: true, punctuation: {no_html_tags: true} },
  terminology: {}
}

// ── Load Profile ──────────────────────────────────────────────────────────
phase('Load Profile')

let profile
if (args?.profile) {
  try {
    const userProfile = typeof args.profile === 'string' ? JSON.parse(args.profile) : args.profile
    profile = JSON.parse(JSON.stringify(MINIMAL_PROFILE))
    // Simple merge
    for (const key of Object.keys(userProfile)) {
      if (key === 'terminology') {
        profile.terminology = userProfile.terminology || {}
      } else if (typeof userProfile[key] === 'object' && !Array.isArray(userProfile[key])) {
        Object.assign(profile[key] || {}, userProfile[key])
      } else {
        profile[key] = userProfile[key]
      }
    }
    log(`📋 Using custom profile: ${profile.name || 'custom'}`)
  } catch (e) {
    log(`⚠️  Could not parse args.profile, using minimal demo. Error: ${e.message}`)
    profile = JSON.parse(JSON.stringify(MINIMAL_PROFILE))
  }
} else {
  log('📋 No profile provided — using minimal demo profile.')
  log('   For real use: pass args.profile with your course configuration.')
  log('   See profiles/_template.yaml for the profile schema.')
  profile = JSON.parse(JSON.stringify(MINIMAL_PROFILE))
}

const lang = profile.languages
const nameSrc = langName(lang.source)
const nameTgt = langName(lang.target)
const nameAnn = langName(lang.annotation)
const sfxSrc = lang.field_suffix_source || '_en'
const sfxTgt = lang.field_suffix_target || '_cn'
const isMono = lang.annotation === null || lang.target === 'same' || lang.target === lang.source

log(`   Domain: ${profile.domain || 'general'} | ${nameSrc} → ${nameTgt} | ${isMono ? 'Monolingual' : 'Bilingual'}`)
log('')

// ── Render Prompts ────────────────────────────────────────────────────────
phase('Render Prompts')

function header(title) {
  return `# ${title}\n\n**Profile**: ${profile.name} — ${profile.display}\n**Domain**: ${profile.domain || 'general'}\n**Languages**: ${nameSrc} → ${nameTgt}${isMono ? ' (monolingual)' : ` (annotated: ${nameAnn})`}\n**Code**: ${profile.source?.code_language || 'none'}\n\n---\n\n`
}

// Stage 1
const stage1 = header('Stage 1: Structural Extraction') + `## Role
You are an expert knowledge engineer specializing in parsing academic textbooks.

## Task
Extract ALL structured content from the provided textbook chapter into structured JSON.

## Profile Settings
- **Domain**: ${profile.domain || 'general'}
- **Content types**: ${(profile.content_types||[]).join(', ')}
- **Section pattern**: \`${profile.source?.section_pattern || '^(\\\\d+\\\\.\\\\d+)'}\` (${profile.source?.section_style || 'dotted'})
${profile.source?.code_language ? `- **Code language**: ${profile.source.code_language} (comments: ${profile.source.code_comment_style})` : '- **Code**: none'}
- **Math**: ${profile.source?.math?.inline || '$'}...${profile.source?.math?.inline || '$'} / ${profile.source?.math?.display || '$$'}...${profile.source?.math?.display || '$$'}

## Block Types to Extract
${(profile.content_types||[]).map(t => `- **${t}**`).join('\n')}

## Field Conventions
- Source language (${nameSrc}) fields use suffix: \`${sfxSrc}\`
- Target language (${nameTgt}) fields use suffix: \`${sfxTgt}\` (can be null in Stage 1)

[See .pipeline/prompts/stage1-extract.md for the complete JSON schema.]

## Input
[PASTE YOUR TEXTBOOK CHAPTER TEXT HERE]`

// Stage 2
const stage2 = header(`Stage 2: ${isMono ? 'Monolingual Pass-Through' : 'Bilingual Processing'}`) + (isMono ? `## Role
You are a text processing agent.

## Task
This is a monolingual pipeline. Copy all source fields to target fields — no translation needed.

## Input
[PASTE STAGE 1 JSON OUTPUT HERE]` : `## Role
You are a bilingual education specialist (${nameSrc} → ${nameTgt}).

## Task
Take the Stage 1 JSON and enrich it with ${nameTgt} translations.
Annotate terms using ${lang.annotation_style || 'parens'} style with ${nameAnn}.

## Profile Settings
- **Translation**: ${nameSrc} → ${nameTgt}
- **Annotation**: ${nameAnn} (${lang.annotation_style || 'parens'})
- **Definition order**: ${profile.formatting?.definition_order || 'en_first'}
- **Term annotation frequency**: ${profile.formatting?.term_annotation || 'first_per_section'}
${profile.source?.code_language ? `- **Code comments**: ${profile.source.code_comment_style}` : ''}

## Field Conventions
- Source fields: \`*${sfxSrc}\` → Target fields: \`*${sfxTgt}\`

## Labels
${Object.entries(profile.labels||{}).map(([k,v]) => `- ${k}: ${v.en} → ${Object.values(v).find(vv => vv !== v.en) || v.en}`).join('\n')}

## Table Templates
${Object.entries(profile.tables||{}).map(([k,v]) => `- **${k}**: | ${v.headers.join(' | ')} |`).join('\n')}

## Terminology Dictionary
*(Paste your terminology from profiles/YOUR-COURSE.yaml here. Use terminology-builder.js to auto-generate.)*

[See .pipeline/prompts/stage2-bilingual.md for complete transformation rules.]

## Input
[PASTE STAGE 1 JSON OUTPUT HERE]`)

// Stage 3
const endSections = (profile.template?.end_sections || []).map(es => `- ${es.optional ? '[OPTIONAL] ' : ''}${es.heading}`).join('\n')
const tableDefs = Object.entries(profile.tables || {}).map(([k,v]) => `- **${k}**: | ${v.headers.join(' | ')} |`).join('\n')

const stage3 = header('Stage 3: Markdown Rendering') + `## Role
You are a typesetting engine for academic course notes in Markdown.

## Task
Take the Stage 2 JSON and render it into a complete .md file.

## Chapter Template

### Title
\`${(profile.template?.title || '# Chapter {chapter}: {title_en}').replace(/\{/g, '{{').replace(/\}/g, '}}')}\`

${profile.template?.epigraph ? `### Epigraph\n\`${profile.template.epigraph.replace(/\{/g, '{{').replace(/\}/g, '}}')}\`` : '### Epigraph: (none)'}

### Section Header
\`${(profile.template?.section || '## {number} {title_en}').replace(/\{/g, '{{').replace(/\}/g, '}}')}\`

### TOC
- Heading: ${profile.template?.toc_heading || '## Contents'}
- Entry: \`${(profile.template?.toc_entry || '{idx}. [{section} {title_en}](#{anchor})').replace(/\{/g, '{{').replace(/\}/g, '}}')}\`

### Chapter-End Sections
${endSections || '(none)'}

## Labels
${Object.entries(profile.labels||{}).map(([k,v]) => {
  const tgt = Object.values(v).find(vv => vv !== v.en) || v.en
  return `- **${k}**: ${v.en}${isMono ? '' : ` / ${tgt}`}`
}).join('\n')}

## Table Templates
${tableDefs || '(none)'}

${isMono ? '## Rendering Mode: Monolingual\nSingle-language output only. No cross-language annotations, no bilingual blockquotes.' : `## Rendering Mode: Bilingual
- Definition order: ${profile.formatting?.definition_order || 'en_first'}
- Annotation: ${profile.formatting?.term_annotation || 'first_per_section'}
- Code comments: ${profile.source?.code_comment_style || 'bilingual'}`}

[See .pipeline/prompts/stage3-render.md for complete formatting rules.]

## Input
[PASTE STAGE 2 JSON OUTPUT HERE]`

// Stage 4
const stage4 = header('Stage 4: Review & Enhancement') + `## Role
You are a meticulous academic course notes editor.

## Task
Review the Stage 3 Markdown and fix ALL issues.

## Profile Settings
- **Source**: ${nameSrc} → **Target**: ${nameTgt}
- **Domain**: ${profile.domain || 'general'}
- **Mode**: ${isMono ? 'Monolingual' : 'Bilingual'}
${profile.source?.code_language ? `- **Code**: ${profile.source.code_language} (${profile.source.code_comment_style})` : '- **Code**: none'}

## Review Checks
${profile.review?.check_term_consistency ? '- [x] Terminology consistency\n' : ''}${profile.review?.check_latex ? '- [x] LaTeX/math validation\n' : ''}${profile.review?.check_code_comments && profile.source?.code_language ? '- [x] Code comment format\n' : ''}${profile.review?.check_missing_summaries ? '- [x] Missing summaries\n' : ''}

## Labels to Verify
${Object.entries(profile.labels||{}).map(([k,v]) => {
  const tgt = Object.values(v).find(vv => vv !== v.en) || v.en
  return `- **${k}**: ${v.en}${isMono ? '' : ` / ${tgt}`}`
}).join('\n')}

## Terminology to Check
*(Paste your terminology dictionary here. Use terminology-builder.js to auto-generate.)*

[See .pipeline/prompts/stage4-review.md for the complete review checklist.]

## Input
[PASTE STAGE 3 MARKDOWN OUTPUT HERE]`

log('✅ Stage 1 Prompt rendered')
log('✅ Stage 2 Prompt rendered')
log('✅ Stage 3 Prompt rendered')
log('✅ Stage 4 Prompt rendered')
log('')

return {
  profile: profile.name,
  domain: profile.domain,
  monolingual: isMono,
  prompts: { stage1_extract: stage1, stage2_bilingual: stage2, stage3_render: stage3, stage4_review: stage4 },
  instructions: `
## How to Use These Prompts

1. Copy **stage1_extract** → paste to AI → include your textbook chapter text → get JSON
2. Copy **stage2_bilingual** → paste to AI → include the Stage 1 JSON ${isMono ? '(monolingual — just copies fields)' : '→ get enriched bilingual JSON'}
3. Copy **stage3_render** → paste to AI → include the Stage 2 JSON → get Markdown
4. Copy **stage4_review** → paste to AI → include the Stage 3 Markdown → get final polished notes

**Important**: For Stage 2, paste your terminology dictionary (from your profile YAML)
into the Terminology section of the prompt. Use terminology-builder.js to auto-generate it.
  `.trim()
}
