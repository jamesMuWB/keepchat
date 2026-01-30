const { createQiniuClient } = require('./client');
const { withRetry } = require('./retry');

function getBucketInfo({ bucket, accessKey, secretKey, region }) {
  if (!bucket) {
    throw new Error('bucket is required to query bucket info');
  }

  const { bucketManager } = createQiniuClient({ accessKey, secretKey, region });

  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        bucketManager.getBucketInfo(bucket, (err, respBody, respInfo) => {
          if (err) {
            err.response = respInfo;
            reject(err);
            return;
          }
          resolve(respBody);
        });
      }),
    { retries: 3 },
  );
}

module.exports = {
  getBucketInfo,
};
