# 云端会话同步 - 开发者文档

本文档面向开发者，介绍云端会话同步功能的架构设计和 API 接口。

## 目录

1. [架构概述](#架构概述)
2. [模块设计](#模块设计)
3. [API 接口](#api-接口)
4. [数据结构](#数据结构)
5. [加密机制](#加密机制)
6. [扩展指南](#扩展指南)

---

## 架构概述

### 分层架构

```
┌─────────────────────────────────────────┐
│  Slash Commands Layer                   │
│  (/sync-session, /restore-session...)   │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  Session Sync Engine                    │
│  (collect, compress, encrypt, sync)     │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  Qiniu Storage Adapter                  │
│  (upload, download, list, delete)       │
└─────────────┬───────────────────────────┘
              │
┌─────────────▼───────────────────────────┐
│  Qiniu SDK (qiniu package)              │
└─────────────────────────────────────────┘
```

### 设计原则

1. **关注点分离**: 每层职责清晰
2. **可测试性**: 所有模块可独立测试
3. **可扩展性**: 易于添加新功能或替换组件
4. **错误处理**: 统一的错误处理和重试机制

---

## 模块设计

### 1. 七牛云存储适配器 (src/qiniu/)

负责与七牛云 SDK 交互。

#### 模块文件

- `client.js`: 客户端初始化
- `config.js`: 配置管理
- `upload.js`: 文件上传
- `download.js`: 文件下载
- `list.js`: 文件列表查询
- `delete.js`: 文件删除
- `usage.js`: 存储空间查询
- `retry.js`: 重试机制

#### API 示例

```javascript
const { createQiniuClient } = require('./qiniu/client');
const { uploadFile } = require('./qiniu/upload');

// 创建客户端
const client = createQiniuClient({
  accessKey: 'your-access-key',
  secretKey: 'your-secret-key',
  region: 'z0',
});

// 上传文件
await uploadFile(client, {
  key: 'sessions/abc123/messages.json',
  data: Buffer.from(jsonData),
  onProgress: (percent) => console.log(`${percent}%`),
});
```

### 2. 加密模块 (src/encryption/)

负责数据加密和解密。

#### 模块文件

- `aes.js`: AES-256-GCM 加密/解密
- `keys.js`: 密钥派生和管理
- `config.js`: 加密配置
- `metadata.js`: 加密元数据
- `rotation.js`: 密钥轮换

#### API 示例

```javascript
const { encryptData, decryptData } = require('./encryption/aes');
const { deriveKeyFromPassword } = require('./encryption/keys');

// 使用密码派生密钥
const key = await deriveKeyFromPassword('my-password');

// 加密数据
const encrypted = await encryptData(data, key);

// 解密数据
const decrypted = await decryptData(encrypted, key);
```

### 3. 会话同步引擎 (src/session-sync/)

负责会话数据的收集、序列化和同步。

#### 模块文件

- `collector.js`: 会话数据收集
- `serialize.js`: 数据序列化
- `compression.js`: GZIP 压缩
- `sync.js`: 同步流程编排
- `incremental.js`: 增量同步
- `restore.js`: 会话恢复
- `rebuild.js`: 上下文重建
- `auto-sync.js`: 自动同步
- `status.js`: 同步状态追踪

#### API 示例

```javascript
const { syncSession } = require('./session-sync/sync');
const { restoreSession } = require('./session-sync/restore');

// 同步会话
const result = await syncSession(sessionData, {
  incremental: true,
  onProgress: (step, current, total) => {
    console.log(`[${step}] ${current}/${total}`);
  },
});

// 恢复会话
const restored = await restoreSession(sessionId, {
  mergeMode: 'replace',
  password: 'my-password',
});
```

### 4. 冲突解决模块 (src/session-sync/conflict-\*.js)

负责冲突检测和解决。

#### 模块文件

- `conflict-detector.js`: 冲突检测
- `conflict-resolver.js`: 冲突解决策略
- `auto-merger.js`: 自动合并简单冲突
- `conflict-backup.js`: 冲突备份
- `version.js`: 版本号管理

#### API 示例

```javascript
const { detectConflict } = require('./session-sync/conflict-detector');
const { resolveConflict } = require('./session-sync/conflict-resolver');

// 检测冲突
const conflict = await detectConflict(localSession, cloudSession);

// 解决冲突
const resolved = await resolveConflict(conflict, {
  strategy: 'local', // 'local' | 'cloud' | 'manual'
});
```

### 5. 用户体验模块 (src/ux/)

负责用户交互和反馈。

#### 模块文件

- `error-handler.js`: 错误处理和友好消息
- `storage-monitor.js`: 存储空间监控
- `session-cleaner.js`: 会话清理工具
- `notifications.js`: 操作通知
- `offline-handler.js`: 离线检测和降级
- `interrupt-handler.js`: 中断处理

#### API 示例

```javascript
const { displayError, displaySuccess } = require('./ux/error-handler');
const { checkStorageSpace } = require('./ux/storage-monitor');

// 显示错误
try {
  await someOperation();
} catch (error) {
  displayError(error, { context: 'sync' });
}

// 检查存储空间
const usage = await checkStorageSpace(config);
if (usage.status === 'warning') {
  displayWarning('Storage space is running low');
}
```

---

## API 接口

### Slash Commands

所有命令通过 `.codebuddy/commands/*.md` 文件定义。

#### 命令格式

```markdown
---
description: 命令描述
---

# /command-name

命令说明

## 用法
```

/command-name [--options]

```

## 选项

- `--option`: 选项说明
```

#### 可用命令

- `/sync-session`: 同步当前会话
- `/restore-session`: 恢复云端会话
- `/list-sessions`: 列出云端会话
- `/delete-session`: 删除云端会话
- `/cleanup-sessions`: 清理旧会话
- `/export-key`: 导出加密密钥
- `/import-key`: 导入加密密钥
- `/rotate-key`: 轮换加密密钥
- `/configure-qiniu`: 配置七牛云
- `/configure-encryption`: 配置加密

### 模块 API

#### 七牛云适配器 API

```javascript
// 上传文件
uploadFile(config, { key, data, onProgress }) -> Promise<void>

// 下载文件
downloadFile(config, key) -> Promise<Buffer>

// 列出文件
listFiles(config, { prefix, limit }) -> Promise<Array>

// 删除文件
deleteFiles(config, keys) -> Promise<void>

// 获取存储使用量
getBucketInfo(config) -> Promise<Object>
```

#### 加密 API

```javascript
// 加密数据
encryptData(data, key) -> Promise<Buffer>

// 解密数据
decryptData(encryptedData, key) -> Promise<Buffer>

// 派生密钥（密码模式）
deriveKeyFromPassword(password, salt) -> Promise<Buffer>

// 生成随机密钥
generateRandomKey() -> Buffer

// 导出/导入密钥
exportKey(key) -> string (Base64)
importKey(base64) -> Buffer
```

#### 同步引擎 API

```javascript
// 同步会话
syncSession(sessionData, options) -> Promise<Object>
  options: {
    incremental: boolean,
    force: boolean,
    onProgress: (step, current, total) => void
  }

// 恢复会话
restoreSession(sessionId, options) -> Promise<Object>
  options: {
    mergeMode: 'replace' | 'merge' | 'new',
    password?: string
  }

// 列出会话
listSessions(options) -> Promise<Array>
  options: {
    limit: number,
    search: string
  }
```

---

## 数据结构

### 会话数据结构

```javascript
{
  sessionId: string,        // UUID v4
  version: number,          // 版本号
  created: string,          // ISO 8601 timestamp
  modified: string,         // ISO 8601 timestamp
  device: string,           // 设备标识

  // 对话历史
  messages: [
    {
      role: 'user' | 'assistant',
      content: string,
      timestamp: string
    }
  ],

  // 工作上下文
  context: {
    projectPath: string,
    files: string[],
    tasks: Array
  },

  // 元数据
  meta: {
    title?: string,
    tags?: string[]
  }
}
```

### 云端存储结构

```
sessions/
  <sessionId>/
    meta.json       // 会话元数据
    messages.json   // 对话历史（加密压缩）
    context.json    // 工作上下文（加密压缩）
    versions/       // 版本历史
      <version>/
        ...
```

### 加密数据结构

```javascript
{
  data: Buffer,           // 加密后的数据
  iv: Buffer,             // 初始化向量
  tag: Buffer,            // 认证标签
  salt: Buffer,           // 密钥派生盐
  algorithm: 'aes-256-gcm'
}
```

---

## 加密机制

### 加密流程

```
原始数据
  │
  ▼
序列化 (JSON)
  │
  ▼
压缩 (GZIP)
  │
  ▼
加密 (AES-256-GCM)
  │
  ▼
上传到七牛云
```

### 解密流程

```
从七牛云下载
  │
  ▼
解密 (AES-256-GCM)
  │
  ▼
解压 (GZIP)
  │
  ▼
解析 (JSON)
  │
  ▼
原始数据
```

### 密钥派生

#### 用户密码模式

```
用户密码
  │
  ▼
PBKDF2 (SHA-256, 100000 iterations)
  │
  ▼
256-bit 密钥
```

#### API Key 模式

```
ENCRYPTION_API_KEY
  │
  ▼
SHA-256 哈希
  │
  ▼
256-bit 密钥
```

---

## 扩展指南

### 添加新的云存储支持

1. 创建新的适配器目录 `src/<provider>/`
2. 实现标准接口:
   - `uploadFile()`
   - `downloadFile()`
   - `listFiles()`
   - `deleteFiles()`
3. 更新配置管理以支持新提供商

### 添加新的命令

1. 创建命令文件 `.codebuddy/commands/<command>.md`
2. 实现命令处理逻辑
3. 更新文档

### 自定义加密算法

1. 在 `src/encryption/` 添加新的加密模块
2. 实现加密/解密接口
3. 更新配置以支持新算法

### 添加新的合并策略

1. 在 `src/session-sync/` 添加合并策略模块
2. 实现合并逻辑
3. 在 `conflict-resolver.js` 中注册新策略

---

## 测试

### 单元测试

```bash
npm test
```

### 集成测试

```bash
npm run test:integration
```

### E2E 测试

```bash
npm run test:e2e
```

---

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request

---

## 许可证

ISC

---

## 联系方式

- GitHub: [your-repo]
- Issues: [your-repo/issues]
