# Note Create — AI 笔记生成器

从教材文本一键生成结构化双语笔记。支持 12 学科领域、21 种语言、Profile 驱动。

## 快速开始

安装后在 Claude Code 中输入 `/note` 并粘贴教材文本即可：

```
/note

Chapter 3: Linked Lists

§3.1 Singly Linked Lists
A linked list is a linear data structure where elements are stored
in nodes. Each node contains a data field and a pointer to the next node.
...
```

## 自动触发

提到以下关键词时会自动调用，无需手动输入 `/note`：

**中文**：做笔记、整理笔记、生成笔记、整理知识点、提取重点、总结章节、双语笔记、中英对照

**英文**：take notes、generate notes、study notes、lecture notes

**学术结构**：粘贴包含 Chapter/§/Definition/Theorem/第X章/定义/定理 的文本

## 命令

| 命令 | 用途 |
|------|------|
| `/note` | 从教材文本一键生成完整笔记 |
| `/note --step` | 分步模式，每个阶段可暂停干预 |
| `/note --profile <name>` | 指定 Profile（默认 default） |
| `/note --chapter <N>` | 指定章号 |
| `/note --title-cn <text>` | 中文标题 |
| `/note --title-en <text>` | 英文标题 |
| `/note-profile` | 从样章分析并自动生成课程 Profile |
| `/note-terms` | 从样章提取术语词典 |

## 工作流

```
教材原文
    │
    ▼
Stage 1: 结构化提取 → 识别 30 种内容块（定义、定理、代码、公式、表格...）
    │
    ▼
Stage 2: 双语处理   → 翻译 + 术语标注（单语模式跳过）
    │
    ▼
Stage 3: Markdown渲染 → 按模板生成完整笔记 + TOC + 术语表
    │
    ▼
Stage 4: 审校增强   → 格式检查 + 术语一致性 + 自动修复
    │
    ▼
最终笔记 (.md)
```

## 支持的学科领域

| 领域 | domain | 特殊处理 |
|------|--------|---------|
| CS 理论/算法 | `cs_theory` | 复杂度表、伪代码、定理证明结构 |
| CS 系统 | `cs_systems` | 架构图、配置示例、协议规范 |
| 纯数学 | `math_pure` | Definition→Lemma→Proof→Corollary 链、QED 标记 |
| 应用数学/统计 | `math_applied` | 数值示例、算法追踪、模型假设 |
| 物理学 | `physics` | 定律公式、实验步骤、常数表、向量粗体 |
| 化学 | `chemistry` | 反应方程式配平、相态标注、安全提示 |
| 生物学 | `biology` | 过程步骤、分类体系、属种斜体 |
| 工程学 | `engineering` | 设计方程、规范标准、安全系数 |
| 经济学/金融 | `economics` | 经济模型、假设推论、政策含义 |
| 人文学科 | `humanities` | 论点引文、时间线、学术争论 |
| 社会科学 | `social_science` | 理论框架、实证研究、方法论 |
| 通用/其他 | `general` | 保守策略，聚焦定义和关键点 |

## 支持的 Block Types（30 种）

**通用**：definition、theorem、code、example、note、figure、paragraph、comparison_table、derivation、ascii_diagram、formula_list、problem_solution

**CS**：complexity_table、interactive_demo

**STEM**：equation、law、constant_table、mechanism、experiment

**人文社科**：argument、quote、case_study、timeline、debate、framework

**生物**：process、classification

## Profile 系统

Profile 是 YAML 配置文件，定义一门课的全部设置。切换教材 = 切换 Profile。

```yaml
# 示例：CS 理论课程（中英双语）
profile:
  domain: "cs_theory"
  languages:
    source: "en"
    target: "zh-CN"
    annotation: "en"          # 术语标注英文
    annotation_style: "parens" # 中文（English）
  terminology:
    trees:
      - { cn: "二叉搜索树", en: "Binary Search Tree (BST)" }
      - { cn: "平衡树", en: "Balanced Tree" }
    analysis:
      - { cn: "时间复杂度", en: "Time Complexity" }
      - { cn: "最坏情况", en: "Worst Case" }
```

使用 `/note-profile` 从样章自动生成 Profile，无需手写。

## 图片处理 (v3.2 新增)

当教材源包含图片时，自动处理 `图X-Y` / `Figure X.Y` 引用：

| 阶段 | 处理 |
|------|------|
| Extract | 自动检测所有图片引用（图号+所属上下文） |
| Render | 按约定生成 Markdown 图片路径 `images/FigX-Y.png` |
| Review | 验证所有图片引用有对应占位符 |

**图片命名约定：**
- 中文教材：`![图2-7](images/Fig2-7.png)`
- 英文教材：`![Figure 2.7](images/ch02-kinematics.png)`

**从 Word/PDF 提取图片：** 若源文档（.docx）含图片，可用 Python（python-docx）提取图片 blob 放入 `images/` 目录。详见 SKILL.md 中的 Image Handling 章节。

## 双语模式

定义和定理保持双语块引用，正文目标语言为主、首次术语标注原文：

```
> **定义（Definition）**：链表（Linked List）—
> 由节点组成的线性数据结构，每个节点包含数据域和指向下一节点的指针。
>
> **Definition（定义）**：Linked List —
> A linear data structure consisting of nodes, each containing
> a data field and a pointer to the next node.
```

## 项目结构

```
note-create/
├── CLAUDE.md                    # 项目上下文 + 路由规则
├── README.md                    # 本文件
├── .claude/skills/
│   ├── note.md                  # 主技能
│   ├── note-profile.md          # Profile 生成器
│   └── note-terms.md            # 术语词典构建器
└── profiles/
    └── default.yaml             # 默认 Profile
```
