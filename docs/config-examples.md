# 配置文件示例

本文档提供了云端会话同步功能的配置文件示例。

## 目录

1. [七牛云配置](#七牛云配置)
2. [加密配置](#加密配置)
3. [环境变量配置](#环境变量配置)
4. [完整配置示例](#完整配置示例)

---

## 七牛云配置

### qiniu-config.json

```json
{
  "accessKey": "your-access-key-here",
  "secretKey": "your-secret-key-here",
  "bucket": "codebuddy-sessions",
  "region": "z0",
  "domain": "https://cdn.your-domain.com"
}
```

**配置说明**:

| 字段        | 类型   | 必需 | 说明                        |
| ----------- | ------ | ---- | --------------------------- |
| `accessKey` | string | 是   | 七牛云 AccessKey            |
| `secretKey` | string | 是   | 七牛云 SecretKey            |
| `bucket`    | string | 是   | 存储空间名称                |
| `region`    | string | 是   | 区域代码 (z0/z1/z2/na0/as0) |
| `domain`    | string | 否   | 自定义 CDN 域名             |

### 区域代码

```json
{
  "regions": {
    "z0": "华东",
    "z1": "华北",
    "z2": "华南",
    "na0": "北美",
    "as0": "东南亚"
  }
}
```

---

## 加密配置

### encryption-config.json

```json
{
  "mode": "auto",
  "apiKey": "base64-encoded-api-key-here"
}
```

**配置说明**:

| 字段     | 类型   | 必需             | 说明                           |
| -------- | ------ | ---------------- | ------------------------------ |
| `mode`   | string | 是               | 加密模式: `auto` 或 `password` |
| `apiKey` | string | mode=auto 时必需 | Base64 编码的 API Key          |

### 密码模式配置

```json
{
  "mode": "password",
  "passwordHint": "your-password-hint",
  "salt": "base64-salt"
}
```

---

## 环境变量配置

### .env 文件

```bash
# 七牛云配置
QINIU_ACCESS_KEY=your-access-key-here
QINIU_SECRET_KEY=your-secret-key-here
QINIU_BUCKET=codebuddy-sessions
QINIU_REGION=z0

# 加密配置
ENCRYPTION_MODE=auto
ENCRYPTION_API_KEY=base64-encoded-api-key-here

# 同步配置
AUTO_SYNC_ENABLED=true
AUTO_SYNC_INTERVAL=300000
AUTO_SYNC_MESSAGE_THRESHOLD=10

# 存储配置
STORAGE_WARNING_THRESHOLD=9663676416
STORAGE_CRITICAL_THRESHOLD=10105505792
```

**环境变量说明**:

| 变量                          | 说明                 | 默认值        |
| ----------------------------- | -------------------- | ------------- |
| `QINIU_ACCESS_KEY`            | 七牛云 AccessKey     | -             |
| `QINIU_SECRET_KEY`            | 七牛云 SecretKey     | -             |
| `QINIU_BUCKET`                | 存储空间名称         | -             |
| `QINIU_REGION`                | 区域代码             | `z0`          |
| `ENCRYPTION_MODE`             | 加密模式             | `auto`        |
| `ENCRYPTION_API_KEY`          | 加密 API Key         | -             |
| `AUTO_SYNC_ENABLED`           | 是否启用自动同步     | `false`       |
| `AUTO_SYNC_INTERVAL`          | 自动同步间隔（毫秒） | `300000`      |
| `AUTO_SYNC_MESSAGE_THRESHOLD` | 触发同步的消息数     | `10`          |
| `STORAGE_WARNING_THRESHOLD`   | 存储警告阈值（字节） | `9663676416`  |
| `STORAGE_CRITICAL_THRESHOLD`  | 存储临界阈值（字节） | `10105505792` |

---

## 完整配置示例

### config.json

```json
{
  "qiniu": {
    "accessKey": "your-access-key",
    "secretKey": "your-secret-key",
    "bucket": "codebuddy-sessions",
    "region": "z0",
    "uploadOptions": {
      "chunkSize": 4194304,
      "concurrent": 3
    },
    "downloadOptions": {
      "chunkSize": 4194304
    }
  },
  "encryption": {
    "mode": "auto",
    "algorithm": "aes-256-gcm",
    "keyDerivation": {
      "algorithm": "pbkdf2",
      "hash": "sha256",
      "iterations": 100000
    }
  },
  "compression": {
    "algorithm": "gzip",
    "level": 6
  },
  "sync": {
    "autoSync": {
      "enabled": false,
      "interval": 300000,
      "messageThreshold": 10
    },
    "incremental": true,
    "retry": {
      "maxRetries": 3,
      "retryDelay": 1000
    }
  },
  "storage": {
    "warningThreshold": 9663676416,
    "criticalThreshold": 10105505792,
    "cleanup": {
      "autoCleanup": false,
      "olderThan": 2592000000,
      "keepFree": 1073741824
    }
  },
  "conflict": {
    "resolutionStrategy": "ask",
    "backupEnabled": true,
    "backupRetention": 604800000
  },
  "offline": {
    "detectionEnabled": true,
    "checkInterval": 30000,
    "cacheOperations": true,
    "cacheMaxAge": 60000
  },
  "ux": {
    "showProgress": true,
    "showNotifications": true,
    "interruptEnabled": true
  }
}
```

---

## 最小配置示例

### 最小可用配置

```json
{
  "qiniu": {
    "accessKey": "your-access-key",
    "secretKey": "your-secret-key",
    "bucket": "your-bucket",
    "region": "z0"
  }
}
```

使用此配置，所有其他设置将使用默认值。

---

## 高级配置示例

### 多环境配置

```json
{
  "development": {
    "qiniu": {
      "bucket": "codebuddy-dev"
    },
    "sync": {
      "autoSync": {
        "enabled": true
      }
    }
  },
  "production": {
    "qiniu": {
      "bucket": "codebuddy-prod"
    },
    "sync": {
      "autoSync": {
        "enabled": false
      }
    }
  }
}
```

### 自定义 CDN 配置

```json
{
  "qiniu": {
    "bucket": "codebuddy-sessions",
    "region": "z0",
    "domain": "https://cdn.example.com",
    "ssl": true,
    "protocol": "https"
  }
}
```

### 自定义加密配置

```json
{
  "encryption": {
    "mode": "password",
    "algorithm": "aes-256-gcm",
    "keyDerivation": {
      "algorithm": "pbkdf2",
      "hash": "sha256",
      "iterations": 100000,
      "saltLength": 32
    }
  }
}
```

---

## 配置验证

### 检查配置命令

```bash
# 检查七牛云配置
/configure-qiniu --status

# 检查加密配置
/configure-encryption --status

# 检查所有配置
/configure --status
```

### 预期输出

```
✅ Configuration is valid

Qiniu Configuration:
  Bucket: codebuddy-sessions
  Region: z0 (East China)
  Status: Connected

Encryption Configuration:
  Mode: auto
  Algorithm: aes-256-gcm
  Status: Active
```

---

## 配置安全建议

1. **加密敏感信息**: 使用配置加密功能
2. **限制文件权限**: 配置文件仅限所有者可读
3. **使用环境变量**: 敏感配置使用环境变量
4. **定期轮换密钥**: 定期更换 AccessKey 和加密密钥
5. **版本控制**: 不要将配置文件提交到 Git

### .gitignore 示例

```gitignore
# 配置文件
.codebuddy/config.json
.codebuddy/qiniu-config.json
.codebuddy/encryption-config.json
.env

# 但保留示例配置
!.codebuddy/config.example.json
```

---

## 故障排除

### 配置文件未找到

```bash
# 检查配置文件路径
ls -la ~/.codebuddy/

# 重新配置
/configure-qiniu
```

### 配置验证失败

```bash
# 检查配置格式
cat ~/.codebuddy/qiniu-config.json | jq .

# 重置配置
/configure-qiniu --reset
```

---

## 相关文档

- [用户使用指南](./cloud-session-sync.md)
- [七牛云配置指南](./qiniu-setup-guide.md)
- [开发者文档](./developer-guide.md)
