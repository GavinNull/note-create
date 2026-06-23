export const meta = {
  name: 'generate-chapter-notes',
  description: 'Generate course notes from raw textbook text. Domain-aware, language-agnostic. Accepts a profile object in args for course-specific adaptation.',
  phases: [
    { title: 'Load Profile', detail: 'Prepare and validate the course profile' },
    { title: 'Extract', detail: 'Parse textbook text → structured JSON' },
    { title: 'Bilingual', detail: 'Translate and annotate terms (skipped for monolingual)' },
    { title: 'Render', detail: 'Render JSON into final Markdown' },
    { title: 'Review', detail: 'Check consistency, fix formatting' },
  ],
}

// =============================================================================
// Profile-Driven Note Generation Pipeline — v3.1 Language-Agnostic
// =============================================================================
// Usage:
//   Default (minimal profile, domain=general):
//     /workflow .pipeline/workflow.js textbook="..." chapter_number=1
//         chapter_title_en="Title" chapter_title_cn="标题"
//
//   FDS course (pass FDS profile inline or use the FDS profile file):
//     /workflow .pipeline/workflow.js textbook="..." chapter_number=6
//         chapter_title_en="Sorting" chapter_title_cn="排序"
//         profile='{"domain":"cs_theory","languages":{"target":"zh-CN"},...}'
//
//   Other courses: pass a profile object in args.profile (JSON string or JS object)
//   For manual prompt path: use build-prompts.js
// =============================================================================

// ── Constants ─────────────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  'en': 'English',       'zh-CN': '中文',       'zh-TW': '繁體中文',
  'ja': '日本語',         'ko': '한국어',         'fr': 'Français',
  'de': 'Deutsch',       'es': 'Español',       'pt': 'Português',
  'it': 'Italiano',      'ru': 'Русский',        'ar': 'العربية',
  'hi': 'हिन्दी',          'th': 'ไทย',            'vi': 'Tiếng Việt',
  'nl': 'Nederlands',    'sv': 'Svenska',        'pl': 'Polski',
  'tr': 'Türkçe',        'fa': 'فارسی',          'he': 'עברית',
  'same': 'English',                                  // monolingual fallback
}

const BLOCK_TYPE_REGISTRY = {
  // Universal (apply to all domains)
  definition:       { schema: '{"type":"definition","term":"Term being defined","text":"Definition text with formulas in $...$"}', cs_only: false },
  theorem:          { schema: '{"type":"theorem","label":"Theorem 1","text":"Theorem text with formulas in $...$","has_proof":bool,"proof_text":"..."}', cs_only: false },
  code:             { schema: '{"type":"code","language":"LANG","code":"verbatim code","caption":"What this code does"}', cs_only: false },
  example:          { schema: '{"type":"example","title":"...","description":"...","steps":["step1",...]|null}', cs_only: false },
  note:             { schema: '{"type":"note","text":"Explicit tip, warning, or remark. NOT for general explanatory paragraphs."}', cs_only: false },
  figure:           { schema: '{"type":"figure","ref":"images/...","caption":"..."}', cs_only: false },
  paragraph:        { schema: '{"type":"paragraph","text":"General explanatory prose. Use this (not note) for ordinary text flow."}', cs_only: false },
  comparison_table: { schema: '{"type":"comparison_table","title":"...","headers":[...],"rows":[...]}', cs_only: false },
  derivation:       { schema: '{"type":"derivation","title":"...","steps":["step1 with formulas in $...$",...]}', cs_only: false },
  ascii_diagram:    { schema: '{"type":"ascii_diagram","content":"ASCII art — tree/list structures. Extract EXACTLY as shown.","caption":"..."}', cs_only: false },
  formula_list:     { schema: '{"type":"formula_list","items":[{"name":"Formula name","formula":"$...$","notes":"..."}]}', cs_only: false },
  problem_solution: { schema: '{"type":"problem_solution","problem":"Problem statement","solution":"Solution with formulas in $...$"}', cs_only: false },
  // CS-specific
  complexity_table: { schema: '{"type":"complexity_table","headers":[...],"rows":[{case,condition,time}]}', cs_only: true },
  interactive_demo: { schema: '{"type":"interactive_demo","ref":"images/...html","description_en":"..."}', cs_only: true },
  // STEM
  equation:         { schema: '{"type":"equation","latex":"...","label":"...","description_en":"..."}', cs_only: false },
  law:              { schema: '{"type":"law","name":"...","en":"...","formula":"..."}', cs_only: false },
  constant_table:   { schema: '{"type":"constant_table","headers":[...],"rows":[{name,symbol,value,unit}]}', cs_only: false },
  mechanism:        { schema: '{"type":"mechanism","title_en":"...","steps":["step1",...]}', cs_only: false },
  experiment:       { schema: '{"type":"experiment","title_en":"...","procedure":[...],"observations":"..."}', cs_only: false },
  // Humanities & Social Sciences
  argument:         { schema: '{"type":"argument","thesis_en":"...","evidence":[...]}', cs_only: false },
  quote:            { schema: '{"type":"quote","text_en":"...","attribution":"Author, Work, Page"}', cs_only: false },
  case_study:       { schema: '{"type":"case_study","title_en":"...","context":"...","analysis":"..."}', cs_only: false },
  timeline:         { schema: '{"type":"timeline","entries":[{date,event,significance}]}', cs_only: false },
  debate:           { schema: '{"type":"debate","topic_en":"...","positions":[{side,argument}]}', cs_only: false },
  framework:        { schema: '{"type":"framework","name_en":"...","components":[...],"description_en":"..."}', cs_only: false },
  // Biology
  process:          { schema: '{"type":"process","name_en":"...","steps":["step1",...],"location":"..."}', cs_only: false },
  classification:   { schema: '{"type":"classification","scheme_en":"...","levels":[{rank,name,characteristics}]}', cs_only: false },
}

