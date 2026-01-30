# 云端会话同步功能使用指南

本指南将帮助您配置和使用 CodeBuddy 的云端会话同步功能。

## 目录

1. [功能概述](#功能概述)
2. [快速开始](#快速开始)
3. [配置七牛云](#配置七牛云)
4. [配置加密](#配置加密)
5. [使用命令](#使用命令)
6. [常见问题](#常见问题)

---

## 功能概述

云端会话同步功能允许您：

- **跨设备同步**: 在不同设备间无缝切换，继续之前的对话
- **云端备份**: 自动将会话数据备份到云端
- **会话恢复**: 在新设备上恢复历史会话
- **冲突解决**: 处理多设备并发修改的冲突
- **数据加密**: 使用 AES-256 加密保护您的隐私

---

## 快速开始

### 前置要求

1. 注册七牛云账号: https://www.qiniu.com/
2. 创建存储空间 (Bucket)
3. 获取 AccessKey 和 SecretKey

### 基本使用流程

```bash
# 1. 配置七牛云
/configure-qiniu

# 2. 配置加密（可选）
/configure-encryption

# 3. 同步当前会话
/sync-session

# 4. 在其他设备上恢复会话
/restore-session <session-id>
```

---

## 配置七牛云

### 1. 注册七牛云账号

访问 https://www.qiniu.com/ 注册免费账号。

### 2. 创建存储空间

1. 登录七牛云控制台
2. 进入"对象存储" -> "空间管理"
3. 点击"新建空间"
4. 配置空间:
   - **存储区域**: 选择离您最近的区域
   - **访问控制**: 选择"私有空间"
   - **存储类型**: 选择"标准存储"

### 3. 获取密钥

1. 进入"个人中心" -> "密钥管理"
2. 复制 AccessKey 和 SecretKey

### 4. 配置 CodeBuddy

运行配置命令:

```bash
/configure-qiniu
```

按提示输入:

- AccessKey
- SecretKey
- Bucket 名称
- 区域 (如: z0=华东, z1=华北, z2=华南)

---

## 配置加密

### 加密模式

支持两种加密模式:

#### 1. 用户密码模式

使用您自己的密码加密会话数据。

```bash
/configure-encryption
# 选择 "password" 模式
```

**注意**: 密码无法找回，请妥善保管！

#### 2. API Key 模式（推荐）

使用系统生成的 API Key 加密，便于跨设备使用。

```bash
/configure-encryption
# 选择 "auto" 模式

# 导出密钥（在另一台设备上导入）
/export-key
```

### 密钥管理

```bash
# 导出密钥
/export-key

# 导入密钥
/import-key <base64-key>

# 轮换密钥
/rotate-key
```

---

## 使用命令

### /sync-session - 同步会话

```bash
# 基本同步
/sync-session

# 强制覆盖云端
/sync-session --force

# 启用自动同步
/sync-session --auto
```

**同步成功后，您将看到**:

- 会话 ID
- 同步的消息数量
- 上传数据大小

### /restore-session - 恢复会话

```bash
# 恢复指定会话
/restore-session <session-id>

# 查看可恢复的会话列表
/list-sessions
```

**恢复模式**:

1. **新建会话**: 创建新窗口恢复
2. **合并会话**: 合并到当前会话
3. **替换会话**: 替换当前会话

### /list-sessions - 列出云端会话

```bash
# 列出所有会话
/list-sessions

# 限制显示数量
/list-sessions --limit 10

# 搜索会话
/list-sessions --search "项目名"
```

**显示信息**:

- 会话 ID
- 创建时间
- 最后修改时间
- 消息数量
- 存储大小

### /delete-session - 删除云端会话

```bash
# 删除指定会话（会提示确认）
/delete-session <session-id>

# 强制删除（跳过确认）
/delete-session <session-id> --force
```

### /cleanup-sessions - 清理旧会话

```bash
# 交互式清理
/cleanup-sessions

# 预览将要删除的会话
/cleanup-sessions --dry-run

# 删除 60 天前的会话
/cleanup-sessions --older-than 60

# 自动清理
/cleanup-sessions --auto
```

### /export-key - 导出加密密钥

```bash
/export-key
```

**输出**: Base64 编码的密钥，可用于其他设备导入。

### /import-key - 导入加密密钥

```bash
/import-key <base64-key>
```

### /rotate-key - 轮换加密密钥

```bash
/rotate-key
```

**警告**: 此操作将使用新密钥重新加密所有云端会话，可能需要较长时间。

---

## 常见问题

### Q: 数据安全吗？

**A**: 是的。所有会话数据在上传前都使用 AES-256-GCM 加密，密钥只有您知道。即使七牛云被攻破，也无法读取您的数据。

### Q: 存储费用如何？

**A**: 七牛云提供免费额度:

- 10GB 存储
- 10GB HTTP 流量/月

对于个人使用，这完全足够。超出后按量计费。

### Q: 忘记密码怎么办？

**A**: 如果使用密码模式加密，忘记密码将无法解密云端会话。建议使用 API Key 模式并妥善导出备份密钥。

### Q: 如何解决冲突？

**A**: 当检测到多设备并发修改时，系统会提示您选择:

1. 保留本地版本
2. 保留云端版本
3. 手动合并

### Q: 可以同步多个项目吗？

**A**: 是的。每个会话独立同步，可以在不同项目间切换。

### Q: 离线时能使用吗？

**A**: 可以。离线时本地功能正常工作，恢复联网后会自动同步。

### Q: 如何删除所有云端数据？

**A**:

```bash
# 方法 1: 逐个删除
/list-sessions  # 获取所有会话 ID
/delete-session <id> --force

# 方法 2: 在七牛云控制台直接删除 Bucket
```

### Q: 存储空间不足怎么办？

**A**:

```bash
# 清理旧会话
/cleanup-sessions --auto

# 或升级七牛云套餐
```

---

## 高级功能

### 自动同步

启用后，系统会:

- 每 5 分钟自动同步
- 每新增 10 条消息自动同步

```bash
/sync-session --auto
```

### 增量同步

仅同步新增或修改的内容，节省流量和时间。

### 冲突备份

覆盖操作前自动备份，保留 7 天。

```bash
# 查看冲突历史
# (功能开发中)
```

### 多设备管理

在不同设备上使用相同的加密密钥即可同步会话。

---

## 技术支持

遇到问题？

1. 查看日志: `~/.codebuddy/logs/`
2. 检查配置: `/configure-qiniu --status`
3. 提交问题: [GitHub Issues](https://github.com/your-repo/issues)

---

## 更新日志

### v1.0.0 (2024-01-30)

- 首次发布云端会话同步功能
- 支持七牛云存储
- AES-256 加密
- 冲突检测和解决
- 自动同步模式
