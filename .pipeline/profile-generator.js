export const meta = {
  name: 'profile-generator',
  description: 'Guided wizard: analyze a sample textbook chapter and generate a course profile for the note-generation pipeline.',
  phases: [
    { title: 'Analyze Sample', detail: 'Analyze a sample chapter to detect languages, section patterns, code, and content types' },
    { title: 'Generate Profile', detail: 'Assemble a draft profile YAML based on the analysis' },
  ],
}

// =============================================================================
// Profile Generator — Sample Chapter → Course Profile
// =============================================================================
// Usage:
//   /workflow .pipeline/profile-generator.js sample_text="<chapter text>"
//   /workflow .pipeline/profile-generator.js sample_text="<text>" course_name="Physics 101" target_language="zh-CN"
//
// The workflow analyzes the sample and produces a profile YAML file.
// Save the output as profiles/your-course.yaml, then use with workflow.js.
// =============================================================================

const SAMPLE = args?.sample_text ?? ''
const COURSE_NAME = args?.course_name ?? ''
const TARGET_LANG = args?.target_language ?? 'zh-CN'
const ANNOTATION_LANG = args?.annotation_language ?? 'en'

if (!SAMPLE || SAMPLE.length < 200) {
  log('ERROR: args.sample_text is required (min 200 chars of a sample chapter).')
  log('Usage: /workflow .pipeline/profile-generator.js sample_text="<chapter text>" course_name="Course Name"')
  throw new Error('Missing sample_text')
}

log('🔍 Profile Generator — analyzing sample chapter...')
log(`   Sample size: ~${SAMPLE.length} characters`)
if (COURSE_NAME) log(`   Course: ${COURSE_NAME}`)
log('')

// ── Phase 1: Analyze the Sample ───────────────────────────────────────────
phase('Analyze Sample')

const ANALYSIS_PROMPT = `You are a textbook structure analyst. Analyze the following sample chapter and answer these questions precisely.

## Sample Chapter Text
${SAMPLE.length > 8000 ? SAMPLE.slice(0, 4000) + '\n\n[... ' + (SAMPLE.length - 8000) + ' more characters — analyzing structure from sampled portions ...]\n\n' + SAMPLE.slice(-4000) : SAMPLE}

## Questions

1. **Source language**: What language is this textbook written in? (ISO 639-1: en, zh, ja, fr, de, es, etc.)

2. **Section structure**: How are sections/sub-sections marked?
   - Look for patterns like: §1, §2.1, 1.1, Section 1, Chapter 2, 第X节, etc.
   - Write a REGEX pattern that would match section headers.
   - Classify as: "§-prefixed", "dotted" (1.1, 2.3), "numbered" (Section 1), or "heading" (## Heading)

3. **Code**: Is there programming code in this chapter? If yes:
   - What language(s)? (c, python, java, javascript, rust, pseudocode, etc.)
   - What comment syntax is used? (//, #, /* */, --, etc.)
   - Estimate: what % of the chapter is code?

4. **Content types**: Which of these content types appear in the sample?
   Rate each as: "abundant", "present", "rare", or "absent".
   - definition (formal term definitions)
   - theorem (named theorems, lemmas, laws, corollaries)
   - code (source code snippets)
   - complexity_table (algorithm complexity analysis tables)
   - example (worked examples with data/numbers)
   - comparison_table (side-by-side comparison tables)
   - note (important remarks, tips, warnings)
   - figure (images, diagrams, charts — look for figure references)
   - derivation (step-by-step formula derivations)
   - equation (standalone equations, not inline math)
   - experiment (lab experiment descriptions)

5. **Chapter structure**:
   - Is there an epigraph/quote at the chapter start?
   - Does the chapter have a summary section at the end?
   - Does it have a glossary or terminology list?
   - Does it have practice problems or exam points?

6. **Math notation**:
   - Are there math formulas? If yes, are they in LaTeX ($...$ / $$...$$) or plain text?
   - Are complexity classes mentioned (O(n), Θ(n), Ω(n))?

7. **Technical terms**: List 15-25 key technical terms from this chapter that would need consistent translation.

8. **Domain classification**: Which domain does this textbook belong to?
   Choose the BEST match from this catalog:
   - cs_theory: CS theory, algorithms, data structures, complexity
   - cs_systems: OS, networks, databases, compilers, architecture
   - math_pure: Real analysis, algebra, topology, number theory
   - math_applied: Numerical methods, optimization, probability, statistics
   - physics: Mechanics, E&M, thermodynamics, quantum, relativity
   - chemistry: Organic, inorganic, physical, analytical, biochemistry
   - biology: Molecular bio, cell bio, genetics, ecology, physiology
   - engineering: EE, ME, civil, chemical engineering, materials
   - economics: Micro, macro, econometrics, finance
   - humanities: Literature, history, philosophy, art history
   - social_science: Psychology, sociology, political science, anthropology
   - general: None of the above or mixed content

Output your analysis as structured JSON:
{
  "source_language": "en",
  "section_pattern": "§(\\\\d+)",
  "section_style": "§-prefixed",
  "code_language": "c",
  "code_comment_style": "/* %s */",
  "code_percentage": 20,
  "content_types": {
    "definition": "abundant",
    "theorem": "present",
    "code": "abundant",
    "complexity_table": "present",
    "example": "present",
    "comparison_table": "rare",
    "note": "present",
    "figure": "present",
    "derivation": "present",
    "equation": "rare",
    "experiment": "absent"
  },
  "chapter_structure": {
    "has_epigraph": true,
    "has_summary": true,
    "has_glossary": false,
    "has_exam_points": true
  },
  "math": {
    "has_formulas": true,
    "is_latex": true,
    "has_complexity": true
  },
  "sample_terms": [
    {"en": "Algorithm", "suggested_translation": "算法"},
    {"en": "Time Complexity", "suggested_translation": "时间复杂度"}
  ],
  "suggested_profile_name": "my-course"
}`