// ── Minimal Default Profile ───────────────────────────────────────────────

const DEFAULT_PROFILE = {
  name: 'default',
  display: 'Untitled Course',
  domain: 'general',
  languages: {
    source: 'en', target: 'en', annotation: null,
    annotation_style: null,
    field_suffix_source: '_en', field_suffix_target: '_en'
  },
  source: {
    chapter_pattern: 'Chapter (\\d+)', section_pattern: '^(\\d+\\.\\d+)',
    section_style: 'dotted', code_language: null, code_comment_style: null,
    math: { inline: '$', display: '$$' }
  },
  content_types: ['definition', 'example', 'note', 'figure', 'paragraph'],
  template: {
    title: '# Chapter {chapter}: {title_en}',
    epigraph: null,
    section: '## {number} {title_en}',
    subsection: '### {title_en}',
    separator: '---',
    toc_heading: '## Contents',
    toc_entry: '{idx}. [{section} {title_en}](#{anchor})',
    end_sections: [
      { id: 'highlights', heading: '## Chapter Highlights', optional: true },
      { id: 'glossary', heading: '## Key Terms', optional: false }
    ]
  },
  labels: {
    definition: { en: 'Definition' },
    example: { en: 'Example' },
    note: { en: 'Note' },
    figure: { en: 'Figure' }
  },
  tables: {
    glossary: { headers: ['Term', 'Definition'] }
  },
  formatting: {
    definition_order: 'source_only', term_annotation: 'never',
    table_first_column_bold: true, blank_lines_around_blocks: true
  },
  images: { path_pattern: 'images/ch{chapter:02d}-{slug}.png', alt_text: '{description}', demo_link: null },
  review: {
    check_term_consistency: false, check_latex: false, check_code_comments: false,
    check_missing_summaries: true,
    punctuation: { no_html_tags: true }
  },
  terminology: {}
}

// ── Profile Helpers ───────────────────────────────────────────────────────

function langName(code) {
  if (!code) return 'English'
  return LANGUAGE_NAMES[code] || code
}

function flattenTerminology(terminology) {
  if (!terminology || typeof terminology !== 'object') return []
  const result = []
  for (const [category, terms] of Object.entries(terminology)) {
    if (Array.isArray(terms)) {
      for (const t of terms) {
        const keys = Object.keys(t)
        const srcKey = keys.find(k => k === 'en' || k.startsWith('en_')) || 'en'
        const tgtKey = keys.find(k => k !== srcKey && k !== 'en_alt' && k !== 'category') || keys[1] || 'target'
        result.push({ source: t[srcKey] || t.en, target: t[tgtKey], category })
      }
    }
  }
  return result
}

function formatTerminologyForPrompt(flatTerms) {
  if (!flatTerms.length) return '(No terminology dictionary provided — use your best judgment for consistent translations.)'
  const byCategory = {}
  for (const t of flatTerms) {
    if (!byCategory[t.category]) byCategory[t.category] = []
    byCategory[t.category].push(`${t.target} → ${t.source}`)
  }
  let out = ''
  for (const [cat, pairs] of Object.entries(byCategory)) {
    out += `## ${cat}\n`
    for (const p of pairs) out += `- ${p}\n`
    out += '\n'
  }
  return out
}

function formatReviewTerminology(flatTerms) {
  return flatTerms.length
    ? flatTerms.map(t => `- "${t.source}" ↔ "${t.target}"`).join('\n')
    : '(No terminology to verify.)'
}

function formatReviewChecks(profile) {
  const r = profile.review || {}
  const checks = []
  if (r.check_term_consistency) checks.push('- [ ] Terminology consistency against dictionary')
  if (r.check_latex) checks.push('- [ ] LaTeX/math syntax validation')
  if (r.check_code_comments && profile.source?.code_language) checks.push('- [ ] Code comment format')
  if (r.check_missing_summaries) checks.push('- [ ] Missing chapter-end summaries')
  return checks.join('\n') || '- [ ] (No review checks enabled)'
}

function formatPunctuationRules(profile) {
  const p = (profile.review || {}).punctuation || {}
  const rules = []
  if (p.no_html_tags) rules.push('- No HTML tags')
  if (p.chinese_in_chinese_text) rules.push(`- ${langName(profile.languages?.target || 'zh-CN')} text uses native punctuation conventions`)
  return rules.join('\n') || '- (No punctuation rules specified)'
}

// ── Domain Hint Modules ───────────────────────────────────────────────────

