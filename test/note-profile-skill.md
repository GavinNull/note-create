---
name: note-profile
description: 从教材样章分析并生成课程Profile YAML。对标 pipeline profile-generator.js。
---

# Profile Generator — 样章 → 课程 Profile

用法: `/note-profile sample_text="<样章>" course_name="课程名" target_language="zh-CN"`

## Phase 1: Analyze Sample

分析样章，回答 8 项：

1. **Source Language** — ISO 639-1 代码
2. **Section Structure** — regex pattern + style (§-prefixed/dotted/numbered/heading)
3. **Code** — language, comment syntax, estimated % of text
4. **Content Types** — 对每种评级 abundant/present/rare/absent: definition, theorem, code, complexity_table, example, comparison_table, note, figure, derivation, equation, experiment, ascii_diagram
5. **Chapter Structure** — has_epigraph? has_summary? has_glossary? has_exam_points?
6. **Math Notation** — 有公式? LaTeX? 复杂度类 O(n)/Θ(n)/Ω(n)?
7. **Technical Terms** — 列出 15-25 个关键术语 + 建议翻译
8. **Domain Classification** — 从 12 领域选择: cs_theory | cs_systems | math_pure | math_applied | physics | chemistry | biology | engineering | economics | humanities | social_science | general

## Phase 2: Generate Profile YAML

基于分析结果生成完整 Profile YAML，包含:

- profile 元信息 (name, display, domain)
- languages 配置
- source 解析配置 (section_pattern, code_language, math delimiters)
- content_types (仅 abundant + present)
- template (title, section, subsection, separator, toc, end_sections)
- labels 词典 (含双语标签)
- tables 模板
- formatting 规则
- review 规则
- terminology 入门词典 (15-25 terms from Phase 1)

输出完整 YAML + 分析摘要 + 使用指引。
