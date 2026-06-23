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
- 使用 `/note-profile` 从样章自动生成新课程的 Profile

切换教材 = 切换 Profile。

## 输出位置

生成的笔记保存到 `output/` 目录。

## Skill routing

当用户的消息匹配以下任一场景时，自动调用 `/note` 技能：

- 粘贴或发送了教材/教科书章节文本
- 提到"做笔记"、"生成笔记"、"整理笔记"、"笔记"、"note"
- 提到"整理知识点"、"提取重点"、"总结章节"
- 发送包含 "Chapter"、"§"、"Definition"、"Theorem" 等学术结构的英文文本
- 发送包含 "第X章"、"第X节"、"定义"、"定理" 等学术结构的中文文本
- 提到"双语笔记"、"翻译笔记"、"中英对照笔记"

调用方式：直接使用 Skill 工具，skill="note"。