const DOMAIN_HINTS = {
  cs_theory: {
    stage1: 'Look for pseudocode blocks, complexity analysis tables, and theorem-proof structures. Capture all O(n)/Θ(n)/Ω(n) complexity mentions. Extract algorithm steps as numbered sequences.',
    stage2: 'Use standard CS academic language. For algorithms, keep algorithm names in source language with target-language description. Translate complexity terms precisely.',
    stage3: 'Use complexity comparison tables. Render ADT operation tables. Add algorithm trace examples. Include pseudocode with bilingual comments.',
    stage4: 'Verify complexity notation consistency. Check algorithm stability annotations. Validate code syntax. Verify theorem numbering.'
  },
  cs_systems: {
    stage1: 'Focus on architecture diagrams, configuration examples, protocol specifications, and design trade-off discussions.',
    stage2: 'Use systems/engineering terminology. Keep protocol names and API names in source language.',
    stage3: 'Use system comparison tables. Include architecture diagrams. Add configuration code examples. Note version-specific details.',
    stage4: 'Verify API/command syntax. Check diagram clarity. Validate version numbers. Confirm protocol specification accuracy.'
  },
  math_pure: {
    stage1: 'Pay special attention to Definition→Lemma→Proof→Corollary chains. Extract equation numbers and labels. Treat each step in a multi-step proof as a separate derivation block. Capture "if and only if" (⟺) conditions precisely.',
    stage2: 'Use standard mathematical terminology in target language. Translate theorem names fully. Keep mathematical symbols unchanged.',
    stage3: 'Use theorem-summary tables. Render proof blocks with clear QED markers (∎/□). Add equation numbers in parentheses. Use remark/note blocks for important observations.',
    stage4: 'Verify equation numbering is consistent across cross-references. Check QED markers at proof ends. Verify theorem numbering matches citations. Validate that iff conditions are correctly rendered.'
  },
  math_applied: {
    stage1: 'Extract algorithms as pseudocode. Capture model assumptions and constraints. Note data requirements and computational complexity.',
    stage2: 'Use applied math terminology in target language. Keep algorithm names in source language.',
    stage3: 'Include worked numerical examples. Add algorithm step-by-step traces. Use comparison tables for competing methods.',
    stage4: 'Verify numerical accuracy in examples. Check algorithm step numbering. Validate formula cross-references.'
  },
  physics: {
    stage1: 'Identify physical laws with names. Extract equations with variable definitions. Capture experimental setups with procedures. Note physical constants with values and units.',
    stage2: 'Use standard physics terminology in target language. Keep law names in source language with target-language annotation.',
    stage3: 'Render law blocks with descriptive names. Include constant tables with units. Add experimental procedure steps. Use bold for vector quantities.',
    stage4: 'Verify equation variable consistency. Check unit consistency across derivations. Validate constant values and units. Verify vector/scalar notation.'
  },
  chemistry: {
    stage1: 'Capture chemical equations with phase annotations (s), (l), (g), (aq). Extract reaction mechanisms step-by-step. Identify lab procedures with safety notes. Note reaction conditions.',
    stage2: 'Use standard nomenclature in target language. Keep reagent abbreviations in source language.',
    stage3: 'Render chemical equations with proper subscripts/superscripts. Show reaction mechanisms with step numbers. Add safety cautions. Include lab setup descriptions.',
    stage4: 'Verify chemical equations are balanced. Check phase annotations. Validate reaction conditions. Verify nomenclature conventions.'
  },
  biology: {
    stage1: 'Capture biological processes as step-by-step sequences. Extract classification schemes with hierarchical relationships. Note key enzymes, proteins, and genes.',
    stage2: 'Use standard biology terminology in target language. Keep gene/protein names in source language (standard notation). Italicize genus/species names.',
    stage3: 'Render process diagrams with numbered steps. Use classification tables with hierarchical indentation. Add case study summaries.',
    stage4: 'Verify process step ordering. Check enzyme/protein name spelling. Validate taxonomic naming conventions (italics for genus/species).'
  },
  engineering: {
    stage1: 'Extract design equations with parameter definitions. Capture engineering standards and specifications. Note safety factors and design margins.',
    stage2: 'Use engineering terminology in target language. Keep standard codes in source language.',
    stage3: 'Render design equations with unit annotations. Add specification tables. Include engineering diagrams. Note applicable standards.',
    stage4: 'Verify unit consistency. Check standard references. Validate safety factor ranges. Confirm specification values.'
  },
  economics: {
    stage1: 'Identify economic models with their assumptions. Capture equations with variable definitions and economic interpretations. Extract case studies with policy implications.',
    stage2: 'Use economics terminology in target language. Keep model names in source language with target-language description.',
    stage3: 'Render model descriptions with clear assumption lists. Add economic diagrams. Include policy implication notes.',
    stage4: 'Verify model assumption consistency. Check equation variable definitions. Validate economic terminology precision.'
  },
  humanities: {
    stage1: 'Identify thesis statements and main arguments. Extract significant quotations with full attribution (author, work, page). Capture competing interpretations as debate blocks. Note historical context.',
    stage2: 'Use humanities terminology in target language. Keep author names and work titles in source language.',
    stage3: 'Render arguments with supporting evidence and counterarguments. Format quotations with proper attribution. Use timeline tables for historical content. Add thematic analysis sections.',
    stage4: 'Verify quotation accuracy and attribution. Check chronological consistency in timelines. Validate terminology precision. Ensure balanced representation of competing views.'
  },
  social_science: {
    stage1: 'Identify theoretical frameworks with key figures and dates. Extract empirical studies with methodology and findings. Capture competing theoretical perspectives as debate blocks.',
    stage2: 'Use social science terminology in target language. Keep researcher names in source language.',
    stage3: 'Render theory comparison tables. Add study summaries with methodology notes. Include debate sections with balanced perspectives.',
    stage4: 'Verify researcher name spelling and dates. Check theoretical attribution accuracy. Validate methodology terminology. Ensure balanced representation of competing views.'
  },
  general: {
    stage1: 'Use conservative extraction. Focus on definitions, examples, and key points in the text. Capture any structured content you find.',
    stage2: 'Use general academic translation conventions. Maintain consistency within the chapter.',
    stage3: 'Use a clean, simple chapter structure. Add comparison tables where helpful.',
    stage4: 'Verify basic formatting. Check term consistency. Ensure all sections are complete.'
  }
}

function getDomainHints(profile) {
  const domain = profile.domain || 'general'
  return DOMAIN_HINTS[domain] || DOMAIN_HINTS.general
}

// ── Profile Building & Validation ─────────────────────────────────────────

