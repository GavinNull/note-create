# Test Samples

用于验证 `/note` 技能的测试样例。

## 文件

| 文件 | 内容 | 领域 | 用于测试 |
|------|------|------|---------|
| `sample-cs-binary-search.md` | 二叉搜索树章节 | cs_theory | 代码提取、复杂度表、定理+证明、定义、双语渲染 |
| `sample-general-photosynthesis.md` | 光合作用简介 | general (默认) | 定义、过程步骤、公式、注释 |
| `test-profile.yaml` | CS 理论测试 Profile | cs_theory | 双语配置、术语词典、模板 |

## 使用方式

```bash
# 用默认 profile 测试（英文单语）
/note < test/sample-general-photosynthesis.md

# 用测试 profile 测试（中英双语）
/note --profile test/test-profile.yaml --chapter 4 \
  --title-en "Binary Search Trees" --title-cn "二叉搜索树" \
  < test/sample-cs-binary-search.md
```
