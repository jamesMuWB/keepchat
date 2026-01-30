## 为什么

当前 Claude Code、Cursor、CodeBuddy CLI 等 AI 编程助手的会话数据仅存储在本地设备,用户在切换设备(如从办公室到家里)时无法继续之前的对话,必须重新解释需求和上下文,严重影响工作连续性。通过七牛云同步,用户可以在任意设备上无缝继续之前的会话,提升跨设备工作体验。

## 变更内容

- **新增**: 七牛云 Kodo 会话存储功能,将会话数据上传到七牛云对象存储
- **新增**: `/sync-session` slash command,允许用户主动触发会话同步
- **新增**: `/restore-session <session-id>` slash command,在新设备上恢复会话
- **新增**: `/list-sessions` slash command,列出云端所有会话
- **新增**: 自动同步模式(`--auto` 参数),定期后台同步会话更新
- **新增**: 会话数据加密和压缩,保护隐私并优化传输
- **新增**: 冲突检测机制,处理多设备并发修改
- **新增**: 七牛云配置管理,存储 AccessKey、SecretKey、Bucket 等配置

## 功能 (Capabilities)

### 新增功能

- `qiniu-storage`: 七牛云存储集成,使用七牛云 Kodo 对象存储服务,提供上传、下载、列表、删除等基础操作,支持 AccessKey + SecretKey 认证
- `session-sync-engine`: 会话同步引擎,负责收集会话数据(对话历史、工作上下文、文件引用、元数据)、压缩加密、上传下载、增量同步
- `session-restore`: 会话恢复功能,从七牛云下载会话数据、解密解压、重建对话上下文,让用户在新设备上无缝继续
- `sync-commands`: Slash commands 实现,包括 `/sync-session`(同步)、`/restore-session <id>`(恢复)、`/list-sessions`(列表)、`/delete-session <id>`(删除)
- `conflict-resolution`: 冲突检测和解决,使用版本号和时间戳检测多设备并发修改,提供解决策略(保留本地/保留云端/手动合并)
- `session-encryption`: 会话数据加密模块,使用 AES-256 加密保护用户隐私,加密密钥基于用户配置的密码或 ENCRYPTION_API_KEY

### 修改功能

无 - 这是全新功能,不涉及现有功能的需求变更

## 影响

**代码影响**:

- 需要新增 `src/qiniu/` 模块,实现七牛云存储客户端
- 需要新增 `src/session-sync/` 模块,实现同步引擎和会话管理
- 需要在 `.codebuddy/commands/` 下创建 4 个新的 slash commands
- 可能需要修改本地会话存储逻辑,添加同步状态追踪

**依赖影响**:

- 需要添加七牛云 Node.js SDK: `qiniu` 包
- 需要使用 Node.js 内置 `crypto` 模块进行加密(AES-256)
- 需要使用 Node.js 内置 `zlib` 模块进行 GZIP 压缩

**配置影响**:

- 需要新增配置文件 `.codebuddy/qiniu-config.json` 或使用环境变量:
  - `QINIU_ACCESS_KEY`: 七牛云 AccessKey
  - `QINIU_SECRET_KEY`: 七牛云 SecretKey
  - `QINIU_BUCKET`: 存储桶名称
  - `QINIU_REGION`: 区域(如 z0/z1/z2)
  - `ENCRYPTION_API_KEY`: (可选)加密 API key,用于派生会话加密密钥
- 需要配置自动同步策略(间隔时间、触发条件等)

**用户影响**:

- 用户需要:
  1. 注册七牛云账号(免费,提供 10GB 存储 + 10GB HTTP 流量/月)
  2. 创建存储桶(Bucket)
  3. 获取 AccessKey 和 SecretKey
  4. 配置到 CodeBuddy 中
- 首次使用需要引导用户完成七牛云配置
- 增加网络依赖,离线时同步功能不可用(需优雅降级,本地仍可正常使用)

**安全影响**:

- 敏感的会话数据将存储在七牛云,必须确保加密
- AccessKey 和 SecretKey 需要安全存储(建议使用系统 keychain 或加密配置文件)
- 会话数据在上传前进行 AES-256 加密,即使七牛云被攻破也无法读取明文

**成本影响**:

- 七牛云免费额度:10GB 存储 + 10GB HTTP 流量/月
- 个人使用场景下,会话数据通常很小(<1MB/会话),免费额度完全足够
- 超出免费额度后:存储 ¥0.148/GB/月,HTTP 流量 ¥0.24/GB