function buildProfile(args) {
  // Start from minimal default
  let profile = JSON.parse(JSON.stringify(DEFAULT_PROFILE))

  // Merge user-provided profile (from args.profile — can be JS object or JSON string)
  if (args?.profile) {
    const userProfile = typeof args.profile === 'string' ? JSON.parse(args.profile) : args.profile
    deepMerge(profile, userProfile)
    log(`📋 Using custom profile: ${profile.name || 'custom'}`)
  } else {
    log('📋 Using minimal default profile (domain: general, monolingual English)')
    log('   For better results, provide a profile via args.profile or use a domain-specific preset.')
  }

  // Compute derived fields
  const lang = profile.languages
  profile._suffixSrc = lang.field_suffix_source || '_en'
  profile._suffixTgt = lang.field_suffix_target || '_' + (lang.target || 'en').split('-')[0]
  profile._isMonolingual = lang.annotation === null || lang.target === 'same' || lang.target === lang.source
  profile._langNameSrc = langName(lang.source)
  profile._langNameTgt = langName(lang.target)
  profile._langNameAnn = langName(lang.annotation)
  profile._flatTerms = flattenTerminology(profile.terminology)
  profile._termDictForPrompt = formatTerminologyForPrompt(profile._flatTerms)
  profile._termDictForReview = formatReviewTerminology(profile._flatTerms)
  profile._reviewChecks = formatReviewChecks(profile)
  profile._punctRules = formatPunctuationRules(profile)
  profile._domainHints = getDomainHints(profile)

  // Validate
  validateProfile(profile)

  return profile
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === 'terminology') {
      // Terminology: shallow-merge categories
      if (!target.terminology) target.terminology = {}
      Object.assign(target.terminology, source.terminology)
    } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
}

function validateProfile(profile) {
  const warnings = []
  const lang = profile.languages

  if (!profile.content_types || profile.content_types.length === 0) {
    warnings.push('content_types is empty — no content will be extracted')
  }
  if (profile._flatTerms.length === 0 && lang.annotation !== null) {
    warnings.push('Terminology dictionary is empty — translations may be inconsistent')
  }
  if (profile._isMonolingual) {
    log(`ℹ️  Monolingual mode: ${lang.target} only (no cross-language annotation)`)
    if (lang.annotation !== null) {
      warnings.push(`Annotation language is set to "${lang.annotation}" but target equals source — annotations will be suppressed`)
    }
  }
  if (lang.annotation_style === 'parens' && lang.annotation === null) {
    warnings.push('annotation_style is "parens" but annotation language is null — no annotations will be generated')
  }

  if (warnings.length) {
    log('⚠️  Profile warnings:')
    for (const w of warnings) log(`   - ${w}`)
  }
  log(`   Domain: ${profile.domain || 'general'} | ${lang.source} → ${lang.target}${lang.annotation ? ` (annotated: ${lang.annotation})` : ''}`)
  log(`   Content types: ${profile.content_types.length} | Terms: ${profile._flatTerms.length} | Monolingual: ${profile._isMonolingual}`)
}

// ── Prompt Builders ───────────────────────────────────────────────────────

function buildBlockTypeSchemas(profile) {
  const ct = profile.content_types || []
  const lines = []
  for (const type of ct) {
    const def = BLOCK_TYPE_REGISTRY[type]
    if (def) {
      lines.push(`- **${type}**: \`${def.schema.replace('LANG', profile.source?.code_language || 'text')}\``)
    } else {
      lines.push(`- **${type}**: extract as structured data`)
    }
  }
  return lines.join('\n')
}

function buildConditionalRules(profile) {
  const ct = profile.content_types || []
  const s = profile.source
  const rules = []

  rules.push('1. **FORMULAS**: Wrap ALL mathematical formulas in LaTeX: $...$ for inline, $$...$$ for display. Never leave formulas in plain text.')
  rules.push('2. Do NOT translate anything — this stage extracts raw source-language content.')
  rules.push('3. Capture EVERY definition, theorem, named concept, and formula-bearing sentence.')
  rules.push('4. **HIERARCHY**: Detect subsection structure (### Subsection Name). Use nested section objects with parent/child relationships when the text has clear sub-headings.')
  rules.push('5. **GRANULARITY**: Group closely related sentences into a single content block. Do NOT split a single definition across multiple blocks. A definition + its immediate explanation = one block.')

  if (s.code_language && ct.includes('code')) {
    rules.push(`6. **CODE (NON-NEGOTIABLE)** : Extract EVERY ${s.code_language} code block VERBATIM with ALL comments. Preserve exact indentation. Include step counts and performance annotations from comments. Missing any code block = failed extraction.`)
  }
  if (ct.includes('complexity_table')) {
    rules.push('7. Capture all algorithmic complexity mentions ($O(n)$, $\\Theta(n)$, $\\Omega(n)$).')
  }
  if (ct.includes('equation')) {
    rules.push('8. Extract all numbered equations with their labels and descriptions. Use LaTeX math mode.')
  }
  rules.push(`${rules.length + 1}. **DISTINCTION**: Use "note" only for explicit tips, warnings, remarks. Use "paragraph" for general explanatory flow. Use "example" for worked cases with data.`)
  rules.push(`${rules.length + 2}. Maintain section order as in the textbook.`)
  rules.push(`${rules.length + 3}. Group related content in content_blocks array, preserving textbook order.`)
  return rules.join('\n')
}

