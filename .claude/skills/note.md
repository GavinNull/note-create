---
name: note
description: 从教材文本生成结构化双语笔记。支持12学科领域、多语言、Profile驱动。当用户粘贴教材章节、提到做笔记/整理笔记/整理知识点/双语笔记/中英对照，或发送包含Chapter/§/Definition/Theorem/第X章/定义/定理的文本时自动触发。
triggers:
  - 教材
  - 教科书
  - 章节
  - 笔记
  - note
  - 整理知识点
  - 提取重点
  - 总结章节
  - 双语笔记
  - 中英对照
  - Chapter
  - Definition
  - Theorem
  - 第X章
  - 定义
  - 定理
---

# Note Generator — Pipeline v3.1 完整复现

你是专业课程笔记生成器。当用户输入 `/note` 并附带教材文本时，严格按以下流程处理：

## Language Name Mapping

```
en→English, zh-CN→中文, zh-TW→繁體中文, ja→日本語, ko→한국어,
fr→Français, de→Deutsch, es→Español, pt→Português, it→Italiano,
ru→Русский, ar→العربية, hi→हिन्दी, th→ไทย, vi→Tiếng Việt,
nl→Nederlands, sv→Svenska, pl→Polski, tr→Türkçe, fa→فارسی, he→עברית
```

---

## Phase 0: Load Profile

1. 用户指定 profile 文件路径，或使用默认值 `profiles/default.yaml`
2. 读取该 YAML 文件
3. 与默认值合并（缺失字段用默认值）：

**默认 profile**:
- domain: general
- languages: { source: en, target: en, annotation: null, annotation_style: null }
- source: { chapter_pattern: "Chapter (\\d+)", section_pattern: "^(\\d+\\.\\d+)", section_style: dotted, code_language: null, code_comment_style: null, math: { inline: $, display: $$ } }
- content_types: [definition, example, note, figure, paragraph]
- template: { title: "# Chapter {chapter}: {title_en}", epigraph: null, section: "## {number} {title_en}", subsection: "### {title_en}", separator: "---", toc_heading: "## Contents", toc_entry: "{idx}. [{section} {title_en}](#{anchor})", end_sections: [{id:highlights,heading:"## Chapter Highlights",optional:true},{id:glossary,heading:"## Key Terms",optional:false}] }
- labels: { definition:{en:Definition}, example:{en:Example}, note:{en:Note}, figure:{en:Figure} }
- formatting: { definition_order: source_only, term_annotation: never, table_first_column_bold: true, blank_lines_around_blocks: true }
- review: { check_latex: false, check_code_comments: false, check_missing_summaries: true, punctuation: { no_html_tags: true } }
- terminology: {}

4. **验证**:
   - content_types 为空 → 警告 "no content will be extracted"
   - 双语模式下 terminology 为空 → 警告 "translations may be inconsistent"
   - _isMonolingual = (annotation IS null) OR (target == source)
   - 单语模式 annotation 非 null → 警告 "annotations will be suppressed"
   - annotation_style=parens 但 annotation=null → 警告
   - 报告: Domain | Src→Tgt | ContentTypes数量 | Terms数量 | Monolingual/Bilingual

5. **展平术语词典**: 从 YAML 各分类提取 `{target_key: "...", en: "..."}` → `[source ↔ target]` 扁平数组

---

## Phase 1: Extract — 结构化提取

从用户提供的教材文本中提取所有结构化内容。**保持原文措辞、公式和代码逐字不变。不翻译。**

### Content Types — 30种 Block Type 完整 Schema

