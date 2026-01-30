const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { createQiniuClient } = require('./client');
const { withRetry } = require('./retry');

function getDownloadUrl({ bucketManager, key, downloadDomain, expiresInSeconds = 3600 }) {
  if (!downloadDomain) {
    throw new Error('Qiniu download domain is required');
  }

  const deadline = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return bucketManager.privateDownloadUrl(downloadDomain, key, deadline);
}

function downloadFile({
  key,
  bucket,
  accessKey,
  secretKey,
  region,
  downloadDomain,
  destinationPath,
  onProgress,
  expiresInSeconds,
  rangeStart,
  rangeEnd,
}) {
  if (!key || !bucket) {
    throw new Error('key and bucket are required for download');
  }

  const { bucketManager } = createQiniuClient({ accessKey, secretKey, region });
  const url = getDownloadUrl({
    bucketManager,
    key,
    downloadDomain,
    expiresInSeconds,
  });
  const client = url.startsWith('https') ? https : http;
  const headers = {};
  if (rangeStart !== undefined && rangeStart !== null) {
    const end = rangeEnd !== undefined && rangeEnd !== null ? rangeEnd : '';
    headers.Range = `bytes=${rangeStart}-${end}`;
  }

  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        const requestOptions = new URL(url);
        requestOptions.headers = headers;

        client
          .get(requestOptions, (res) => {
            if (res.statusCode !== 200) {
              const error = new Error(`Download failed with status ${res.statusCode}`);
              res.resume();
              reject(error);
              return;
            }

            const totalBytes = Number(res.headers['content-length']) || 0;
            let downloadedBytes = 0;

            if (destinationPath) {
              const fileStream = fs.createWriteStream(destinationPath, {
                flags: rangeStart ? 'a' : 'w',
              });
              res.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (onProgress) {
                  const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
                  onProgress({ downloadedBytes, totalBytes, percent });
                }
              });
              res.pipe(fileStream);
              fileStream.on('finish', () => {
                fileStream.close(() =>
                  resolve({
                    key,
                    destinationPath,
                    totalBytes,
                  }),
                );
              });
              fileStream.on('error', (error) => reject(error));
              return;
            }

            const chunks = [];
            res.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              chunks.push(chunk);
              if (onProgress) {
                const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
                onProgress({ downloadedBytes, totalBytes, percent });
              }
            });
            res.on('end', () => {
              resolve({
                key,
                data: Buffer.concat(chunks),
                totalBytes,
              });
            });
          })
          .on('error', (error) => reject(error));
      }),
    { retries: 3 },
  );
}

module.exports = {
  downloadFile,
  getDownloadUrl,
};
