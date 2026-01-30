const readline = require('readline');
const { loadQiniuConfig, saveQiniuConfig } = require('../config/config-manager');
const { loadEncryptionConfig, saveEncryptionConfig } = require('../config/config-manager');

/**
 * 检查是否需要首次配置
 */
async function needsInitialSetup() {
  const qiniuConfig = loadQiniuConfig();
  const encryptionConfig = loadEncryptionConfig();

  const qiniuConfigured = !qiniuConfig._missing;
  const encryptionConfigured = !encryptionConfig._missing;

  return {
    needsSetup: !qiniuConfigured || !encryptionConfigured,
    qiniuConfigured,
    encryptionConfigured,
  };
}

/**
 * 首次使用引导流程
 */
async function runInitialSetup() {
  console.log('\n' + '='.repeat(60));
  console.log('Welcome to CodeBuddy Cloud Session Sync!');
  console.log('='.repeat(60));
  console.log('\nThis wizard will help you set up cloud storage for session sync.');

  // 步骤 1：七牛云配置
  console.log('\n--- Step 1: Qiniu Cloud Storage Configuration ---');
  const qiniuSetup = await configureQiniu();

  if (!qiniuSetup.success) {
    console.log('\nSetup cancelled. You can run /configure-qiniu later to complete setup.');
    return qiniuSetup;
  }

  // 步骤 2：加密配置
  console.log('\n--- Step 2: Encryption Configuration ---');
  const encryptionSetup = await configureEncryption();

  if (!encryptionSetup.success) {
    console.log('\nSetup cancelled. You can run /configure-encryption later to complete setup.');
    return encryptionSetup;
  }

  // 完成
  console.log('\n' + '='.repeat(60));
  console.log('Setup completed successfully!');
  console.log('='.repeat(60));
  console.log('\nYou can now use these commands:');
  console.log('  /sync-session      - Upload current session to cloud');
  console.log('  /restore-session   - Download and restore a session');
  console.log('  /list-sessions    - List all cloud sessions');
  console.log('\nDocumentation: See docs/cloud-session-sync.md for more details');

  return {
    success: true,
    qiniu: qiniuSetup,
    encryption: encryptionSetup,
  };
}

/**
 * 配置七牛云
 */
async function configureQiniu() {
  console.log('\nYou need a Qiniu Cloud account (free tier: 10GB storage + 10GB traffic/month)');
  console.log('\nSign up: https://portal.qiniu.com/signup');

  const hasAccount = await promptYesNo('Do you have a Qiniu account? (yes/no): ');
  if (!hasAccount) {
    console.log('\nPlease create an account and run this setup again.');
    console.log('Your existing configurations will be preserved.');
    return {
      success: false,
      cancelled: true,
      message: 'User does not have Qiniu account yet',
    };
  }

  try {
    // 获取 AccessKey
    const accessKey = await prompt('\nEnter your Qiniu AccessKey: ');
    if (!accessKey || accessKey.length < 20) {
      return {
        success: false,
        error: 'Invalid AccessKey',
        message: 'AccessKey must be at least 20 characters',
      };
    }

    // 获取 SecretKey
    const secretKey = await prompt('Enter your Qiniu SecretKey: ');
    if (!secretKey || secretKey.length < 30) {
      return {
        success: false,
        error: 'Invalid SecretKey',
        message: 'SecretKey must be at least 30 characters',
      };
    }

    // 获取 Bucket 名称
    const bucket = await prompt('Enter your bucket name (or press Enter to create one): ');
    if (!bucket) {
      const suggestedBucket = `codebuddy-sessions-${getRandomString(8)}`;
      const useSuggested = await promptYesNo(
        `No bucket provided. Create "${suggestedBucket}"? (yes/no): `,
      );

      if (!useSuggested) {
        return {
          success: false,
          cancelled: true,
          message: 'Setup cancelled by user',
        };
      }
    }

    const finalBucket = bucket || suggestedBucket;

    // 获取区域
    console.log('\nAvailable regions:');
    console.log('  z0 - East China (Nanjing)');
    console.log('  z1 - North China (Beijing)');
    console.log('  z2 - South China (Guangzhou)');
    console.log('  na0 - North America');
    console.log('  as0 - Southeast Asia');

    const region = (await prompt('\nSelect region (default: z0): ')) || 'z0';

    // 保存配置
    const config = {
      accessKey: accessKey,
      secretKey: secretKey,
      bucket: finalBucket,
      region: region,
      prefix: 'sessions',
    };

    await saveQiniuConfig(config);

    console.log('\n✓ Qiniu configuration saved!');

    return {
      success: true,
      config,
      message: 'Qiniu configuration completed',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to configure Qiniu',
    };
  }
}

/**
 * 配置加密
 */