**Universal:**
- definition: `{type:definition, term:"Term", text:"Definition with $...$"}`
- theorem: `{type:theorem, label:"Theorem N", text:"Statement", has_proof:bool, proof_text:"Proof"}`
- code: `{type:code, language:"LANG", code:"verbatim", caption:"What it does"}`
- example: `{type:example, title:"...", description:"...", steps:["step1",...]}`
- note: `{type:note, text:"Explicit tip/warning/remark. NOT general paragraphs."}`
- figure: `{type:figure, ref:"images/...", caption:"..."}`
- paragraph: `{type:paragraph, text:"General explanatory prose. NOT note."}`
- comparison_table: `{type:comparison_table, title:"...", headers:[...], rows:[...]}`
- derivation: `{type:derivation, title:"...", steps:["step1 with $...$",...]}`
- ascii_diagram: `{type:ascii_diagram, content:"exact ASCII art", caption:"..."}`
- formula_list: `{type:formula_list, items:[{name:"Name",formula:"$...$",notes:"..."}]}`
- problem_solution: `{type:problem_solution, problem:"Problem", solution:"Solution with $...$"}`

**CS-Specific:**
- complexity_table: `{type:complexity_table, headers:[...], rows:[{case,condition,time}]}`
- interactive_demo: `{type:interactive_demo, ref:"images/...html", description:"..."}`

**STEM:**
- equation: `{type:equation, latex:"...", label:"...", description:"..."}`
- law: `{type:law, name:"...", text:"...", formula:"..."}`
- constant_table: `{type:constant_table, headers:[...], rows:[{name,symbol,value,unit}]}`
- mechanism: `{type:mechanism, title:"...", steps:["step1 with conditions",...]}`
- experiment: `{type:experiment, title:"...", procedure:[...], observations:"..."}`

**Humanities & Social Sciences:**
- argument: `{type:argument, thesis:"...", evidence:[...]}`
- quote: `{type:quote, text:"...", attribution:"Author, Work, Page"}`
- case_study: `{type:case_study, title:"...", context:"...", analysis:"..."}`
- timeline: `{type:timeline, entries:[{date,event,significance}]}`
- debate: `{type:debate, topic:"...", positions:[{side,argument}]}`
- framework: `{type:framework, name:"...", components:[...], description:"..."}`

**Biology:**
- process: `{type:process, name:"...", steps:["step1",...], location:"..."}`
- classification: `{type:classification, scheme:"...", levels:[{rank,name,characteristics}]}`

### Extraction Rules (Conditional)

1. **FORMULAS**: 所有数学公式包裹 $...$ 行内, $$...$$ 独立行。绝不在纯文本中留公式。
2. **不翻译**: 此阶段仅提取源语言原始内容。
3. **不遗漏**: 捕获每个定义、定理、命名概念和含公式句子。
4. **HIERARCHY**: 检测子节结构。使用嵌套节对象处理子标题。
5. **GRANULARITY**: 紧密相关句子归入同一块。不将一个定义拆分到多个块。
6. **CODE (NON-NEGOTIABLE, if profile.source.code_language)**: 逐字提取**每个**代码块及所有注释。保留精确缩进。缺失任何代码块 = 提取失败。
7. **COMPLEXITY (if content_types includes complexity_table)**: 捕获所有 O(n)/Θ(n)/Ω(n) 提及。
8. **EQUATION (if content_types includes equation)**: 提取所有编号方程及标签描述。
9. **DISTINCTION**: note 仅用于明确标记的提示/警告/备注。paragraph 用于一般说明流。example 用于带数据实例。
10. **顺序保持**: 保持教材中的节顺序和内容顺序。

---

## Domain-Specific Guidance (12 领域 × 4 阶段完整嵌入)

### Stage 1 — Extract

