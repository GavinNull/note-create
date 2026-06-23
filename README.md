# Note Create — AI 笔记生成器

从教材文本一键生成结构化双语笔记。支持 12 学科领域、21 种语言、Profile 驱动。

## 快速开始

在 Claude Code 中打开本项目，输入：

```
/note
```

然后粘贴教材文本，Claude 会自动完成提取 → 翻译 → 渲染 → 审校全流程。

## 命令

| 命令 | 用途 |
|------|------|
| `/note` | 从教材文本一键生成完整笔记 |
| `/note --step` | 分步模式，每个阶段可暂停干预 |
| `/note --profile fds` | 指定 Profile（默认 general） |
| `/note-profile` | 从样章分析并自动生成课程 Profile |
| `/note-terms` | 从样章提取术语词典 |

## 工作流

```
教材原文
    │
    ▼
Stage 1: 结构化提取 → 识别定义、定理、代码、公式、表格...
    │
    ▼
Stage 2: 双语处理   → 翻译 + 术语标注（单语模式跳过）
    │
    ▼
Stage 3: Markdown渲染 → 按模板生成完整笔记
    │
    ▼
Stage 4: 审校增强   → 格式检查 + 术语一致性 + 自动修复
    │
    ▼
最终笔记 (.md)
```

## 支持的学科领域

| 领域 | Profile |
|------|---------|
| CS 理论/算法 | `cs_theory` |
| CS 系统 | `cs_systems` |
| 纯数学 | `math_pure` |
| 应用数学/统计 | `math_applied` |
| 物理学 | `physics` |
| 化学 | `chemistry` |
| 生物学 | `biology` |
| 工程学 | `engineering` |
| 经济学/金融 | `economics` |
| 人文学科 | `humanities` |
| 社会科学 | `social_science` |
| 通用/其他 | `general` |

每个领域在 4 个 Stage 有独立的处理策略。例如数学领域会追踪 Definition→Lemma→Proof→Corollary 链，化学领域会验证反应方程式配平和相态标注。

## 支持的 Block Types

提取 30 种内容块：definition、theorem、code、example、note、figure、paragraph、comparison_table、derivation、ascii_diagram、formula_list、problem_solution、complexity_table、interactive_demo、equation、law、constant_table、mechanism、experiment、argument、quote、case_study、timeline、debate、framework、process、classification

## Profile 系统

Profile 是 YAML 配置文件，定义一门课的全部设置：术语词典、章节模板、标签语言、格式规则。

```yaml
# profiles/fds.yaml — 数据结构课程示例
profile:
  domain: "cs_theory"
  languages:
    source: "en"
    target: "zh-CN"
    annotation: "en"
  terminology:
    trees:
      - { cn: "二叉树", en: "Binary Tree" }
      - { cn: "堆", en: "Heap" }
    # ...200+ 术语
```

**内置 Profile**：
- `default.yaml` — 通用默认（英文单语）
- `fds.yaml` — 数据结构课程（CS Theory, 中英双语, C 语言, 200+ 术语）

**切换教材 = 切换 Profile。**

## 双语模式

```
> **定义（Definition）**：链表（Linked List）—
> 由节点组成的线性数据结构，每个节点包含数据域和指向下一节点的指针。
>
> **Definition（定义）**：Linked List —
> A linear data structure consisting of nodes, each containing
> a data field and a pointer to the next node.
```

正文以目标语言为主，关键术语首次出现时标注原文。定义和定理始终保持双语。

## 项目结构

```
note-create/
├── CLAUDE.md                    # 项目上下文
├── README.md                    # 本文件
├── .claude/skills/
│   ├── note.md                  # 主技能（370行完整指令）
│   ├── note-profile.md          # Profile 生成器
│   └── note-terms.md            # 术语词典构建器
├── profiles/
│   ├── default.yaml             # 默认配置
│   └── fds.yaml                 # FDS 课程配置
└── .pipeline/                   # 旧版 workflow（参考）
    └── workflow.js              # 原始 4-Agent 流水线
```

## 与旧版 pipeline 的区别

| | workflow.js | Skill |
|---|---|---|
| AI 调用 | 4 次独立 Agent | 1 次对话 |
| 用户干预 | ❌ 黑盒 | ✅ 随时打断修改 |
| 输出稳定性 | 每次可能不同 | Skill 指令约束，更一致 |
| 成本 | 4 个上下文 | 1 个上下文 |

功能完全等价，Skill 版本更高效灵活。