function buildStage1Prompt(profile, textbook) {
  const s = profile.source
  const lang = profile.languages
  const sfx = profile._suffixTgt

  return `You are an expert knowledge engineer specializing in parsing academic textbooks.

## TASK
Extract ALL structured content from the following textbook chapter into a precise JSON format.
Do NOT summarize or paraphrase — preserve original wording, formulas, and code verbatim.
Do NOT translate — this stage extracts raw ${langName(lang.source)}-language content.

## TEXTBOOK PROFILE
- Domain: ${profile.domain || 'general'}
- Content types to extract: ${(profile.content_types || []).join(', ')}
- Section detection: pattern \`${s.section_pattern}\`, style: ${s.section_style}
${s.code_language ? `- Code language: ${s.code_language} (comment style: ${s.code_comment_style || 'standard'})` : '- Code: none'}
- Math delimiters: ${s.math.inline}...${s.math.inline} (inline), ${s.math.display}...${s.math.display} (display)

## JSON SCHEMA
{
  "chapter": {
    "number": CHAPTER_NUMBER,
    "title_${lang.source}": "Chapter Title",
    "title${sfx}": null,
    "sections": [{
      "number": "SECTION_ID",
      "title_${lang.source}": "Section Name",
      "title${sfx}": null,
      "anchor": "section-anchor",
      "content_blocks": [/* type-specific blocks — see below */]
    }]
  }
}

## BLOCK TYPE SCHEMAS
${buildBlockTypeSchemas(profile)}

## DOMAIN-SPECIFIC GUIDANCE (${profile.domain || 'general'})
${profile._domainHints.stage1}

## RULES
${buildConditionalRules(profile)}

## INPUT TEXTBOOK:
${textbook}

Output ONLY valid JSON (no markdown wrapper, no explanation).`
}

function buildStage2Prompt(profile, stage1Json) {
  const lang = profile.languages
  const s = profile.source
  const fmt = profile.formatting
  const sfxSrc = profile._suffixSrc
  const sfxTgt = profile._suffixTgt
  const nameSrc = profile._langNameSrc
  const nameTgt = profile._langNameTgt
  const nameAnn = profile._langNameAnn

  // Monolingual: skip translation, just pass through
  if (profile._isMonolingual) {
    return `You are a text processing agent.

## TASK
This is a monolingual pipeline (${nameTgt} only). No translation is needed.
Take the Stage 1 JSON and:
1. Copy all \`*${sfxSrc}\` fields to \`*${sfxTgt}\` fields (same content, same language)
2. Do NOT add any annotations
3. Preserve all original content exactly

## INPUT JSON:
${stage1Json}

Output the enriched JSON with ${sfxTgt} fields populated (same content as ${sfxSrc}).`
  }

  return `You are a bilingual education specialist (${nameSrc} → ${nameTgt}).

## TASK
Take the structured JSON from Stage 1 and produce an enriched version:
1. Translate all explanatory text from ${nameSrc} to ${nameTgt} (professional academic style)
2. Annotate technical terms: ${lang.annotation_style === 'parens' ? `${nameTgt} term（${nameAnn} term）` : `${lang.annotation_style}`}
3. Annotation frequency: ${fmt.term_annotation}
${s.code_language ? `4. Code comments: convert to bilingual using ${s.code_comment_style}` : ''}
5. Definitions/theorems: render with both languages (${fmt.definition_order})

## FIELD CONVENTIONS
- Source language fields use suffix: \`${sfxSrc}\` (e.g., \`text${sfxSrc}\`)
- Target language fields use suffix: \`${sfxTgt}\` (e.g., \`text${sfxTgt}\`)

## TRANSFORMATION RULES

### Definitions & Theorems:
- Add \`${sfxTgt}\` suffix fields with ${nameTgt} translation
- Order: ${fmt.definition_order}
- In the ${nameTgt} text, bold the term with ${lang.annotation ? nameAnn : ''} annotation

${s.code_language ? `### Code comments:
- Convert to bilingual: ${s.code_comment_style?.replace('%s', `${nameSrc} / ${nameTgt}`) || `${nameSrc} / ${nameTgt}`}` : ''}

### Tables:
- Headers become bilingual${lang.annotation_style === 'parens' ? `: Header${sfxTgt} (Header${sfxSrc})` : ''}
- First column values bolded${fmt.table_first_column_bold ? ' with bilingual annotation' : ''}

### Figures:
- Add \`caption${sfxTgt}\` field if missing

### Notes/Tips/Examples:
- Add \`*${sfxTgt}\` fields with ${nameTgt} translation

## CRITICAL: BODY TEXT POLICY
- **Body paragraphs**: Generate ${nameTgt}-PRIMARY text only. Annotate technical terms inline (e.g., **中文术语（English term）**). Do NOT create separate ${nameSrc} versions of body paragraphs.
- **Definitions, Theorems, Laws, Remarks**: These ARE bilingual — generate BOTH ${nameSrc} and ${nameTgt} fields.
- **Examples**: ${nameTgt}-primary with ${nameSrc} key phrases. Solution steps in ${nameTgt}.`

## DOMAIN TRANSLATION GUIDANCE (${profile.domain || 'general'})
${profile._domainHints.stage2}

## TERMINOLOGY DICTIONARY (Authoritative — use these exact translations)
${profile._termDictForPrompt}

If a term is not in the dictionary, use your best judgment and stay consistent.

## INPUT JSON:
${stage1Json}

Output ONLY the enriched JSON (no markdown wrapper). Preserve all original fields; new ${sfxTgt} fields are additive.`
}

function buildStage3Prompt(profile, stage2Json, chapterMeta) {
  const tpl = profile.template
  const labels = profile.labels
  const lang = profile.languages
  const s = profile.source
  const fmt = profile.formatting
  const sfxSrc = profile._suffixSrc
  const sfxTgt = profile._suffixTgt
  const nameSrc = profile._langNameSrc
  const nameTgt = profile._langNameTgt
  const nameAnn = profile._langNameAnn
  const isMono = profile._isMonolingual

  const endSections = (tpl.end_sections || [])
    .map(es => `- ${es.optional ? '[OPTIONAL] ' : ''}${es.heading}`).join('\n')

  const tableTemplates = Object.entries(profile.tables || {})
    .map(([id, t]) => `- **${id}**: | ${t.headers.join(' | ')} |`).join('\n')

  // Build label examples
  const labelKeys = Object.keys(labels)
  const labelEx = labelKeys.slice(0, 4).map(k => {
    const v = labels[k]
    if (isMono) return `- **${k}**: \`${v.en}\``
    const tgtKey = Object.keys(v).find(kk => kk !== 'en') || 'en'
    return `- **${k}**: ${v.en} / ${v[tgtKey]}`
  }).join('\n')

  return `You are a typesetting engine for academic course notes in Markdown.

## TASK
Take the enriched JSON from Stage 2 and render it into a COMPLETE, publication-ready .md file.

## CHAPTER TEMPLATE

### Title:
\`${tpl.title?.replace(/\{chapter\}/g, String(chapterMeta.chapter)).replace(/\{title_en\}/g, chapterMeta.title_en || 'TITLE').replace(/\{title_cn\}/g, chapterMeta.title_cn || '')}\`

${tpl.epigraph ? `### Epigraph:\n\`${tpl.epigraph}\`` : '### Epigraph: (none)'}

