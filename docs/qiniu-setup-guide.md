# 七牛云配置指南

本指南将帮助您快速配置七牛云以使用 CodeBuddy 的云端会话同步功能。

## 目录

1. [注册账号](#注册账号)
2. [创建存储空间](#创建存储空间)
3. [获取密钥](#获取密钥)
4. [配置 CodeBuddy](#配置-codebuddy)
5. [验证配置](#验证配置)
6. [常见问题](#常见问题)

---

## 注册账号

### 步骤 1: 访问七牛云官网

访问 https://www.qiniu.com/ 点击右上角"注册"。

### 步骤 2: 填写注册信息

- 手机号或邮箱
- 密码
- 验证码

### 步骤 3: 实名认证（可选）

实名认证后可获得更多免费额度，但个人使用不需要认证。

---

## 创建存储空间

### 步骤 1: 登录控制台

登录后访问: https://portal.qiniu.com/console/bucket

### 步骤 2: 新建空间

点击"新建空间"按钮。

### 步骤 3: 配置空间

| 配置项       | 推荐值             | 说明                             |
| ------------ | ------------------ | -------------------------------- |
| **存储区域** | 华东 (z0)          | 选择离您最近的区域以获得最佳性能 |
| **空间名称** | codebuddy-sessions | 自定义名称，全局唯一             |
| **访问控制** | 私有               | 保护您的隐私数据                 |
| **存储类型** | 标准存储           | 适合频繁访问的数据               |

### 步骤 4: 确认创建

点击"确定"完成创建。记住您的空间名称，后续配置会用到。

---

## 获取密钥

### 步骤 1: 进入密钥管理

1. 点击右上角头像
2. 选择"密钥管理"
3. 或直接访问: https://portal.qiniu.com/user/key

### 步骤 2: 查看密钥

您会看到:

- **AccessKey**: 公钥，类似于用户名
- **SecretKey**: 私钥，类似于密码

### 步骤 3: 复制密钥

点击复制按钮，将两个密钥保存到安全的地方。

**安全提示**:

- 不要分享您的 SecretKey
- 不要将密钥提交到 Git 仓库
- 定期更换密钥

---

## 配置 CodeBuddy

### 方法 1: 使用配置命令（推荐）

```bash
/configure-qiniu
```

按提示输入:

1. AccessKey
2. SecretKey
3. Bucket 名称（您创建的空间名称）
4. 区域（如: z0）

### 方法 2: 使用环境变量

编辑您的 shell 配置文件（如 `~/.bashrc` 或 `~/.zshrc`）:

```bash
export QINIU_ACCESS_KEY="your-access-key"
export QINIU_SECRET_KEY="your-secret-key"
export QINIU_BUCKET="your-bucket-name"
export QINIU_REGION="z0"
```

然后重新加载配置:

```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

### 方法 3: 使用配置文件

创建或编辑 `~/.codebuddy/qiniu-config.json`:

```json
{
  "accessKey": "your-access-key",
  "secretKey": "your-secret-key",
  "bucket": "your-bucket-name",
  "region": "z0"
}
```

**注意**: 配置文件中的密钥会被加密存储。

---

## 验证配置

### 检查配置状态

```bash
/configure-qiniu --status
```

预期输出:

```
✅ Qiniu configuration is valid

Bucket: codebuddy-sessions
Region: z0 (East China)
Status: Connected
```

### 测试连接

```bash
/sync-session --test
```

如果配置正确，您将看到连接成功的消息。

---

## 区域代码对照表

| 代码 | 区域   | 推荐用户           |
| ---- | ------ | ------------------ |
| z0   | 华东   | 上海、江苏、浙江等 |
| z1   | 华北   | 北京、天津等       |
| z2   | 华南   | 广东、广西等       |
| na0  | 北美   | 美国、加拿大       |
| as0  | 东南亚 | 新加坡、马来西亚等 |

---

## 常见问题

### Q: 提示"认证失败"怎么办？

**A**: 检查以下几点:

1. AccessKey 和 SecretKey 是否正确
2. 是否复制时包含多余空格
3. 密钥是否已过期或被禁用

### Q: 提示"空间不存在"怎么办？

**A**:

1. 确认空间名称拼写正确
2. 确认空间已创建
3. 检查区域代码是否匹配

### Q: 上传速度慢怎么办？

**A**:

1. 选择离您最近的区域
2. 检查网络连接
3. 尝试切换网络（如从 WiFi 换到 4G）

### Q: 如何更换密钥？

**A**:

1. 在七牛云控制台禁用旧密钥
2. 创建新密钥
3. 重新配置 CodeBuddy

### Q: 免费额度用完怎么办？

**A**:

1. 清理旧会话: `/cleanup-sessions`
2. 升级七牛云套餐
3. 或创建新的账号（仅限个人测试）

### Q: 数据存储在哪个地区？

**A**: 数据存储在您创建空间时选择的区域。请根据您的位置和隐私要求选择合适的区域。

### Q: 如何删除所有数据？

**A**:

1. 在七牛云控制台删除空间
2. 或使用 `/cleanup-sessions` 删除所有会话

---

## 安全最佳实践

1. **定期更换密钥**: 每 3-6 个月更换一次
2. **使用私有空间**: 确保空间访问控制为"私有"
3. **启用密钥加密**: 使用 CodeBuddy 的配置加密功能
4. **监控使用量**: 定期检查存储和流量使用情况
5. **设置报警**: 在七牛云控制台设置用量报警

---

## 相关链接

- 七牛云官网: https://www.qiniu.com/
- 控制台: https://portal.qiniu.com/
- 对象存储文档: https://developer.qiniu.com/kodo
- 定价详情: https://www.qiniu.com/prices

---

## 获取帮助

如有问题，请:

1. 查看 [常见问题](#常见问题)
2. 访问七牛云文档
3. 联系七牛云技术支持
4. 或提交 Issue 到 CodeBuddy 项目
