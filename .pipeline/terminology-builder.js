export const meta = {
  name: 'terminology-builder',
  description: 'Auto-extract domain-specific terminology from sample textbook chapters. Outputs a complete terminology YAML block ready to paste into a profile.',
  phases: [
    { title: 'Extract Terms', detail: 'Identify all domain-specific terms from sample chapters' },
    { title: 'Build Dictionary', detail: 'Suggest translations and organize into categories' },
  ],
}

// =============================================================================
// Terminology Builder — Auto-Bootstrap a Terminology Dictionary
// =============================================================================
// Usage:
//   /workflow .pipeline/terminology-builder.js sample_chapters="<2-3 chapters>" domain="physics" target_language="zh-CN"
//
// The workflow:
//   1. Reads 2-3 sample chapters
//   2. Identifies all domain-specific technical terms
//   3. Groups them into categories
//   4. Suggests target-language translations
//   5. Outputs a complete terminology YAML block
// =============================================================================

const SAMPLES = args?.sample_chapters ?? ''
const DOMAIN = args?.domain ?? 'general'
const TARGET_LANG = args?.target_language ?? 'zh-CN'
const DOMAIN_DESC = args?.domain_description ?? ''

if (!SAMPLES || SAMPLES.length < 300) {
  log('ERROR: args.sample_chapters is required (min 300 chars, ideally 2-3 chapters).')
  log('Usage: /workflow .pipeline/terminology-builder.js sample_chapters="<text>" domain="physics"')
  throw new Error('Missing sample_chapters')
}

log('📚 Terminology Builder — auto-extracting terms from sample chapters')
log(`   Domain: ${DOMAIN}`)
log(`   Target language: ${TARGET_LANG}`)
log(`   Sample size: ~${SAMPLES.length} characters`)
log('')

// ── Phase 1: Extract Terms ───────────────────────────────────────────────
phase('Extract Terms')

const EXTRACT_PROMPT = `You are a domain terminology expert specializing in ${DOMAIN}${DOMAIN_DESC ? ` (${DOMAIN_DESC})` : ''}.

## TASK
Read the following sample textbook chapters and extract ALL domain-specific technical terms. These are terms that:
1. Have a precise, field-specific meaning
2. A student would need to learn and remember
3. Appear consistently throughout the textbook (not one-off mentions)

## DOMAIN CONTEXT
Domain: ${DOMAIN}
Target translation language: ${TARGET_LANG}

## SAMPLE CHAPTERS
${SAMPLES.length > 15000 ? SAMPLES.slice(0, 8000) + '\n\n[... ' + (SAMPLES.length - 16000) + ' more characters in full text — processing key portions ...]\n\n' + SAMPLES.slice(-8000) : SAMPLES}

## INSTRUCTIONS

### Step 1: Identify Terms
Go through the text and identify every technical term. Include:
- Core concepts (nouns: "entropy", "derivative", "ecosystem")
- Important verbs used technically ("differentiate", "catalyze", "modulate")
- Named entities ("Maxwell's Equations", "Krebs Cycle", "Bayes' Theorem")
- Adjectives with technical meaning ("adiabatic", "isomorphic", "endogenous")
- Abbreviations and symbols that are domain-standard ("DNA", "GDP", "pH")

Exclude:
- Common English words used in their ordinary sense
- Terms that appear only once as an aside
- Proper names of people (except when part of named concepts)

### Step 2: Categorize Terms
Group terms into 3-8 logical categories relevant to this domain.

For ${DOMAIN}, typical categories might be:
${DOMAIN === 'math_pure' ? '- Fundamental Concepts, Algebraic Structures, Topological Concepts, Analysis Terms, Proof Techniques' : ''}
${DOMAIN === 'physics' ? '- Mechanics, Electromagnetism, Thermodynamics, Quantum Physics, Mathematical Tools, Experimental Terms, Constants' : ''}
${DOMAIN === 'chemistry' ? '- General Concepts, Organic Chemistry, Inorganic Chemistry, Physical Chemistry, Lab Techniques, Nomenclature' : ''}
${DOMAIN === 'biology' ? '- Molecular Biology, Cell Biology, Genetics, Ecology, Evolution, Physiology, Lab Techniques' : ''}
${DOMAIN === 'economics' ? '- Microeconomics, Macroeconomics, Econometrics, Finance, Policy, Mathematical Tools' : ''}
${DOMAIN === 'humanities' ? '- Literary Theory, Historical Context, Philosophical Concepts, Critical Approaches, Genre Terms' : ''}
${DOMAIN === 'social_science' ? '- Research Methods, Theoretical Frameworks, Statistical Terms, Key Studies, Measurement' : ''}
${DOMAIN === 'cs_theory' ? '- Data Structures, Algorithms, Complexity Analysis, Graph Theory, Sorting, Hashing' : ''}
${DOMAIN === 'cs_systems' ? '- Architecture, Networking, Operating Systems, Databases, Security, Protocols' : ''}
${DOMAIN === 'math_applied' ? '- Probability, Statistics, Optimization, Numerical Methods, Linear Algebra, Modeling' : ''}
${DOMAIN === 'engineering' ? '- Design Principles, Materials, Standards, Calculations, Safety, Quality Control' : ''}
${DOMAIN === 'general' ? '(organize terms into logical groups based on what you find in the text)' : ''}

### Step 3: Provide Translations
For each term, provide an accurate ${TARGET_LANG} translation using standard academic terminology. ${TARGET_LANG === 'zh-CN' ? 'Use mainland Chinese academic conventions (not Taiwanese).' : `Use standard ${TARGET_LANG} academic terminology.`}

## OUTPUT FORMAT
Output a JSON object:
{
  "domain": "${DOMAIN}",
  "target_language": "${TARGET_LANG}",
  "total_terms": 75,
  "categories": [
    {
      "name": "category_name_en",
      "name_${TARGET_LANG === 'zh-CN' ? 'cn' : TARGET_LANG}": "Category Name in Target Language",
      "terms": [
        {"en": "Technical Term", "${TARGET_LANG === 'zh-CN' ? 'cn' : TARGET_LANG}": "专业翻译"},
        ...
      ]
    },
    ...
  ]
}

Output ONLY valid JSON. Extract as many terms as you can find — aim for 50+.`