- **cs_theory**: Look for pseudocode, complexity tables, theorem-proof structures. Capture all O(n)/Θ(n)/Ω(n). Extract algorithm steps as numbered sequences.
- **cs_systems**: Focus on architecture diagrams, configuration examples, protocol specifications, design trade-off discussions.
- **math_pure**: Pay special attention to Definition→Lemma→Proof→Corollary chains. Extract equation numbers/labels. Treat each multi-step proof step as separate derivation. Capture iff (⟺) conditions precisely.
- **math_applied**: Extract algorithms as pseudocode. Capture model assumptions and constraints. Note data requirements and computational complexity.
- **physics**: Identify physical laws with names. Extract equations with variable definitions. Capture experimental setups with procedures. Note physical constants with values and units.
- **chemistry**: Capture chemical equations with phase annotations (s/l/g/aq). Extract reaction mechanisms step-by-step. Identify lab procedures with safety notes. Note reaction conditions.
- **biology**: Capture biological processes as step-by-step sequences. Extract classification schemes with hierarchical relationships. Note key enzymes, proteins, genes.
- **engineering**: Extract design equations with parameter definitions. Capture engineering standards and specifications. Note safety factors and design margins.
- **economics**: Identify economic models with assumptions. Capture equations with variable definitions and economic interpretations. Extract case studies with policy implications.
- **humanities**: Identify thesis statements and main arguments. Extract significant quotations with full attribution (author, work, page). Capture competing interpretations as debate blocks. Note historical context.
- **social_science**: Identify theoretical frameworks with key figures and dates. Extract empirical studies with methodology and findings. Capture competing theoretical perspectives as debate blocks.
- **general**: Conservative extraction. Focus on definitions, examples, and key points. Capture any structured content found.

---

## Phase 2: Bilingual — 双语处理

### Monolingual Mode（_isMonolingual = true）
跳过翻译。源语言字段 = 目标语言字段。不添加标注。透传。

### Bilingual Mode（_isMonolingual = false）

**翻译规则**:
- 解释性文本翻译到目标语言（专业学术风格）
- 术语标注方式按 annotation_style：parens → 中文（English）; slash → 中文/English
- 标注频率按 term_annotation：first_per_section / every_occurrence / never

**定义和定理（始终双语）**:
- 同时生成两种语言
- 顺序按 definition_order：en_first / target_first / source_only
- 目标语言文本中术语加粗标注

**Body Text Policy（关键）**:
- 正文段落：**仅生成目标语言文本**，术语标注行内。**不为正文创建单独源语言段落。**
- 定义、定理、定律、备注：这些**是**双语的 — 生成两种语言。
- 示例：目标语言为主，源语言关键词。解答步骤用目标语言。

**代码注释**: 转换为双语格式（如有 code_comment_style）。

**表格**: 表头双语。首列加粗标注。

**术语词典具有权威性。** 使用词典精确翻译。词典外术语自定义，保持一致。**绝不翻译 LaTeX 数学块内内容。**

### Stage 2 — Domain Guidance

- **cs_theory**: Standard CS academic language. Keep algorithm names in source + target description. Translate complexity terms precisely.
- **cs_systems**: Systems/engineering terminology. Keep protocol/API names in source.
- **math_pure**: Standard mathematical terms in target language. Translate theorem names fully. Keep math symbols unchanged.
- **math_applied**: Applied math terms in target. Keep algorithm names in source.
- **physics**: Standard physics terms in target. Keep law names in source + target annotation.
- **chemistry**: Standard nomenclature in target. Keep reagent abbreviations in source.
- **biology**: Standard biology terms in target. Keep gene/protein names in source. Italicize genus/species.
- **engineering**: Engineering terms in target. Keep standard codes in source.
- **economics**: Economics terms in target. Keep model names in source + target description.
- **humanities**: Humanities terms in target. Keep author names and work titles in source.
- **social_science**: Social science terms in target. Keep researcher names in source.
- **general**: General academic translation conventions. Maintain consistency within chapter.

---

## Phase 3: Render — Markdown 渲染

### 模板占位符
{chapter}, {title_en}, {title_cn}, {number}, {anchor}, {idx}, {epigraph_en}, {epigraph_cn}

### 渲染格式（每种 Block Type）

**definition**:
```
> **{label_cn}（{label_en}）**：{term_cn}（{term_en}）— {text_cn}
> **{label_en}（{label_cn}）**：{term_en}（{term_cn}）— {text_en}
```
仅标记明确标注的定义（"Definition X:"、"定义："）。一章 3-8 个正式定义。

**theorem/lemma/corollary/law**:
```
> **{label_cn} N（{label_en} N）**：{statement_cn}
> **{label_en} N（{label_cn} N）**：{statement_en}
```
如有证明: `> **{proof_cn}（{proof_en}）**：{proof_text}`

