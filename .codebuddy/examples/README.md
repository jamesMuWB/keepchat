# CodeBuddy 配置示例

本目录包含 CodeBuddy 云会话同步功能的配置文件示例。

## 文件说明

### qiniu-config.example.json

七牛云存储配置示例。包含：
- 认证凭证配置
- 存储空间配置
- 区域选择
- 上传下载配置

**使用方法**：
```bash
# 1. 复制示例文件
cp qiniu-config.example.json qiniu-config.json

# 2. 编辑配置文件，填写您的凭证
nano qiniu-config.json

# 3. 移动到配置目录
mv qiniu-config.json ~/.codebuddy/
```

### encryption-config.example.json

加密配置示例。包含：
- 加密模式选择（auto/password）
- API Key 配置
- 密码模式配置
- 算法参数配置

**使用方法**：
```bash
# 1. 复制示例文件
cp encryption-config.example.json encryption-config.json

# 2. 编辑配置文件
nano encryption-config.json

# 3. 移动到配置目录
mv encryption-config.json ~/.codebuddy/
```

## 配置步骤

### 步骤 1: 注册七牛云账号

1. 访问 https://portal.qiniu.com/signup
2. 完成注册和实名认证
3. 确保获得免费额度：10GB 存储 + 10GB 流量/月

### 步骤 2: 创建存储空间

1. 访问 https://portal.qiniu.com/console/bucket
2. 点击"新建空间"
3. 配置：
   - 存储区域：选择离您最近的区域
   - 空间名称：自定义（如 `codebuddy-sessions`）
   - 访问控制：选择"私有"
4. 记住您的空间名称

### 步骤 3: 获取密钥

1. 访问 https://portal.qiniu.com/user/key
2. 复制 AccessKey 和 SecretKey
3. **安全提示**：
   - 不要分享您的 SecretKey
   - 不要将密钥提交到 Git 仓库
   - 定期更换密钥

### 步骤 4: 配置 CodeBuddy

#### 方法 1: 使用配置命令（推荐）

```bash
/configure-qiniu
```

按提示输入：
1. AccessKey
2. SecretKey
3. Bucket 名称
4. 区域

#### 方法 2: 使用配置文件

1. 复制示例配置并编辑：
```bash
cp qiniu-config.example.json qiniu-config.json
nano qiniu-config.json
```

2. 填写配置：
```json
{
  "accessKey": "your-access-key",
  "secretKey": "your-secret-key",
  "bucket": "codebuddy-sessions",
  "region": "z0"
}
```

3. 移动到配置目录：
```bash
mv qiniu-config.json ~/.codebuddy/
```

### 步骤 5: 配置加密

```bash
/configure-encryption
```

选择加密模式：
- **API Key 模式**（推荐多设备用户）：
  - 系统自动生成密钥
  - 使用 `/export-key` 导出备份
  - 在其他设备使用 `/import-key` 导入

- **密码模式**（单设备用户）：
  - 设置您自己的密码
  - 密码强度要求：至少 8 位，包含字母和数字
  - 注意：忘记密码无法恢复云端数据

### 步骤 6: 验证配置

```bash
# 检查七牛云配置
/configure-qiniu --status

# 检查加密配置
/configure-encryption --status

# 测试连接
/sync-session --test
```

## 环境变量配置

除了配置文件，您也可以使用环境变量：

```bash
# 七牛云配置
export QINIU_ACCESS_KEY="your-access-key"
export QINIU_SECRET_KEY="your-secret-key"
export QINIU_BUCKET="codebuddy-sessions"
export QINIU_REGION="z0"

# 加密配置
export ENCRYPTION_MODE="auto"
export ENCRYPTION_API_KEY="base64-encoded-key"

# 自动同步配置
export AUTO_SYNC_ENABLED="true"
export AUTO_SYNC_INTERVAL="300000"  # 5 分钟
export AUTO_SYNC_MESSAGE_THRESHOLD="10"  # 每 10 条消息

# 存储限制配置
export STORAGE_WARNING_THRESHOLD="9663676416"  # 9GB
export STORAGE_CRITICAL_THRESHOLD="10105505792"  # 9.5GB
```

将上述命令添加到您的 shell 配置文件（如 `~/.bashrc` 或 `~/.zshrc`）中。

## 配置文件位置

配置文件应存放在 `~/.codebuddy/` 目录下：

```
~/.codebuddy/
├── qiniu-config.json       # 七牛云配置
├── encryption-config.json   # 加密配置
└── sync-state.json          # 同步状态（自动生成）
```

## 安全建议

1. **保护密钥**
   - 不要将密钥提交到版本控制系统
   - 使用环境变量存储敏感信息
   - 定期更换密钥

2. **备份数据**
   - 定期导出会话数据
   - 保存加密密钥的备份
   - 记住密码模式的密码

3. **监控使用量**
   - 定期检查存储空间使用情况
   - 设置使用量警告
   - 及时清理旧会话

4. **权限管理**
   - 使用私有存储空间
   - 限制存储空间的访问权限
   - 定期审查访问控制列表

## 故障排除

### 配置验证失败

```bash
# 检查配置文件是否存在
ls -la ~/.codebuddy/

# 验证配置文件格式
cat ~/.codebuddy/qiniu-config.json | jq .

# 检查环境变量
env | grep QINIU
```

### 认证失败

1. 确认 AccessKey 和 SecretKey 正确
2. 检查密钥是否已过期
3. 验证存储空间名称拼写
4. 确认区域代码正确

### 连接超时

1. 检查网络连接
2. 尝试禁用 VPN 或代理
3. 选择离您更近的区域
4. 检查防火墙设置

## 获取帮助

- 七牛云文档：https://developer.qiniu.com/kodo
- 常见问题：查看 FAQ 文档
- 提交问题：[GitHub Issues](https://github.com/your-repo/issues)
