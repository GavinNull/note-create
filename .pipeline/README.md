# FDS Notes Generation Pipeline

> 从教材文本到双语笔记的 4 阶段自动化流水线 — **现已支持多教材适配**

## 快速概览

```
教材文本 (.txt/.pdf)
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  Stage 1: Structural Extraction                      │
│  提取定义、定理、代码、公式 → 结构化 JSON             │
├──────────────────────────────────────────────────────┤
│  Stage 2: Bilingual Processing                       │
│  翻译 + 术语标注（中文（English））                   │
├──────────────────────────────────────────────────────┤
│  Stage 3: Markdown Rendering                         │
│  按章节模板渲染 → 完整 .md 文件                       │
├──────────────────────────────────────────────────────┤
│  Stage 4: Review & Enhancement                       │
│  术语一致性检查 + 格式修正 + 补充总结表               │
└──────────────────────────────────────────────────────┘
    │
    ▼
最终笔记 ChXX-Chapter-Name.md
```

## 文件结构

```
.pipeline/
├── config.yaml                  # 通用配置（不随教材变化）
├── profiles/                    # 🆕 教材适配配置
│   ├── fds.yaml                 #   FDS 数据结构课程（默认）
│   ├── _template.yaml           #   新建 profile 的模板
│   ├── domain-defaults.yaml     #   🆕 12 个学科领域的预设配置
│   └── examples/                #   示例 profiles（6 个）
│       ├── algorithms-bilingual.yaml   # 算法课（Python，中英双语）
│       ├── calculus-monolingual.yaml   # 微积分（纯英文，无代码）
│       ├── physics-bilingual.yaml      # 大学物理（Python，中英双语）
│       ├── math-analysis.yaml          # 🆕 数学分析（纯数学）
│       ├── literature.yaml             # 🆕 文学分析（人文）
│       └── chemistry.yaml              # 🆕 有机化学
├── prompts/
│   ├── stage1-extract.md        # 阶段1：结构化提取
│   ├── stage2-bilingual.md      # 阶段2：双语处理
│   ├── stage3-render.md         # 阶段3：Markdown 渲染
│   └── stage4-review.md         # 阶段4：审校增强
├── workflow.js                  # 主流水线（支持 --profile）
├── build-prompts.js             # 🆕 Profile → 渲染好的 prompt 文件
├── profile-generator.js         # 🆕 引导式 profile 创建向导
└── README.md                    # 本文件
```

## 🆕 v3.0 领域智能适配

**核心机制**：Pipeline 不再"盲处理"所有教材。通过 `domain` 字段，每个 Stage 会获得领域专用的处理指令：

- **Stage 1（提取）**：数学教材会寻找 Definition→Lemma→Proof→Corollary 链；化学教材会识别反应方程式和机理步骤；文学教材会提取论点和引文。
- **Stage 2（翻译）**：物理学使用"定律/原理/公设"标签体系；人文学科使用"论点/引文/争论"标签体系。
- **Stage 3（渲染）**：数学章末输出"定理汇总+核心公式"；化学章末输出"核心反应+光谱数据"；文学章末输出"核心论点+关键引文"。
- **Stage 4（审校）**：数学验证方程编号一致性和 QED 标记；化学验证方程式配平和相态标注；人文学科验证引文准确性。

### 12 个预设领域

| 领域 | `domain` 值 | 预设内容 |
|------|-----------|---------|
| CS 理论/算法 | `cs_theory` | 伪代码、复杂度表、定理证明 |
| CS 系统 | `cs_systems` | 架构图、配置、协议规范 |
| 纯数学 | `math_pure` | 定义→引理→证明→推论链、编号方程、定理汇总 |
| 应用数学/统计 | `math_applied` | 算法伪代码、模型假设、数值示例 |
| 物理学 | `physics` | 定律公式、实验步骤、常数表 |
| 化学 | `chemistry` | 反应方程式、机理步骤、光谱数据、安全提示 |
| 生物学 | `biology` | 过程描述、分类方案、案例研究 |
| 工程学 | `engineering` | 设计方程、规范标准、安全系数 |
| 经济学/金融 | `economics` | 经济模型、假设推论、政策含义 |
| 人文学科 | `humanities` | 论点引文、主题分析、时间线、学术争论 |
| 社会科学 | `social_science` | 理论框架、实证研究、方法论 |
| 通用/其他 | `general` | 保守策略，适用任何教材 |

所有领域的完整预设配置在 `profiles/domain-defaults.yaml`。

## 🆕 v2.0 跨教材适配

通过 **Profile 系统**，同一套流水线可适配任意教材。

### 什么是 Profile？

Profile 是一个 YAML 文件，包含一门课的所有特定设置：术语词典、章节模板、代码语言、内容类型、格式规则。切换教材 = 切换 Profile，无需修改任何 prompt 或 workflow 代码。

### 内置 Profiles

| Profile | 课程 | 语言 | 代码 | 特点 |
|---------|------|------|------|------|
| `fds` (默认) | 数据结构 | CN/EN 双语 | C | § 章节，复杂度分析 |
| `algorithms-bilingual` | 算法设计 | CN/EN 双语 | Python | 点分章节，DP/贪心/图算法 |
| `calculus-monolingual` | 微积分 | 纯英文 | 无 | 方程/推导，无代码 |
| `physics-bilingual` | 大学物理 | CN/EN 双语 | Python | 实验内容，物理定律标签 |

