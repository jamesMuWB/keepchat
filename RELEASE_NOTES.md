# Release Notes

## [v0.1.0-beta] - 2026-01-30

### 🎉 首次发布

KeepChat v0.1.0-beta 是首个公开测试版本，带来了完整的云端会话同步功能。

---

### ✨ 新功能

#### 云端会话同步
- **七牛云存储集成** - 可靠的云端存储支持
- **增量同步** - 仅上传变更内容，节省时间和流量
- **自动同步** - 后台自动备份（每 5 分钟或每 10 条消息）
- **进度反馈** - 实时显示上传/下载进度

#### 数据安全
- **AES-256-GCM 加密** - 军用级加密算法
- **PBKDF2 密钥派生** - 100,000 次 SHA-256 迭代
- **完整性验证** - SHA-256 哈希校验
- **弱密码检测** - 自动拒绝常见弱密码
- **端到端加密** - 零知识架构，七牛云无法读取数据

#### 跨设备协作
- **会话恢复** - 一键从云端恢复任意会话
- **路径映射** - 智能处理不同设备的路径差异
- **多设备合并** - 支持恢复到空会话、合并或替换当前会话
- **离线缓存** - 缓存最近恢复的会话，支持离线访问（30 天）

#### 冲突解决
- **冲突检测** - 自动检测并发修改、数据冲突、元数据冲突
- **三种解决策略**：
  - 保留本地版本覆盖云端
  - 保留云端版本覆盖本地
  - 手动合并（显示差异对比）
- **智能自动合并** - 仅一方有新消息时自动合并
- **冲突备份** - 自动备份被覆盖数据，保留 7 天

#### Slash Commands
```
/sync-session          - 同步当前会话到云端
/restore-session <id>  - 从云端恢复会话
/list-sessions         - 列出所有云端会话
/delete-session <id>   - 删除指定会话
/export-key            - 导出加密密钥
/import-key <key>      - 导入加密密钥
/rotate-key            - 轮换加密密钥
/configure             - 配置向导
```

---

### 🔧 技术架构

| 模块 | 文件 | 说明 |
|------|------|------|
| 会话同步 | 22 个模块 | 同步引擎、恢复、压缩、版本管理 |
| 七牛云适配 | 8 个模块 | 上传、下载、列表、删除、重试 |
| 加密系统 | 5 个模块 | AES-GCM、密钥派生、元数据、轮换 |
| 用户界面 | 6 个模块 | 错误处理、进度显示、通知 |

---

### 📊 性能指标

| 指标 | 数值 |
|------|------|
| 1000 条消息同步 | < 3 秒 |
| 加密/解密速度 | ~50 MB/s |
| GZIP 压缩率 | 70-80% |
| 自动合并延迟 | < 100ms |
| 内存占用 | < 100 MB |

---

### 🔒 安全特性

- ✅ AES-256-GCM 加密（12 字节 IV，16 字节认证标签）
- ✅ PBKDF2-SHA256 密钥派生（100,000 次迭代）
- ✅ SHA-256 完整性验证
- ✅ 随机 IV 每次加密生成
- ✅ GCM 认证标签防篡改
- ✅ 弱密码黑名单检测
- ✅ 密钥导出/导入（Base64 编码）

---

### 📝 文档

- [用户指南](docs/cloud-session-sync.md)
- [常见问题](docs/faq.md)
- [API 文档](docs/developer-guide.md)
- [七牛云配置指南](docs/qiniu-setup-guide.md)
- [配置示例](.codebuddy/examples/)

---

### 🧪 测试覆盖

- **98+ 单元测试** - 覆盖所有核心模块
- **端到端测试** - 完整同步和恢复流程
- **安全测试** - 加密强度验证
- **性能测试** - 大型会话（1000+ 消息）
- **网络异常测试** - 中断、超时、慢速连接

---

### 📋 系统要求

- **Node.js**: >= 20.19.0
- **七牛云账号**: 免费注册（https://www.qiniu.com/）
- **操作系统**: macOS, Linux, Windows

---

### 🚀 快速开始

```bash
# 安装
npm install -g keepchat

# 配置
keepchat configure

# 同步会话
keepchat sync

# 恢复会话
keepchat restore <session-id>
```

---

### 🔄 升级指南

从无到有安装此版本：

```bash
npm install -g keepchat@latest
keepchat init
keepchat configure
```

---

### ⚠️ 已知问题

1. **流式加密** - 当前对大文件（>10MB）使用内存加密，未来版本将支持流式处理
2. **多云存储** - 当前仅支持七牛云，AWS S3 和阿里云 OSS 计划中
3. **实时同步** - 当前为轮询模式，WebSocket 实时同步计划中

---

### 🗺️ 路线图

#### v0.2.0-beta (计划中)
- [ ] 多云存储支持（AWS S3, Aliyun OSS）
- [ ] 浏览器扩展
- [ ] 会话搜索功能
- [ ] 批量操作支持

#### v0.3.0-beta (计划中)
- [ ] 实时同步（WebSocket）
- [ ] 协作功能（多用户共享会话）
- [ ] 移动端应用

#### v1.0.0 (未来)
- [ ] 企业版（私有部署）
- [ ] 团队协作功能
- [ ] 完整的审计日志

---

### 🙏 致谢

- [OpenSpec](https://github.com/Fission-AI/OpenSpec) - 规范驱动开发框架
- [七牛云](https://www.qiniu.com/) - 云存储服务
- [Node.js](https://nodejs.org/) - JavaScript 运行时

---

### 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

### 📮 反馈与支持

- **问题反馈**: [GitHub Issues](https://github.com/jamesMuWB/keepchat/issues)
- **功能建议**: [GitHub Discussions](https://github.com/jamesMuWB/keepchat/discussions)
- **安全问题**: james_2001_2001@163.com

---

**下载**: [npmjs.com/package/keepchat](https://www.npmjs.com/package/keepchat) | **GitHub**: [jamesMuWB/keepchat](https://github.com/jamesMuWB/keepchat)
