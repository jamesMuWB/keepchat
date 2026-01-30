const { createQiniuClient } = require('./client');
const { withRetry } = require('./retry');

function listFiles({ bucket, accessKey, secretKey, region, prefix, marker, limit, delimiter }) {
  if (!bucket) {
    throw new Error('bucket is required for list operation');
  }

  const { bucketManager } = createQiniuClient({ accessKey, secretKey, region });

  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        bucketManager.listPrefix(
          bucket,
          {
            prefix,
            marker,
            limit,
            delimiter,
          },
          (err, respBody, respInfo) => {
            if (err) {
              err.response = respInfo;
              reject(err);
              return;
            }

            resolve({
              items: respBody.items || [],
              marker: respBody.marker || null,
              commonPrefixes: respBody.commonPrefixes || [],
            });
          },
        );
      }),
    { retries: 3 },
  );
}

module.exports = {
  listFiles,
};
