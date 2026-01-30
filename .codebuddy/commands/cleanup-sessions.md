---
description: 删除云端旧的会话以释放存储空间
---

# /cleanup-sessions

删除云端旧的会话以释放存储空间。

## 用法

```
/cleanup-sessions [--options]
```

## 选项

- `--older-than <days>` - 仅删除指定天数之前修改的会话（默认：30 天）
- `--min-size <bytes>` - 仅删除大于指定大小的会话
- `--limit <n>` - 限制显示的会话数量（默认：20）
- `--dry-run` - 预览将要删除的会话，不实际删除
- `--auto` - 自动清理模式，删除最旧的会话直到释放足够空间
- `--force` - 跳过确认提示，直接删除

## 示例

```bash
# 交互式清理 30 天前的会话
/cleanup-sessions

# 预览将要删除的会话
/cleanup-sessions --dry-run

# 删除 60 天前的会话
/cleanup-sessions --older-than 60

# 自动清理以释放 1GB 空间
/cleanup-sessions --auto

# 强制删除最旧的 10 个会话
/cleanup-sessions --limit 10 --force
```

## 注意事项

- 删除操作不可逆，请谨慎使用
- 建议先使用 `--dry-run` 预览将要删除的会话
- 被删除的会话无法恢复
- 删除操作会释放相应的存储空间