const analysis = await agent(ANALYSIS_PROMPT, {
  label: 'analyze-sample',
  phase: 'Analyze Sample',
  schema: {
    type: 'object',
    properties: {
      source_language: { type: 'string' },
      section_pattern: { type: 'string' },
      section_style: { type: 'string' },
      code_language: { type: 'string' },
      code_comment_style: { type: 'string' },
      code_percentage: { type: 'number' },
      content_types: { type: 'object' },
      chapter_structure: { type: 'object' },
      math: { type: 'object' },
      sample_terms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            en: { type: 'string' },
            suggested_translation: { type: 'string' }
          }
        }
      },
      suggested_profile_name: { type: 'string' },
      detected_domain: { type: 'string' }
    },
    required: ['source_language', 'section_pattern', 'section_style', 'detected_domain']
  }
})

if (!analysis) {
  log('❌ Analysis failed.')
  throw new Error('Sample analysis failed')
}

log('✅ Sample analysis complete:')
log(`   Domain: ${analysis.detected_domain || 'general'}`)
log(`   Language: ${analysis.source_language}`)
log(`   Sections: ${analysis.section_style} (${analysis.section_pattern})`)
log(`   Code: ${analysis.code_language || 'none'} (~${analysis.code_percentage || 0}%)`)
log(`   Math: ${analysis.math?.has_formulas ? 'Yes (LaTeX)' : 'No'}`)
log(`   Terms found: ${(analysis.sample_terms || []).length}`)

const contentTypes = Object.entries(analysis.content_types || {})
  .filter(([_, rating]) => rating === 'abundant' || rating === 'present')
  .map(([type]) => type)
log(`   Content types: ${contentTypes.join(', ')}`)
log('')

// ── Phase 2: Generate Profile ─────────────────────────────────────────────
phase('Generate Profile')

const ab = (val) => val === 'abundant'
const present = (val) => val === 'abundant' || val === 'present'
const ct = analysis.content_types || {}
const cs = analysis.chapter_structure || {}
const terms = (analysis.sample_terms || [])

// Build the profile YAML
const profileName = analysis.suggested_profile_name || COURSE_NAME?.toLowerCase().replace(/\s+/g, '-') || 'my-course'
const displayName = COURSE_NAME || 'My Course'
const srcLang = analysis.source_language || 'en'
const hasCode = analysis.code_language && analysis.code_language !== 'none'
const isLatex = analysis.math?.is_latex !== false
const hasComplexity = analysis.math?.has_complexity === true

const endSections = []
if (cs.has_summary) endSections.push(`  - id: chapter_summary\n    heading: "## Summary"\n    optional: true`)
endSections.push(`  - id: term_glossary\n    heading: "## Key Terms"\n    optional: false`)
if (cs.has_exam_points) endSections.push(`  - id: exam_points\n    heading: "## Review Questions"\n    optional: true`)

const tableDefs = []
if (hasComplexity) {
  tableDefs.push(`  complexity:\n    headers: ["Case", "Condition", "Time Complexity"]`)
}
tableDefs.push(`  term_glossary:\n    headers: ["Term", "Definition"]`)

const termEntries = terms.map(t =>
  `    - { ${TARGET_LANG === 'zh-CN' ? 'cn' : TARGET_LANG}: "${t.suggested_translation || 'TERM'}", en: "${t.en}" }`
).join('\n')