### 切换教材只需两步

**步骤 1：创建 Profile**

方式 A（推荐）— 引导式向导：
```
/workflow .pipeline/profile-generator.js sample_text="<粘贴教材样章>" course_name="课程名"
```
向导会自动分析样章，检测语言、章节格式、代码语言、内容类型，生成一份可用的 profile YAML。

方式 B — 复制模板：
```
cp profiles/_template.yaml profiles/my-course.yaml
# 编辑 my-course.yaml，填写术语、模板、设置
```

**步骤 2：运行流水线**
```
/workflow .pipeline/workflow.js profile_path="profiles/my-course.yaml" textbook="<章节文本>" chapter_number=1 chapter_title_en="Title" chapter_title_cn="标题"
```

### Profile 继承（高级）

一个 profile 可以继承另一个，只覆写差异部分。例如，FDS 课程换成日语：
```yaml
profile:
  inherits: "fds"
  languages:
    target: "ja"
  template:
    title: "第{chapter}章：{title_ja} (Chapter {chapter}: {title_en})"
  terminology:
    analysis:
      - { ja: "時間計算量", en: "Time Complexity" }
```

## 使用方式

### 方式 A：Claude Code 一键自动化（推荐）

```
/workflow .pipeline/workflow.js textbook="<完整章节文本>" chapter_number=6 chapter_title_en="Sorting Algorithms" chapter_title_cn="排序算法"
```

使用非默认 profile：
```
/workflow .pipeline/workflow.js profile_path="profiles/examples/calculus-monolingual.yaml" textbook="..." chapter_number=1 chapter_title_en="Limits" chapter_title_cn=""
```

### 方式 B：手动 Prompt 链（适用于任何 AI 工具）

1. 先渲染 prompts：`/workflow .pipeline/build-prompts.js profile_path="profiles/fds.yaml"`
2. 复制输出的 4 个 prompt，依次粘贴到 ChatGPT/Gemini/其他 AI
3. 每次把上一阶段的输出粘贴到下一阶段的输入位置

### 方式 C：单条简化 Prompt（快速草稿）

参考 `prompts/stage3-render.md` 的模板规则，合并为一条 prompt 直接生成。

## Profile Schema 速查

Profile YAML 的核心字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| `languages` | 源语言/目标语言/标注语言 | `{source: en, target: zh-CN, annotation: en}` |
| `domain` | **领域分类**（控制领域智能） | `math_pure`, `physics`, `humanities`, ... |
| `source` | 章节检测、代码语言、数学分隔符 | `{section_pattern: "§(\\d+)", code_language: c}` |
| `content_types` | 要提取的内容块类型 | `[definition, theorem, code, ...]` |
| `template` | 章节模板（标题、目录、总结） | `{title: "# 第{chapter}章：...", ...}` |
| `labels` | 标准标签的多语言字典 | `{definition: {en: Definition, cn: 定义}}` |
| `tables` | 表格模板 | `{complexity: {headers: [...]}}` |
| `formatting` | 格式规则 | `{definition_order: en_first, ...}` |
| `terminology` | **术语词典**（最重要！） | 组织为分类条目 `{cn: 链表, en: Linked List}` |
| `review` | 审校规则 | `{check_term_consistency: true, ...}` |

完整 schema 参见 `profiles/_template.yaml`。

## 自定义配置

### 创建新课程 Profile（3 步）

**步骤 1：一键生成**
```
/workflow .pipeline/profile-generator.js sample_text="<粘贴教材样章>" course_name="课程名"
```
向导会自动分析样章并检测：领域分类、源语言、章节格式、代码语言、内容类型。

**步骤 2：自动构建术语词典**
```
/workflow .pipeline/terminology-builder.js sample_chapters="<粘贴2-3章文本>" domain="physics"
```
自动提取领域术语并建议翻译 → 输出完整 YAML，直接粘贴到 profile 的 `terminology:` 下。

**步骤 3：测试运行**
```
/workflow .pipeline/workflow.js profile_path="profiles/my-course.yaml" textbook="<章节>" ...
```

### 适配其他语言对（非中英）
修改 profile 中的 `languages` 字段：
```yaml
languages:
  source: "en"        # 教材语言
  target: "ja"        # 笔记语言
  annotation: "en"    # 术语标注语言
  annotation_style: "parens"  # 日本語（English）
```

### 纯单语笔记
```yaml
languages:
  source: "en"
  target: "same"      # 保持与源语言相同
  annotation: null    # 不标注
```

## 已知限制

1. **PDF 输入**: 管道不接受 PDF 直接输入。需先用 `pdftotext` 或 Adobe Acrobat 导出为文本。
2. **图片**: 图片引用路径需手动调整。建议从课件截图，按 `chXX-description.png` 命名放入 `images/`。
3. **ASCII 图**: AI 生成的 ASCII 图可能不够精确，建议人工校验。
4. **交互演示**: HTML 演示文件需手动编写。
5. **长章节**: 超过 ~8000 字的章节可能需要分批处理。