### Section:
\`${tpl.section}\`

${tpl.subsection ? `### Subsection (level 3):\n\`${tpl.subsection}\`` : ''}
#### Subsubsection (level 4): Use \`#### title\` for fine-grained topic breakdown when the textbook has deeply nested content (e.g., individual examples, specific properties, sub-cases).`

### Separator:
\`${tpl.separator}\`

### TOC:
- Heading: \`${tpl.toc_heading}\`
- Entry: \`${tpl.toc_entry}\`

### Chapter-End Sections:
${endSections}

## LABELS
${labelEx}

## TABLE TEMPLATES
${tableTemplates}

## FORMATTING RULES
${isMono ? '- Monolingual mode: single-language rendering only' : `- Body text: ${nameTgt}-primary with ${nameAnn} term annotations inline. NO separate ${nameSrc} paragraphs for body text.
- Bilingual blockquotes ONLY for: definitions, theorems, laws, remarks. Body paragraphs are single-language.
- Table headers: bilingual. First column: **${nameTgt}** (${nameSrc}) format.
- Term annotation: ${fmt.term_annotation} (${lang.annotation_style})`}
${s.code_language ? `- Code language: \\\`\\\`\\\`${s.code_language}
- Code comment style: ${s.code_comment_style}` : '- Code: none'}
- Math: ${s.math.inline}...${s.math.inline} / ${s.math.display}...${s.math.display}
${!isMono ? `- Target field suffix: ${sfxTgt} / Source field suffix: ${sfxSrc}` : ''}

${!isMono ? `### Body Paragraphs (${nameTgt}-primary, terms annotated):
${nameTgt} paragraph text with **术语（${nameAnn} term）** annotations inline. Do NOT add a separate ${nameSrc} paragraph.

### Definitions (only for NAMED, FORMAL definitions):
Use `**【定义（Definition）】**` ONLY for explicitly labeled definitions (e.g., "Definition 1", "DEFINITION:"). Do NOT mark every concept explanation as a definition. A chapter typically has 3-8 formal definitions — not 20+. For general concept explanations, use regular paragraphs with **术语（English）** annotations.` : `### Body Paragraphs (monolingual):
Single-language text.

### Definitions (monolingual):
> **${labels.definition?.en || 'Definition'}**: Definition text.`}

${!isMono ? `### Theorems/Laws (bilingual blockquote):
> **${labels.theorem?.en || 'Theorem'} N**: ${nameSrc} text.
> **${Object.values(labels.theorem || {}).find((v,i) => i>0) || labels.theorem?.en || 'Theorem'} N**: ${nameTgt} text.` : ''}

### Examples:
${!isMono ? `**【${Object.values(labels.example||{}).find((v,i)=>i>0)||labels.example?.en||'Example'} N】** ${nameTgt} description. **${labels.example?.en||'Example'} N**: ${nameSrc} description.` : `**${labels.example?.en||'Example'} N**: Description.`}

### Tables (MANDATORY Markdown pipe syntax):
${!isMono ? `Bilingual headers. First column: **${nameTgt}** (${nameSrc}). ALL comparison data, complexity analysis, and property summaries MUST use \`| col1 | col2 |\` pipe table syntax — never prose or bullet lists for tabular data.` : 'Single-language headers. Use pipe syntax for all structured data.'}

### Images (generate placeholders from text references):
When the raw text mentions "Figure X.Y" or "Fig. X.Y", generate an image placeholder: `![Figure X.Y: description](images/ch{chapter:02d}-figXY.png)`. This preserves figure references even when actual images are not in the raw text.

${profile.images?.demo_link ? `### Demos:\n${profile.images.demo_link}` : ''}

${!isMono ? `### Notes:
> **${labels.note?.en || 'Note'}**: text.` : `### Notes:
> **${labels.note?.en || 'Note'}**: text.`}

## DOMAIN RENDERING GUIDANCE (${profile.domain || 'general'})
${profile._domainHints.stage3}

