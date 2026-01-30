const fs = require('fs');
const os = require('os');
const path = require('path');
describe('compression', () => {
  it('compresses and decompresses buffer', async () => {
    const input = Buffer.from('hello world');
    const compressed = await gzipCompress(input);
    const decompressed = await gzipDecompress(compressed);
    expect(decompressed.toString('utf8')).toBe('hello world');
  });

  it('compresses and decompresses via streams', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepchat-'));
    const sourcePath = path.join(tempDir, 'source.txt');
    const compressedPath = path.join(tempDir, 'source.txt.gz');
    const outputPath = path.join(tempDir, 'output.txt');

    fs.writeFileSync(sourcePath, 'stream data', 'utf8');
    await gzipCompressStream(fs.createReadStream(sourcePath), fs.createWriteStream(compressedPath));
    await gzipDecompressStream(
      fs.createReadStream(compressedPath),
      fs.createWriteStream(outputPath),
    );

    const result = fs.readFileSync(outputPath, 'utf8');
    expect(result).toBe('stream data');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
