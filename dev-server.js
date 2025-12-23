import { createServer } from 'https';
import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// 读取 SSL 证书
const sslOptions = {
  key: readFileSync(join(__dirname, 'server.key')),
  cert: readFileSync(join(__dirname, 'server.cert'))
};

const mimeTypes = {
  '.mjs': 'application/javascript',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.css': 'text/css'
};

const server = createServer(sslOptions, async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    let filePath = req.url === '/' ? '/dist/plugin.mjs' : req.url;
    const fullPath = join(__dirname, filePath);

    const content = await readFile(fullPath, 'utf-8');
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);

    console.log(`✓ ${req.method} ${req.url} - 200`);
  } catch (error) {
    res.writeHead(404);
    res.end('File not found');
    console.log(`✗ ${req.method} ${req.url} - 404`);
  }
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🚀 HTTPS 开发服务器已启动！`);
  console.log(`\n📍 访问地址:`);
  console.log(`   https://localhost:${PORT}/dist/plugin.mjs`);

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // 获取本机 IP 地址
    const { stdout } = await execAsync("ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1");
    const ip = stdout.trim();

    if (ip) {
      console.log(`   https://${ip}:${PORT}/dist/plugin.mjs`);
    }
  } catch (error) {
    console.log(`   https://<your-ip>:${PORT}/dist/plugin.mjs`);
  }

  console.log(`\n✨ CORS 已启用，支持跨域访问`);
  console.log(`\n⚠️  使用自签名证书，浏览器会显示安全警告`);
  console.log(`   首次访问时需要点击"高级"→"继续访问"信任证书`);
  console.log(`\n按 Ctrl+C 停止服务器\n`);
});

