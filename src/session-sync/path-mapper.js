const path = require('path');
const os = require('os');

/**
 * 获取当前平台
 * @returns {string} 平台类型
 */
function getPlatform() {
  return os.platform();
}

/**
 * 检测路径类型
 * @param {string} filePath - 文件路径
 * @returns {Object} 路径信息 { platform, isAbsolute, isWindows, isUnix }
 */
function detectPathType({ filePath }) {
  const isWindows = path.win32.isAbsolute(filePath);
  const isUnix = path.posix.isAbsolute(filePath);

  let platform = 'unknown';
  if (isWindows) {
    platform = 'win32';
  } else if (isUnix) {
    platform = os.platform() === 'win32' ? 'unix' : 'native';
  }

  return {
    platform,
    isAbsolute: isWindows || isUnix,
    isWindows,
    isUnix,
  };
}

/**
 * 规范化路径为当前平台格式
 * @param {string} filePath - 文件路径
 * @param {string} targetPlatform - 目标平台 (可选)
 * @returns {string} 规范化后的路径
 */
function normalizePath({ filePath, targetPlatform }) {
  const detected = detectPathType({ filePath });
  const target = targetPlatform || getPlatform();

  // 如果路径已经是目标平台的格式，直接返回
  if (detected.platform === target || detected.platform === 'native') {
    return path.normalize(filePath);
  }

  // 将路径转换为目标平台格式
  if (detected.isWindows && target !== 'win32') {
    // Windows -> Unix/Mac
    return filePath.replace(/^([A-Z]):\\/i, '/$1/').replace(/\\/g, '/');
  } else if (detected.isUnix && target === 'win32') {
    // Unix/Mac -> Windows
    return filePath.replace(/^\//, '').replace(/\//g, '\\');
  }

  return path.normalize(filePath);
}

/**
 * 提取路径映射规则
 * @param {Array} files - 文件引用列表
 * @returns {Object} 映射规则 { sourceRoot, targetRoot, mappingType }
 */
function extractMappingRules({ files }) {
  if (!files || files.length === 0) {
    return {
      mappingType: 'none',
    };
  }

  const pathInfo = files.map((f) => detectPathType({ filePath: f.path }));

  const windowsCount = pathInfo.filter((p) => p.isWindows).length;
  const unixCount = pathInfo.filter((p) => p.isUnix).length;

  // 检测是否需要跨平台映射
  if (windowsCount > 0 && unixCount > 0) {
    return {
      mappingType: 'mixed',
      windowsCount,
      unixCount,
    };
  }

  if (windowsCount > 0) {
    return {
      mappingType: 'windows',
      rootPath: extractWindowsRoot({ files }),
    };
  }

  if (unixCount > 0) {
    return {
      mappingType: 'unix',
      rootPath: extractUnixRoot({ files }),
    };
  }

  return {
    mappingType: 'none',
  };
}

/**
 * 提取 Windows 根路径
 * @param {Array} files - 文件引用列表
 * @returns {string} 根路径
 */
function extractWindowsRoot({ files }) {
  const rootPatterns = [];

  for (const file of files) {
    const match = file.path.match(/^([A-Z]):\\/i);
    if (match) {
      const root = match[0];
      if (!rootPatterns.includes(root)) {
        rootPatterns.push(root);
      }
    }
  }

  return rootPatterns.length === 1 ? rootPatterns[0] : null;
}

/**
 * 提取 Unix 根路径
 * @param {Array} files - 文件引用列表
 * @returns {string} 根路径
 */
function extractUnixRoot({ files }) {
  const roots = [];

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const root = `/${parts[0]}/${parts[1]}`;
      if (!roots.includes(root)) {
        roots.push(root);
      }
    }
  }

  return roots.length === 1 ? roots[0] : null;
}

/**
 * 应用路径映射
 * @param {string} originalPath - 原始路径
 * @param {Object} mapping - 映射规则
 * @returns {string} 映射后的路径
 */
function applyPathMapping({ originalPath, mapping }) {
  if (!mapping || mapping.type === 'none') {
    return normalizePath({ filePath: originalPath });
  }

  const normalized = normalizePath({ filePath: originalPath });

  if (mapping.type === 'root' && mapping.sourceRoot && mapping.targetRoot) {
    return normalized.replace(mapping.sourceRoot, mapping.targetRoot);
  }

  if (mapping.type === 'userdir' && mapping.username) {
    const homeDir = os.homedir();
    // 替换用户目录
    const userPattern = new RegExp(`^/Users/${mapping.username}|^/home/${mapping.username}`, 'i');
    return normalized.replace(userPattern, homeDir);
  }

  return normalized;
}

