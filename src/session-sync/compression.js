const zlib = require('zlib');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

function gzipCompress(data) {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

function gzipDecompress(data) {
  return new Promise((resolve, reject) => {
    zlib.gunzip(data, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

function createGzipStream() {
  return zlib.createGzip();
}

function createGunzipStream() {
  return zlib.createGunzip();
}

async function gzipCompressStream(readable, writable) {
  await pipelineAsync(readable, createGzipStream(), writable);
}

async function gzipDecompressStream(readable, writable) {
  await pipelineAsync(readable, createGunzipStream(), writable);
}

module.exports = {
  gzipCompress,
  gzipDecompress,
  createGzipStream,
  createGunzipStream,
  gzipCompressStream,
  gzipDecompressStream,
};