const extractResult = await agent(EXTRACT_PROMPT, {
  label: 'extract-terms',
  phase: 'Extract Terms',
  schema: {
    type: 'object',
    properties: {
      domain: { type: 'string' },
      target_language: { type: 'string' },
      total_terms: { type: 'number' },
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            terms: { type: 'array' }
          },
          required: ['name', 'terms']
        }
      }
    },
    required: ['domain', 'categories']
  }
})

if (!extractResult || !extractResult.categories) {
  log('❌ Term extraction failed.')
  throw new Error('Term extraction failed')
}

const totalTerms = extractResult.categories.reduce((sum, cat) => sum + (cat.terms?.length || 0), 0)
log(`✅ Extracted ${totalTerms} terms in ${extractResult.categories.length} categories`)
for (const cat of extractResult.categories) {
  log(`   ${cat.name}: ${cat.terms?.length || 0} terms`)
}
log('')

// ── Phase 2: Build Dictionary YAML ────────────────────────────────────────
phase('Build Dictionary')

// Build the YAML output
const targetKey = TARGET_LANG === 'zh-CN' ? 'cn' : TARGET_LANG
let yamlOutput = `# =============================================================================
# Terminology Dictionary — ${DOMAIN} (auto-generated)
# =============================================================================
# Generated from sample chapters on ${new Date().toISOString().slice(0, 10)}
# Total: ${totalTerms} terms in ${extractResult.categories.length} categories
#
# To use: copy this entire block into your profile's "terminology:" section.
# Review translations before final use — machine suggestions may need adjustment.
# =============================================================================

terminology:
`

for (const cat of extractResult.categories) {
  const catName = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  yamlOutput += `  ${catName}:\n`
  for (const term of (cat.terms || [])) {
    const en = term.en || 'TERM'
    const target = term[targetKey] || 'TRANSLATION'
    yamlOutput += `    - { ${targetKey}: "${target}", en: "${en}" }\n`
  }
  yamlOutput += '\n'
}

log('✅ Terminology YAML generated!')
log(`   ${totalTerms} terms ready for use`)
log('')

return {
  domain: DOMAIN,
  total_terms: totalTerms,
  categories: extractResult.categories.length,
  terminology_yaml: yamlOutput,
  structured_data: extractResult,
  instructions: `
## How to Use

1. Copy the \`terminology_yaml\` block above
2. Paste it into your profile's \`terminology:\` section:
   profiles/my-course.yaml → profile.terminology

3. Review and refine:
   - Check translations for accuracy (especially ambiguous terms)
   - Add any terms you notice are missing
   - Remove terms that aren't actually central to the course

4. Re-run with more chapters for better coverage:
   /workflow .pipeline/terminology-builder.js sample_chapters="<chapters 4-6>" domain="${DOMAIN}"

5. Use the enriched profile:
   /workflow .pipeline/workflow.js profile_path="profiles/my-course.yaml" textbook="..." ...
  `.trim()
}
