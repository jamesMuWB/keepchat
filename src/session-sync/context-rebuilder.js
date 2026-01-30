const fs = require('fs').promises;
const path = require('path');

/**
 * 验证文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证文件哈希值
 * @param {string} filePath - 文件路径
 * @param {string} expectedHash - 预期的 SHA-256 哈希值
 * @returns {Promise<Object>} { isValid: boolean, computedHash: string }
 */
async function verifyFileHash({ filePath, expectedHash }) {
  const crypto = require('crypto');

  try {
    const data = await fs.readFile(filePath);
    const computedHash = crypto.createHash('sha256').update(data).digest('hex');

    return {
      isValid: computedHash === expectedHash,
      computedHash,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message,
    };
  }
}

/**
 * 重建文件引用状态
 * @param {Array} files - 文件引用列表
 * @param {Object} options - 选项 { verifyHashes: boolean }
 * @returns {Promise<Object>} 重建后的文件引用状态
 */
async function rebuildFileReferences({ files, options = {} }) {
  if (!files || files.length === 0) {
    return {
      files: [],
      total: 0,
      existing: 0,
      missing: 0,
      invalidHash: 0,
    };
  }

  const results = {
    files: [],
    total: files.length,
    existing: 0,
    missing: 0,
    invalidHash: 0,
  };

  for (const fileRef of files) {
    const exists = await fileExists(fileRef.path);

    let hashResult = null;
    if (exists && options.verifyHashes && fileRef.sha256) {
      hashResult = await verifyFileHash({
        filePath: fileRef.path,
        expectedHash: fileRef.sha256,
      });
    }

    results.files.push({
      path: fileRef.path,
      exists,
      sizeBytes: fileRef.sizeBytes,
      hash: fileRef.sha256,
      hashValid: hashResult ? hashResult.isValid : null,
      lastModified: exists ? (await fs.stat(fileRef.path)).mtime.toISOString() : null,
    });

    if (exists) {
      results.existing++;
      if (hashResult && !hashResult.isValid) {
        results.invalidHash++;
      }
    } else {
      results.missing++;
    }
  }

  return results;
}

/**
 * 重建工作上下文
 * @param {Object} context - 会话上下文
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 重建后的工作上下文
 */
async function rebuildWorkContext({ context, options = {} }) {
  const { projectPath, files, activeFiles, notes } = context;

  // 验证项目路径
  let projectExists = false;
  let projectAccessible = false;

  if (projectPath) {
    projectExists = await fileExists(projectPath);
    projectAccessible = projectExists
      ? (await filePermissions({ path: projectPath })).readable
      : false;
  }

  // 重建文件引用
  const fileReferences = await rebuildFileReferences({
    files,
    options,
  });

  // 验证活动文件
  const activeFileStatus = await Promise.all(
    (activeFiles || []).map(async (activePath) => {
      const exists = await fileExists(activePath);
      const inContext = files?.some((f) => f.path === activePath);

      return {
        path: activePath,
        exists,
        inContext,
      };
    }),
  );

  return {
    original: context,
    rebuilt: {
      projectPath,
      projectExists,
      projectAccessible,
      files: fileReferences.files,
      activeFiles: activeFileStatus,
      notes,
    },
    summary: {
      projectPath,
      projectStatus: projectAccessible ? 'accessible' : projectExists ? 'inaccessible' : 'missing',
      totalFiles: fileReferences.total,
      existingFiles: fileReferences.existing,
      missingFiles: fileReferences.missing,
      filesWithInvalidHash: fileReferences.invalidHash,
      activeFilesCount: activeFileStatus.length,
      activeFilesAccessible: activeFileStatus.filter((f) => f.exists).length,
    },
  };
}

/**
 * 检查文件权限
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 权限状态
 */
async function filePermissions({ filePath }) {
  try {
    const stats = await fs.stat(filePath);
    const mode = stats.mode;

    return {
      readable: (mode & 0o400) !== 0,
      writable: (mode & 0o200) !== 0,
      executable: (mode & 0o100) !== 0,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  } catch (error) {
    return {
      readable: false,
      writable: false,
      executable: false,
      isDirectory: false,
      isFile: false,
      error: error.message,
    };
  }
}

/**
 * 生成上下文报告
 * @param {Object} rebuiltContext - 重建后的上下文
 * @returns {string} 格式化的报告
 */
function generateContextReport({ rebuiltContext }) {
  const { rebuilt, summary } = rebuiltContext;

  const lines = [
    '=== Work Context Report ===',
    '',
    `Project Path: ${summary.projectPath || 'N/A'}`,
    `Project Status: ${summary.projectStatus}`,
    '',
    'File References:',
    `  Total: ${summary.totalFiles}`,
    `  Existing: ${summary.existingFiles}`,
    `  Missing: ${summary.missingFiles}`,
    `  Invalid Hash: ${summary.filesWithInvalidHash}`,
    '',
    'Active Files:',
    `  Total: ${summary.activeFilesCount}`,
    `  Accessible: ${summary.activeFilesAccessible}`,
    '',
  ];

  // 列出缺失的文件
  if (summary.missingFiles > 0) {
    lines.push('Missing Files:');
    rebuilt.files
      .filter((f) => !f.exists)
      .forEach((f) => {
        lines.push(`  - ${f.path}`);
      });
    lines.push('');
  }

  // 列出哈希不匹配的文件
  if (summary.filesWithInvalidHash > 0) {
    lines.push('Files with Invalid Hash (modified externally):');
    rebuilt.files
      .filter((f) => !f.hashValid)
      .forEach((f) => {
        lines.push(`  - ${f.path}`);
      });
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  fileExists,
  verifyFileHash,
  rebuildFileReferences,
  rebuildWorkContext,
  filePermissions,
  generateContextReport,
};