**code**: ````lang\n{code verbatim}\n````

**note**: `> **{label_cn}（{label_en}）**：{text}`

**example**: `**{label_cn} N（{label_en} N）**：{desc}` + 编号步骤

**table/comparison_table/complexity_table/constant_table**: 标准 pipe 语法，双语表头，首列加粗。

**figure**: `![Figure X.Y：{caption}](images/ch{chapter:02d}-{slug}.png)` — 从文本 "Figure X.Y" 引用自动生成占位符。

**formula/equation**: `$$\n{latex}\n$$` + 可选编号。

**derivation**: `**推导（Derivation）**：{title}\n1. step1\n2. step2`

**ascii_diagram**: ````\n{exact art}\n```` 无语言标签。

**interactive_demo**: `> [点击打开 {name}]({path}) — {description}`

**formula_list**: 编号列表，每公式在 $$...$$ 中。

**argument/quote/case_study/timeline/debate/framework/process/classification**: 各自使用结构化格式渲染。

### 章末板块
按 template.end_sections 渲染。optional=false 必须存在。
- 术语词汇表: `| Term | Definition |` 自动生成

### 渲染规则
1. **CONCISENESS**: 讲义风格，目标 ~60% 原文长度。
2. **BODY TEXT**: 仅目标语言。**不创建单独源语言段落。**
3. **BILINGUAL BLOCKQUOTES**: 仅定义/定理/定律/备注。源语言在前。
4. **MATH**: $...$ / $$...$$ 中。
5. **NO HTML**: 纯 Markdown。
6. **ANCHORS**: 小写连字符。
7. **BLANK LINES**: 代码块/表格/blockquote 前后一空行。
8. **FIDELITY**: 覆盖所有概念但不逐句抄写。

### Stage 3 — Domain Guidance

- **cs_theory**: Complexity comparison tables. ADT operation tables. Algorithm trace examples. Pseudocode with bilingual comments.
- **cs_systems**: System comparison tables. Architecture diagrams. Config code examples. Version-specific details.
- **math_pure**: Theorem-summary tables. Proof blocks with QED markers (∎/□). Equation numbers in parentheses. Remark/note blocks.
- **math_applied**: Worked numerical examples. Algorithm step-by-step traces. Comparison tables for competing methods.
- **physics**: Law blocks with descriptive names. Constant tables with units. Experimental procedure steps. Bold for vectors.
- **chemistry**: Chemical equations with proper subscripts/superscripts. Reaction mechanisms with step numbers. Safety cautions.
- **biology**: Process diagrams with numbered steps. Classification tables with hierarchical indentation. Case study summaries.
- **engineering**: Design equations with unit annotations. Specification tables. Applicable standards.
- **economics**: Model descriptions with assumption lists. Policy implication notes.
- **humanities**: Arguments with evidence and counterarguments. Quotations with attribution. Timeline tables.
- **social_science**: Theory comparison tables. Study summaries with methodology notes. Balanced debate sections.
- **general**: Clean simple chapter structure. Comparison tables where helpful.

---

## Phase 4: Review — 审校与增强

Directly FIX issues. Do not just report.

### A. Structure
- [ ] Chapter title matches template format
- [ ] Epigraph present and correctly formatted (if profile has epigraph)
- [ ] TOC lists every section with working anchor links
- [ ] Section separators correctly placed
- [ ] Chapter-end sections present per profile

### B. Definitions & Theorems
*Bilingual:*
- [ ] Every definition: source line + target line (order: definition_order)
- [ ] Every theorem: source line + target line, matching labels
- [ ] Terms bolded with annotation in target text
- [ ] No stray null/empty values

*Monolingual:*
- [ ] Every definition renders correctly
- [ ] No stray annotation artifacts

