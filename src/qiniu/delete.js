const qiniu = require('qiniu');
const { createQiniuClient } = require('./client');
const { withRetry } = require('./retry');

function deleteFile({ bucket, key, accessKey, secretKey, region }) {
  if (!bucket || !key) {
    throw new Error('bucket and key are required for delete operation');
  }

  const { bucketManager } = createQiniuClient({ accessKey, secretKey, region });
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        bucketManager.delete(bucket, key, (err, respBody, respInfo) => {
          if (err) {
            err.response = respInfo;
            reject(err);
            return;
          }
          resolve({ key, response: respBody, info: respInfo });
        });
      }),
    { retries: 3 },
  );
}

function deleteFiles({ bucket, keys, accessKey, secretKey, region }) {
  if (!bucket || !Array.isArray(keys) || keys.length === 0) {
    throw new Error('bucket and keys are required for batch delete');
  }

  const { bucketManager } = createQiniuClient({ accessKey, secretKey, region });
  const operations = keys.map((key) => qiniu.rs.deleteOp(bucket, key));

  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        bucketManager.batch(operations, (err, respBody, respInfo) => {
          if (err) {
            err.response = respInfo;
            reject(err);
            return;
          }
          resolve({ keys, response: respBody, info: respInfo });
        });
      }),
    { retries: 3 },
  );
}

module.exports = {
  deleteFile,
  deleteFiles,
};