## RULES
1. **CONCISENESS**: Lecture-note style — summarize supporting prose. Focus on concepts, definitions, formulas, and code. Target ~60% of raw textbook length.
2. **BODY TEXT**: Render body paragraphs in ${nameTgt} ONLY with ${lang.annotation ? nameAnn + ' term annotations inline' : 'no annotations'}. Do NOT add separate ${nameSrc} paragraphs for body text.
3. **BILINGUAL BLOCKQUOTES**: Only definitions, theorems, laws, and remarks get bilingual blockquotes (${nameSrc} first, then ${nameTgt}).
3. ${fmt.definition_order?.startsWith('en') || fmt.definition_order === 'source_only' ? 'Source language before target language' : 'Target language before source language'} in bilingual blocks.
${s.code_language ? `4. Code comments bilingual: ${s.code_comment_style?.replace('%s', `${nameSrc} / ${nameTgt}`) || `${nameSrc} / ${nameTgt}`}.` : ''}
${!s.code_language ? '4.' : '5.'} All math values in ${s.math.inline}...${s.math.inline}.
${!s.code_language ? '5.' : '6.'} No HTML tags — pure Markdown.
${!s.code_language ? '6.' : '7.'} Anchor IDs: lowercase, hyphens for spaces.
${!s.code_language ? '7.' : '8.'} Generate chapter-end sections (non-optional ones MUST be present).
${!s.code_language ? '8.' : '9.'} ${fmt.blank_lines_around_blocks ? 'Blank line before/after code blocks, tables, and blockquotes.' : ''}
${!s.code_language ? '9.' : '10.'} **FIDELITY**: Render ALL key concepts from input without omitting sections. But DO NOT transcribe every sentence verbatim — summarize supporting prose. Knowledge density comes from concept coverage, not word count. Target: concise lecture-note style (concept → intuitive explanation → formal definition → example → analysis), not textbook transcription.

## INPUT JSON:
${stage2Json}

Output ONLY the complete Markdown (no JSON wrapper, no preamble).`
}

function buildStage4Prompt(profile, stage3Markdown) {
  const lang = profile.languages
  const s = profile.source
  const fmt = profile.formatting
  const sfxSrc = profile._suffixSrc
  const sfxTgt = profile._suffixTgt
  const nameSrc = profile._langNameSrc
  const nameTgt = profile._langNameTgt
  const isMono = profile._isMonolingual

  return `You are a meticulous academic course notes editor.

## TASK
Review the following Markdown chapter and fix ALL issues. FIX them directly — do not just report.

## PROFILE CONTEXT
- Source: ${nameSrc} → Target: ${nameTgt}
- Field suffixes: ${sfxSrc} (source), ${sfxTgt} (target)
- Domain: ${profile.domain || 'general'}
${isMono ? '- Mode: Monolingual (no bilingual checks needed)' : `- Mode: Bilingual (${fmt.definition_order}, ${fmt.term_annotation})`}
${s.code_language ? `- Code: ${s.code_language}, comments: ${s.code_comment_style}` : '- Code: none expected'}
- Math: ${s.math.inline}...${s.math.inline} / ${s.math.display}...${s.math.display}

## REVIEW CHECKLIST

### A. Structure
- Chapter title matches the template format
${tplHasEpigraph(profile) ? '- Epigraph present and correctly formatted' : ''}
- TOC lists every section with working anchor links
- Section separators (${profile.template.separator}) correctly placed
- Chapter-end sections present per profile

${!isMono ? `### B. Definitions & Theorems
- Every definition: source line + target line (order: ${fmt.definition_order})
- Every theorem: source line + target line with matching labels
- Terms bolded with annotation in target text
- No stray null/empty values from JSON` : `### B. Definitions (monolingual)
- Every definition renders correctly in ${nameTgt}
- No stray annotation artifacts from JSON`}

${s.code_language ? `### C. Code
- All code blocks use \\\`\\\`\\\`${s.code_language}
- Comments use ${s.code_comment_style}
- Consistent indentation
- No syntax errors` : `### C. Code (SKIP — no code in this course)`}

### D. Tables
- Headers match profile table templates
${s.math.inline ? `- Math values in ${s.math.inline}...${s.math.inline}` : ''}
- First column bolded${fmt.table_first_column_bold ? ' with annotation' : ''}
- No empty cells

### E. Math & Formulas
- Inline: ${s.math.inline}...${s.math.inline}
- Display: ${s.math.display}...${s.math.display}
- No stray delimiters
- Commands and Greek letters correct

${!isMono ? `### F. Terminology Consistency
Verify terms against this dictionary:
${profile._termDictForReview}

- Terms match authoritative translations
- First occurrence per section annotated (${fmt.term_annotation})
- Subsequent occurrences NOT annotated
- No annotations inside math blocks` : `### F. Terminology (monolingual)
- Key terms used consistently throughout
- No cross-language annotation artifacts`}

### G. Polish
${profile._punctRules}
- No markdown syntax errors
- Consistent blank line spacing

### H. Domain-Specific Checks (${profile.domain || 'general'})
${profile._domainHints.stage4}

**CRITICAL**: Only FIX existing content. Do NOT add new definitions, examples, theorems, or concepts not already in the input. If content is missing, note it in Warnings — do not invent it.

## OUTPUT
Output the COMPLETE corrected Markdown. Then append:

## Review Summary

### Fixed
(List what was fixed)

### Verified
- Structure matches profile
${!isMono ? '- Definitions/theorems properly bilingual' : '- Definitions properly rendered'}
${s.code_language ? '- Code blocks consistently formatted' : ''}
- Math properly delimited
- Chapter-end sections present

### Warnings
(List anything needing human review)

