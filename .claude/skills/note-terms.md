---
name: note-terms
description: 从2-3章样章自动提取领域术语词典。对标 pipeline terminology-builder.js。
---

# Terminology Builder

用法: `/note-terms sample_chapters="<2-3章>" domain="physics" target_language="zh-CN"`

## Phase 1: Extract Terms

扫描样章识别领域术语。包含: 核心概念、技术动词、命名实体、技术形容词、标准缩写。排除: 常用词普通义项、仅出现一次、不含概念的人名。

按领域分组为 3-8 个分类。Domain presets:
- cs_theory: Data Structures, Algorithms, Complexity, Graph Theory, Sorting, Hashing, Trees, Paradigms
- math_pure: Fundamental Concepts, Algebraic Structures, Topological Concepts, Analysis, Proof Techniques
- physics: Mechanics, Electromagnetism, Thermodynamics, Quantum, Mathematical Tools, Experiments
- chemistry: General, Organic, Inorganic, Physical, Lab Techniques, Nomenclature
- biology: Molecular Bio, Cell Bio, Genetics, Ecology, Evolution, Physiology
- economics: Micro, Macro, Econometrics, Finance, Policy, Math Tools
- humanities: Literary Theory, Historical Context, Philosophical Concepts, Critical Approaches
- general: auto-group based on text

## Phase 2: Build Dictionary YAML

```yaml
terminology:
  {category}:
    - { cn: "翻译", en: "Term" }
```

输出统计 + 使用指引。