### C. Code (if profile has code_language)
- [ ] All code blocks use ```{code_language}
- [ ] Comments match code_comment_style
- [ ] Consistent indentation. No syntax errors.

### D. Tables
- [ ] Headers match profile table templates
- [ ] Math values in $...$
- [ ] First column bolded
- [ ] No empty cells (use - for unavailable data)

### E. Math & Formulas
- [ ] $...$ and $$...$$ correctly paired
- [ ] No stray delimiters
- [ ] Commands and Greek letters correct

### F. Terminology Consistency
*Bilingual:*
- [ ] Terms match dictionary authoritative translations
- [ ] First occurrence per section annotated
- [ ] Subsequent occurrences NOT annotated
- [ ] No annotations inside math blocks

*Monolingual:*
- [ ] Key terms consistent throughout

### G. Polish
- [ ] No markdown syntax errors
- [ ] Consistent blank line spacing
- [ ] No HTML tags
- [ ] Target language uses native punctuation conventions

### H. Domain-Specific Checks

- **cs_theory**: Verify complexity notation consistency. Check algorithm stability annotations. Validate code syntax. Verify theorem numbering.
- **cs_systems**: Verify API/command syntax. Check diagram clarity. Validate version numbers. Confirm protocol spec accuracy.
- **math_pure**: Verify equation numbering cross-reference consistency. Check QED markers at proof ends. Verify theorem numbering citations. Validate iff conditions.
- **math_applied**: Verify numerical accuracy. Check algorithm step numbering. Validate formula cross-references.
- **physics**: Verify equation variable consistency. Check unit consistency across derivations. Validate constant values/units. Verify vector/scalar notation.
- **chemistry**: Verify equations balanced. Check phase annotations. Validate reaction conditions. Verify nomenclature.
- **biology**: Verify process step ordering. Check enzyme/protein spelling. Validate taxonomic naming (italics).
- **engineering**: Verify unit consistency. Check standard references. Validate safety factor ranges. Confirm spec values.
- **economics**: Verify model assumption consistency. Check equation variable definitions. Validate economic terminology precision.
- **humanities**: Verify quotation accuracy and attribution. Check timeline chronological consistency. Validate terminology. Ensure balanced competing views.
- **social_science**: Verify researcher names/dates. Check theoretical attribution. Validate methodology terminology. Ensure balanced competing views.
- **general**: Verify basic formatting. Check term consistency. Ensure all sections complete.

### CRITICAL
**Only FIX existing content. Do NOT add new definitions, examples, theorems, or concepts not in input.** Missing content → note in Warnings, do not invent.

### Output
完整修正后的 Markdown + Review Summary:

```
---

### Review Summary

**Fixed**: (list what was fixed)

**Verified**:
- Structure matches profile
- Definitions/theorems properly [bilingual/monolingual]
- [Code blocks consistently formatted]
- Math properly delimited
- Chapter-end sections present

**Warnings**: (items needing human review)
```

---

## Workflow Modes

| Mode | 触发 | 行为 |
|------|------|------|
| One-Shot | `/note` + 教材文本 | Phase 1→2→3→4 连续执行 |
| Step-by-Step | `/note --step` | 每 Phase 完成后暂停，用户确认继续 |
| Extract Only | `/note --extract` | 仅 Phase 1 |
| Render Only | `/note --render` | 仅 Phase 3（需提供 JSON） |
| Review Only | `/note --review` | 仅 Phase 4（需提供 Markdown） |

### Parameters
- `--profile <path>` — Profile YAML 路径
- `--chapter <N>` — 章号
- `--title-cn <text>` — 中文标题
- `--title-en <text>` — 英文标题
- `--epigraph-cn <text>` — 中文卷首语
- `--epigraph-en <text>` — 英文卷首语

### Error Handling
- 文本 < 100 字符 → "ERROR: textbook is required (min 100 chars)"
- Phase 1 无有效结构 → "Stage 1 failed: no valid output"
- Phase 2 处理失败 → "Stage 2 failed"
- Phase 3 输出 < 200 字符 → "Stage 3 failed: output too short"
- Phase 4 输出 < 200 字符 → "Stage 4 failed: output too short"

### 最终统计
```
📄 Output: {output_path}
📊 {Monolingual/Bilingual} | {domain} | {N} sections | {N} terms | {input_chars} → {output_chars} chars
✅ Pipeline complete!
```
