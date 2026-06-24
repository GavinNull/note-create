# Note Generator — Claude Code Skill

从教材文本生成结构化双语笔记。支持12学科领域、多语言、Profile驱动。

## 触发方式

```
/note <教材文本>
```

或自动触发：粘贴包含 Chapter/§/Definition/Theorem/第X章/定义/定理 的学术文本时。

## Pipeline (4-Stage)

```
教材文本 → Phase 1: Extract → Phase 2: Bilingual → Phase 3: Render → Phase 4: Review → 笔记.md
```

| 阶段 | 功能 |
|------|------|
| Phase 1 | 结构化提取：定义、定理、公式、代码、图片引用等30种内容块 |
| Phase 2 | 双语处理：翻译+术语标注（中文(English)） |
| Phase 3 | Markdown渲染：按章节模板输出完整 .md 文件 |
| Phase 4 | 审校增强：术语一致性+格式修正+域特定检查 |

## 支持领域 (12 Domain)

cs_theory / cs_systems / math_pure / math_applied / physics / chemistry / biology / engineering / economics / humanities / social_science / general

## Image Handling (v3.2 新增)

当教材源包含图片时，自动处理 `图X-Y` / `Figure X.Y` 引用：

1. **检测**: Phase 1 自动提取所有图片引用（图号+上下文）
2. **渲染**: Phase 3 按约定生成 Markdown 图片路径 (`images/FigX-Y.png`)
3. **审校**: Phase 4 验证所有图片引用有对应占位符
4. **提取指南**: 内置从 Word/PDF 提取图片的完整工作流

### 图片命名约定

- 中文教材: `images/Fig{chapter}-{number}.{ext}` → `![图2-7](images/Fig2-7.png)`
- 英文教材: `images/ch{chapter:02d}-{slug}.{ext}` → `![Figure 2.7](images/ch02-kinematics.png)`

## 工作模式

| 模式 | 命令 | 说明 |
|------|------|------|
| One-Shot | `/note` + 文本 | 全流程一次性执行 |
| Step-by-Step | `/note --step` | 每阶段暂停确认 |
| Extract Only | `/note --extract` | 仅结构化提取 |
| Render Only | `/note --render` | 仅渲染（需JSON输入） |
| Review Only | `/note --review` | 仅审校（需Markdown输入） |

## 参数

- `--profile <path>` — Profile YAML 路径
- `--chapter <N>` — 章号
- `--title-cn <text>` / `--title-en <text>` — 标题
- `--epigraph-cn <text>` / `--epigraph-en <text>` — 卷首语

## 相关Skill

- `/note-profile` — 从样章生成课程 Profile
- `/note-terms` — 从样章提取术语词典

## License

MIT
