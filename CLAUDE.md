# Note Create — AI 笔记生成器

从教材文本生成结构化双语笔记。基于 Profile 驱动的多领域适配。

## 命令

| 命令 | 用途 |
|------|------|
| `/note` | 从教材文本一键生成完整笔记 |
| `/note --step` | 分步模式，每个阶段可干预 |
| `/note-profile` | 从样章分析并生成课程 Profile |
| `/note-terms` | 从样章提取术语词典 |

## Profile 文件

Profile 是 YAML 文件，定义一门课的所有配置：术语词典、章节模板、标签语言、格式规则。

- `profiles/default.yaml` — 通用默认（英文单语、dotted 章节）
- `profiles/fds.yaml` — 数据结构（CS Theory, C语言, 中英双语, 200+术语）

切换教材 = 切换 Profile。

## 输出位置

生成的笔记保存到 `output/` 目录。

## 旧 pipeline

`.pipeline/` 目录下的 workflow.js 是本项目的原始版本（4-Agent 工作流）。
Skill 版本功能等价但更高效：1 次对话完成，可随时打断修改。