const profileYaml = `# =============================================================================
# Course Profile: ${displayName}
# =============================================================================
# Auto-generated by profile-generator.js on ${new Date().toISOString().slice(0, 10)}
# Review and adjust before using. Pay special attention to:
#   - terminology dictionary (add ALL terms from your textbook)
#   - chapter end sections (add/remove as needed)
#   - table templates (add tables specific to your course)
# =============================================================================

profile:
  name: "${profileName}"
  display: "${displayName}"
  description: "Auto-generated profile for ${displayName}"
  domain: "${analysis.detected_domain || 'general'}"

  # ── Languages ──────────────────────────────────────────────────────
  languages:
    source: "${srcLang}"
    target: "${TARGET_LANG}"
    annotation: ${ANNOTATION_LANG ? `"${ANNOTATION_LANG}"` : 'null'}
    annotation_style: "parens"

  # ── Source Text Parsing ────────────────────────────────────────────
  source:
    chapter_pattern: "Chapter (\\\\d+)"
    section_pattern: "${(analysis.section_pattern || '§(\\\\d+)').replace(/\\/g, '\\\\')}"
    section_style: "${analysis.section_style || '§-prefixed'}"
    code_language: ${hasCode ? `"${analysis.code_language}"` : 'null'}
    code_comment_style: ${hasCode ? `"${analysis.code_comment_style || '// %s'}"` : 'null'}
    math: { inline: "$", display: "$$" }

  # ── Content Model ──────────────────────────────────────────────────
  content_types:
${contentTypes.map(t => `    - ${t}`).join('\n')}

  # ── Chapter Template ───────────────────────────────────────────────
  template:
    title: "${TARGET_LANG === 'zh-CN' ? `# 第{chapter}章：{title_cn} (Chapter {chapter}: {title_en})` : `# Chapter {chapter}: {title_en}`}"
    epigraph: ${cs.has_epigraph ? '"> **{epigraph_en}** {epigraph_cn}"' : 'null'}
    section: "${analysis.section_style === '§-prefixed' ? `## §{number} {title_cn} {title_en}` : `## {number} {title_cn} ({title_en})`}"
    subsection: "### {title_cn}"
    separator: "---"
    toc_heading: "${TARGET_LANG === 'zh-CN' ? '## 目录' : '## Contents'}"
    toc_entry: "{idx}. [{section} {title_en} {title_cn}](#{anchor})"

    end_sections:
${endSections.join('\n')}

  # ── Label Dictionary ───────────────────────────────────────────────
  labels:
    definition:    { en: "Definition"${TARGET_LANG === 'zh-CN' ? ', cn: "定义"' : ''} }
    theorem:       { en: "Theorem"${TARGET_LANG === 'zh-CN' ? ', cn: "定理"' : ''} }
    proof:         { en: "Proof"${TARGET_LANG === 'zh-CN' ? ', cn: "证明"' : ''} }
    note:          { en: "Note"${TARGET_LANG === 'zh-CN' ? ', cn: "注"' : ''} }
    example:       { en: "Example"${TARGET_LANG === 'zh-CN' ? ', cn: "示例"' : ''} }
    figure:        { en: "Figure"${TARGET_LANG === 'zh-CN' ? ', cn: "图"' : ''} }

  # ── Table Templates ────────────────────────────────────────────────
  tables:
${tableDefs.join('\n')}

  # ── Formatting Rules ───────────────────────────────────────────────
  formatting:
    definition_order: "en_first"
    term_annotation: "first_per_section"
    table_first_column_bold: true
    blank_lines_around_blocks: true

  # ── Image References ───────────────────────────────────────────────
  images:
    path_pattern: "images/ch{chapter:02d}-{slug}.png"
    alt_text: "{description_cn}"
    demo_link: null

  # ── Review Rules ───────────────────────────────────────────────────
  review:
    check_term_consistency: true
    check_latex: ${isLatex}
    check_code_comments: ${hasCode}
    check_missing_summaries: true
    punctuation:
      chinese_in_chinese_text: ${TARGET_LANG === 'zh-CN'}
      no_html_tags: true

  # ── Terminology Dictionary ─────────────────────────────────────────
  # 🔧 IMPORTANT: This is a STARTER dictionary from the sample chapter.
  # Add ALL technical terms from your full textbook here.
  terminology:
    sample_terms:
${termEntries}
    # 🔧 Add more term categories below:
    # more_terms:
    #   - { ${TARGET_LANG === 'zh-CN' ? 'cn' : TARGET_LANG}: "...", en: "..." }
`
// End of profile YAML

log('✅ Profile YAML generated!')
log(`   Lines: ~${profileYaml.split('\n').length}`)
log('')

return {
  profile_name: profileName,
  profile_yaml: profileYaml,
  analysis_summary: {
    domain: analysis.detected_domain || 'general',
    source_language: analysis.source_language,
    section_style: analysis.section_style,
    code_language: analysis.code_language || 'none',
    content_types: contentTypes,
    terms_found: terms.length,
  },
  instructions: `
## Next Steps

1. **Save the profile:**
   Copy the \`profile_yaml\` field above and save it as:
   \`.pipeline/profiles/${profileName}.yaml\`

2. **Review and enhance:**
   - Add ALL terminology from your textbook to the terminology dictionary
   - Adjust table templates for your course's specific tables
   - Verify section patterns work for all chapters
   - Add/remove chapter-end sections

3. **Test the profile:**
   /workflow .pipeline/workflow.js profile_path="profiles/${profileName}.yaml" textbook="<chapter text>" chapter_number=1 chapter_title_en="Title" chapter_title_cn="标题"

4. **For manual use:**
   /workflow .pipeline/build-prompts.js profile_path="profiles/${profileName}.yaml"
  `.trim()
}