## INPUT MARKDOWN:
${stage3Markdown}`
}

function tplHasEpigraph(profile) {
  return profile.template?.epigraph && profile.template.epigraph !== 'null'
}

// ── Main Pipeline ─────────────────────────────────────────────────────────

const TEXTBOOK = args?.textbook ?? ''
const CHAPTER = args?.chapter_number ?? 0
const TITLE_EN = args?.chapter_title_en ?? ''
const TITLE_CN = args?.chapter_title_cn ?? ''
const EPIGRAPH_EN = args?.epigraph_en ?? ''
const EPIGRAPH_CN = args?.epigraph_cn ?? ''
const OUTPUT = args?.output_path ?? `Ch${String(CHAPTER).padStart(2, '0')}-${TITLE_EN.replace(/\s+/g, '-')}.md`

if (!TEXTBOOK || TEXTBOOK.length < 100) {
  log('ERROR: args.textbook is required (min 100 chars).')
  log('Usage: /workflow .pipeline/workflow.js textbook="<chapter text>" chapter_number=1 chapter_title_en="Title"')
  throw new Error('Missing textbook content')
}

// ── Phase 0: Load Profile ─────────────────────────────────────────────────
phase('Load Profile')
const profile = buildProfile(args)
log('')

// ── Phase 1: Extract ──────────────────────────────────────────────────────
phase('Extract')

log('🔍 Stage 1/4: Extracting structured content...')
const stage1Prompt = buildStage1Prompt(profile, TEXTBOOK)

const stage1Result = await agent(stage1Prompt, {
  label: 'stage1-extract',
  phase: 'Extract',
  schema: {
    type: 'object',
    properties: {
      chapter: {
        type: 'object',
        properties: {
          number: { type: 'number' },
          sections: { type: 'array' }
        },
        required: ['sections']
      }
    },
    required: ['chapter']
  }
})

if (!stage1Result?.chapter) {
  log('❌ Stage 1 failed: no valid JSON output.')
  throw new Error('Stage 1 extraction failed')
}

log(`✅ Stage 1 complete: ${stage1Result.chapter.sections.length} sections extracted`)
const stage1Json = JSON.stringify(stage1Result, null, 2)

// ── Phase 2: Bilingual (or Monolingual Pass-Through) ──────────────────────
phase('Bilingual')

if (profile._isMonolingual) {
  log(`🌐 Stage 2/4: Monolingual mode (${profile._langNameTgt}) — passing through...`)
} else {
  log(`🌐 Stage 2/4: Translating (${profile._langNameSrc} → ${profile._langNameTgt})...`)
}

const stage2Prompt = buildStage2Prompt(profile, stage1Json)

const stage2Schema = profile._isMonolingual ? null : {
  type: 'object',
  properties: {
    chapter: {
      type: 'object',
      properties: {
        number: { type: 'number' },
        sections: { type: 'array' }
      },
      required: ['sections']
    }
  },
  required: ['chapter']
}

const stage2Result = await agent(stage2Prompt, {
  label: 'stage2-bilingual',
  phase: 'Bilingual',
  schema: stage2Schema
})

if (!stage2Result?.chapter) {
  log('❌ Stage 2 failed: no valid JSON output.')
  throw new Error('Stage 2 processing failed')
}

log(`✅ Stage 2 complete: ${stage2Result.chapter.sections.length} sections processed`)
const stage2Json = JSON.stringify(stage2Result, null, 2)

// ── Phase 3: Render ───────────────────────────────────────────────────────
phase('Render')

log('📝 Stage 3/4: Rendering Markdown...')
const chapterMeta = {
  chapter: CHAPTER,
  title_en: TITLE_EN,
  title_cn: TITLE_CN,
  epigraph_en: EPIGRAPH_EN || '',
  epigraph_cn: EPIGRAPH_CN || ''
}
const stage3Prompt = buildStage3Prompt(profile, stage2Json, chapterMeta)

const stage3Result = await agent(stage3Prompt, {
  label: 'stage3-render',
  phase: 'Render',
})

if (!stage3Result || stage3Result.length < 200) {
  log('❌ Stage 3 failed: output too short.')
  throw new Error('Stage 3 rendering failed')
}

log(`✅ Stage 3 complete: ~${stage3Result.length} characters of Markdown`)

// ── Phase 4: Review ───────────────────────────────────────────────────────
phase('Review')

log('🔍 Stage 4/4: Reviewing and enhancing...')
const stage4Prompt = buildStage4Prompt(profile, stage3Result)

const stage4Result = await agent(stage4Prompt, {
  label: 'stage4-review',
  phase: 'Review',
})

if (!stage4Result || stage4Result.length < 200) {
  log('❌ Stage 4 failed: output too short.')
  throw new Error('Stage 4 review failed')
}

log(`✅ Stage 4 complete: ~${stage4Result.length} characters`)

// ── Output ─────────────────────────────────────────────────────────────────
log('')
log(`📄 Output: ${OUTPUT}`)
log(`📊 ${profile._isMonolingual ? 'Monolingual' : 'Bilingual'} | ${profile.domain || 'general'} | ${stage2Result.chapter.sections.length} sections | ${profile._flatTerms.length} terms | ${TEXTBOOK.length} → ${stage4Result.length} chars`)
log('')
log('✅ Pipeline complete!')
log('   To write the output: copy final_markdown from the return value,')
log('   or say "write the final markdown to file" in the next message.')

return {
  output_path: OUTPUT,
  profile: profile.name,
  domain: profile.domain,
  monolingual: profile._isMonolingual,
  final_markdown: stage4Result,
  stats: {
    chapter: CHAPTER,
    sections: stage2Result.chapter.sections.length,
    terms: profile._flatTerms.length,
    input_chars: TEXTBOOK.length,
    output_chars: stage4Result.length,
  },
  intermediate: { stage1Json, stage2Json, stage3Markdown: stage3Result }
}
