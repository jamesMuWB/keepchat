# Release Notes

## [v0.1.0-beta] - 2026-01-30

### 🎉 首次发布

KeepChat v0.1.0-beta 是我们的首个公开测试版本，带来了完整的跨设备会话同步功能。

---

### ✨ 核心特性

#### 云端会话同步
- **七牛云存储集成** - 可靠的云端存储，支持断点续传和自动重试
- **AES-256-GCM 加密** - 军用级端到端加密，保护你的对话隐私
- **增量同步** - 智能检测变更，仅上传修改部分，节省流量和时间
- **自动同步模式** - 后台自动备份，每 5 分钟或每 10 条消息自动触发

#### 跨设备协作
- **会话恢复** - 一键从云端恢复任意历史会话
- **智能路径映射** - 自动处理不同设备间的路径差异
- **冲突检测与解决** - 三种解决策略 + 智能自动合并
- **冲突备份** - 自动备份被覆盖的数据，保留 7 天

#### Slash Commands
```bash
/sync-session          # 同步当前会话
/restore-session       # 恢复云端会话
/list-sessions         # 列出所有会话
/delete-session        # 删除指定会话
/export-key            # 导出加密密钥
/import-key            # 导入加密密钥
/rotate-key            # 轮换加密密钥
```

---

### 🔒 安全性

| 特性 | 说明 |
|------|------|
| 加密算法 | AES-256-GCM (NIST 认证) |
| 密钥派生 | PBKDF2-SHA256 (100,000 次迭代) |
| 完整性验证 | SHA-256 哈希校验 |
| 认证标签 | GCM 模式 16 字节认证标签 |
| 密钥管理 | 导入/导出/轮换功能 |
| 弱密码检测 | 自动拒绝常见弱密码 |

---

### 📊 性能指标

| 场景 | 性能 |
|------|------|
| 1000 条消息同步 | < 3 秒 |
| 加密/解密速度 | ~50 MB/s |
| GZIP 压缩率 | 70-80% |
| 自动合并延迟 | < 100ms |
| 内存占用 | < 100 MB |

---

### 📦 技术栈

- **Node.js** >= 20.19.0
- **七牛云 Kodo** - 云端存储
- **Vitest** - 测试框架
- **ES Modules** - 模块系统

---

### 🧪 测试覆盖

| 测试类型 | 数量 |
|----------|------|
| 单元测试 | 98+ |
| 端到端测试 | 2 套 |
| 安全测试 | 完整覆盖 |
| 性能测试 | 大型会话场景 |
| 网络异常测试 | 中断/超时/慢速 |

---

### 📚 文档

- [用户指南](docs/cloud-session-sync.md) - 完整使用说明
- [常见问题](docs/faq.md) - FAQ 和故障排除
- [API 文档](docs/developer-guide.md) - 开发者 API
- [架构文档](docs/developer-guide.md#架构) - 系统设计
- [七牛云配置指南](docs/qiniu-setup-guide.md) - 存储配置
- [配置示例](.codebuddy/examples/) - 配置文件模板

---

### 🚀 快速开始

```bash
# 安装
npm install -g keepchat

# 配置七牛云
keepchat configure qiniu

# 配置加密
keepchat configure encryption

# 同步会话
keepchat sync
```

---

### ⚠️ 已知问题

1. 流式加密尚未实现 (大文件 >10MB 可能内存占用较高)
2. CI/CD 流程待配置
3. 多云存储支持待开发

---

### 🔮 路线图

#### v0.2.0 (计划中)
- [ ] 多云存储支持 (AWS S3, Aliyun OSS)
- [ ] 浏览器扩展
- [ ] 性能优化

#### v0.3.0 (规划中)
- [ ] 实时同步 (WebSocket)
- [ ] 协作功能 (多用户共享会话)
- [ ] 移动端应用

#### v1.0.0 (未来)
- [ ] 企业版 (私有部署)
- [ ] 完整的 CI/CD
- [ ] SLA 保证

---

### 🙏 致谢

- [OpenSpec](https://github.com/Fission-AI/OpenSpec) - 规范驱动开发框架
- [七牛云](https://www.qiniu.com/) - 云存储服务
- 所有贡献者和测试用户

---

### 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

### 💬 反馈与支持

- **问题反馈**: [GitHub Issues](https://github.com/jamesMuWB/keepchat/issues)
- **功能建议**: [GitHub Discussions](https://github.com/jamesMuWB/keepchat/discussions)
- **安全问题**: security@example.com

---

**下载**: [v0.1.0-beta](https://github.com/jamesMuWB/keepchat/releases/tag/v0.1.0-beta)

---

*让 AI 对话，无处不在。* ⚡
