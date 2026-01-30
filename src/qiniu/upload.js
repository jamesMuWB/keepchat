const fs = require('fs');
const path = require('path');
const qiniu = require('qiniu');
const { createQiniuClient } = require('./client');
const { withRetry } = require('./retry');

const RESUME_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

function createUploadToken(mac, bucket, key) {
  const scope = key ? `${bucket}:${key}` : bucket;
  const putPolicy = new qiniu.rs.PutPolicy({ scope });
  return putPolicy.uploadToken(mac);
}

function uploadFile({ filePath, key, bucket, accessKey, secretKey, region, onProgress }) {
  if (!filePath || !bucket) {
    throw new Error('filePath and bucket are required for upload');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  const resolvedKey = key || path.basename(filePath);
  const { mac, formUploader, resumeUploader } = createQiniuClient({
    accessKey,
    secretKey,
    region,
  });
  const uploadToken = createUploadToken(mac, bucket, resolvedKey);
  const useResume = stats.size >= RESUME_UPLOAD_THRESHOLD_BYTES;

  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        const callback = (err, ret, info) => {
          if (err) {
            err.response = info;
            reject(err);
            return;
          }
          if (info && info.statusCode && info.statusCode !== 200) {
            const error = new Error(`Upload failed with status ${info.statusCode}`);
            error.response = info;
            reject(error);
            return;
          }
          resolve({ key: resolvedKey, response: ret, info });
        };

        if (useResume) {
          const progressCallback = onProgress
            ? (uploadedBytes, totalBytes) => {
                const percent = totalBytes ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
                onProgress({ uploadedBytes, totalBytes, percent });
              }
            : null;
          const putExtra = qiniu.resume_up.PutExtra.create(
            null,
            null,
            null,
            null,
            progressCallback,
          );
          resumeUploader.putFile(uploadToken, resolvedKey, filePath, putExtra, callback);
          return;
        }

        const putExtra = new qiniu.form_up.PutExtra();
        formUploader.putFile(uploadToken, resolvedKey, filePath, putExtra, callback);
      }),
    { retries: 3 },
  );
}

module.exports = {
  uploadFile,
  createUploadToken,
  RESUME_UPLOAD_THRESHOLD_BYTES,
};