async function configureEncryption() {
  console.log('\nEncryption is used to protect your session data in cloud storage.');

  const mode = (await prompt('\nEncryption mode (apikey/password, default: apikey): ')) || 'apikey';

  if (mode !== 'apikey' && mode !== 'password') {
    return {
      success: false,
      error: 'Invalid mode',
      message: "Mode must be 'apikey' or 'password'",
    };
  }

  if (mode === 'apikey') {
    // API key 模式
    const apikey = await promptYesNo(
      '\nDo you want to generate a new API key? (recommended) (yes/no): ',
    );

    if (apikey) {
      // 生成新的 API key
      const crypto = require('crypto');
      const newKey = crypto.randomBytes(32).toString('base64');

      const config = {
        apiKey: newKey,
        mode: 'apikey',
      };

      await saveEncryptionConfig(config);

      console.log('\n✓ Generated new API key');
      console.log('✓ Encryption configuration saved!');

      console.log('\nImportant: This key is required to decrypt your sessions.');
      console.log('You should back it up using: /export-key');

      return {
        success: true,
        config,
        apiKey: newKey,
        message: 'Encryption configuration completed with new API key',
      };
    } else {
      // 输入现有的 API key
      const existingKey = await prompt('\nEnter your existing API key (Base64 encoded): ');

      if (!existingKey || existingKey.length < 10) {
        return {
          success: false,
          error: 'Invalid API key',
          message: 'API key must be a valid Base64 string',
        };
      }

      const config = {
        apiKey: existingKey,
        mode: 'apikey',
      };

      await saveEncryptionConfig(config);

      console.log('\n✓ Encryption configuration saved!');

      return {
        success: true,
        config,
        message: 'Encryption configuration completed with existing API key',
      };
    }
  } else {
    // 密码模式
    console.log('\n⚠️  Password mode is recommended for advanced users.');
    console.log("   - You'll need to enter this password when restoring sessions");
    console.log('   - If you lose the password, you cannot decrypt your sessions');

    const confirmPassword = await promptYesNo(
      '\nAre you sure you want to use password mode? (yes/no): ',
    );

    if (!confirmPassword) {
      return {
        success: false,
        cancelled: true,
        message: 'User chose not to use password mode',
      };
    }

    console.log('\nPassword requirements: minimum 8 characters, letters and numbers');

    let password, confirmPassword;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      password = await prompt(`\nEnter password (attempt ${attempts}/${maxAttempts}): `);

      if (password.length < 8) {
        console.log('Password must be at least 8 characters. Try again.');
        continue;
      }

      if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
        console.log('Password must contain both letters and numbers. Try again.');
        continue;
      }

      confirmPassword = await prompt('Confirm password: ');

      if (password !== confirmPassword) {
        console.log('Passwords do not match. Try again.');
        continue;
      }

      // 密码有效
      const config = {
        mode: 'password',
        // 注意：密码不被存储，只存储模式
      };

      await saveEncryptionConfig(config);

      console.log('\n✓ Encryption configuration saved!');
      console.log('⚠️  Password was NOT saved (for security)');
      console.log("   You'll need to remember this password to restore sessions");

      return {
        success: true,
        config,
        message: 'Encryption configuration completed with password mode',
      };
    }

    // 超过最大尝试次数
    return {
      success: false,
      error: 'too_many_attempts',
      message: 'Failed after 3 attempts',
    };
  }
}

/**
 * 生成随机字符串
 */
function getRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 提示 Yes/No 问题
 */
function promptYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * 提示输入
 */
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * 显示配置状态
 */
async function showConfigStatus() {
  const { needsSetup, qiniuConfigured, encryptionConfigured } = await needsInitialSetup();

  console.log('\n' + '='.repeat(60));
  console.log('Configuration Status');
  console.log('='.repeat(60));
  console.log(`\nQiniu Cloud Storage: ${qiniuConfigured ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`Encryption: ${encryptionConfigured ? '✓ Configured' : '✗ Not configured'}`);

  if (!needsSetup) {
    console.log('\nConfiguration is complete!');
    console.log('\nYou can use these commands:');
    console.log('  /sync-session      - Upload current session to cloud');
    console.log('  /restore-session   - Download and restore a session');
    console.log('  /list-sessions    - List all cloud sessions');
  } else {
    console.log('\nConfiguration is incomplete.');
    console.log('\nRun /configure to complete setup, or:');
    console.log('  /configure-qiniu    - Configure cloud storage');
    console.log('  /configure-encryption - Configure encryption');
  }

  console.log('\n' + '='.repeat(60));

  return {
    success: true,
    needsSetup,
    qiniuConfigured,
    encryptionConfigured,
  };
}

/**
 * 显示配置帮助
 */
function showSetupHelp() {
  const help = `
# Setup Command

Initial setup wizard for cloud session sync.

## Usage
  /configure [options]

## Options
  --qiniu          Configure Qiniu cloud storage only
  --encryption      Configure encryption only
  --status         Show configuration status
  --help           Show this help message

## Examples
  /configure              Run full setup wizard
  /configure --qiniu       Configure cloud storage only
  /configure --encryption   Configure encryption only
  /configure --status      Show current status

## What It Configures
  - Qiniu Cloud Storage credentials (AccessKey, SecretKey, Bucket, Region)
  - Encryption settings (API key or password mode)
  - All sensitive data is encrypted at rest

## Notes
  - Qiniu free tier: 10GB storage + 10GB traffic/month
  - Sign up: https://portal.qiniu.com/signup
  - Your data is encrypted before uploading
  - API key mode is recommended for ease of use
  - Password mode provides additional security
  `.trim();

  console.log(help);

  return {
    success: true,
    help,
    message: 'Help displayed',
  };
}

module.exports = {
  needsInitialSetup,
  runInitialSetup,
  configureQiniu,
  configureEncryption,
  showConfigStatus,
  showSetupHelp,
};