/**
 * 映射所有文件路径
 * @param {Array} files - 文件引用列表
 * @param {Object} mapping - 映射规则
 * @returns {Array} 映射后的文件列表
 */
function mapFilePaths({ files, mapping }) {
  if (!files || files.length === 0) {
    return [];
  }

  return files.map((file) => ({
    ...file,
    originalPath: file.path,
    mappedPath: applyPathMapping({ originalPath: file.path, mapping }),
  }));
}

/**
 * 检测映射策略
 * @param {Object} sourceContext - 源设备上下文
 * @param {Object} targetContext - 目标设备上下文 (当前设备)
 * @returns {Object} 映射策略
 */
function detectMappingStrategy({ sourceContext, targetContext }) {
  const sourcePlatform = sourceContext.device?.platform || 'unknown';
  const targetPlatform = getPlatform();

  // 如果平台相同，不需要映射
  if (sourcePlatform === targetPlatform) {
    return {
      type: 'none',
      reason: 'same platform',
    };
  }

  // 检测用户目录差异
  const sourceUser = extractUsername({ path: sourceContext.projectPath });
  const targetUser = os.userInfo().username;

  if (sourceUser && sourceUser !== targetUser) {
    return {
      type: 'userdir',
      username: sourceUser,
      targetUsername: targetUser,
      reason: 'different user directory',
    };
  }

  // 检测根路径差异
  const sourceRoot = sourceContext.projectPath ? path.dirname(sourceContext.projectPath) : null;
  const targetRoot = targetContext.projectPath ? path.dirname(targetContext.projectPath) : null;

  if (sourceRoot && targetRoot && sourceRoot !== targetRoot) {
    return {
      type: 'root',
      sourceRoot,
      targetRoot,
      reason: 'different project root',
    };
  }

  return {
    type: 'none',
    reason: 'unknown mapping strategy',
  };
}

/**
 * 从路径提取用户名
 * @param {string} filePath - 文件路径
 * @returns {string|null} 用户名
 */
function extractUsername({ filePath }) {
  // Unix/Mac: /Users/username or /home/username
  const unixMatch = filePath.match(/^(?:\/Users|\/home)\/([^\/]+)/);
  if (unixMatch) {
    return unixMatch[1];
  }

  // Windows: C:\Users\username
  const winMatch = filePath.match(/^[A-Z]:\\Users\\([^\\]+)/i);
  if (winMatch) {
    return winMatch[1];
  }

  return null;
}

/**
 * 创建路径映射规则
 * @param {Object} sourceContext - 源设备上下文
 * @param {Object} options - 选项
 * @returns {Object} 映射规则
 */
function createPathMapping({ sourceContext, options = {} }) {
  const strategy = detectMappingStrategy({
    sourceContext,
    targetContext: options.targetContext,
  });

  return {
    strategy,
    rules: {
      type: strategy.type,
      sourceRoot: strategy.sourceRoot,
      targetRoot: strategy.targetRoot,
      username: strategy.username,
      targetUsername: strategy.targetUsername,
    },
  };
}

/**
 * 应用路径映射到会话上下文
 * @param {Object} sessionContext - 会话上下文
 * @param {Object} mapping - 映射规则
 * @returns {Object} 映射后的上下文
 */
function applyMappingToContext({ sessionContext, mapping }) {
  const { projectPath, files, activeFiles, notes } = sessionContext;

  return {
    projectPath: projectPath ? applyPathMapping({ originalPath: projectPath, mapping }) : null,
    files: files ? mapFilePaths({ files, mapping }) : [],
    activeFiles: activeFiles
      ? activeFiles.map((fp) => applyPathMapping({ originalPath: fp, mapping }))
      : [],
    notes,
    originalProjectPath: projectPath,
    mapping,
  };
}

module.exports = {
  getPlatform,
  detectPathType,
  normalizePath,
  extractMappingRules,
  applyPathMapping,
  mapFilePaths,
  detectMappingStrategy,
  createPathMapping,
  applyMappingToContext,
  extractUsername,
};
