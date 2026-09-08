import fs from 'node:fs';
import path from 'node:path';

export const name = 'dsh-a-upload-plugin';
export const inject = ['webServer'];

const DEBUG_LOG_FILE = '/root/upload-debug.log';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(DEBUG_LOG_FILE, line, 'utf8');
  } catch {}
  console.log('[DEBUG-LOG]', msg);
}

export function apply(ctx) {
  // 0. 抓包日志接收端点
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/debug-log',
    handler: async (req, res) => {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json'
      });
      if (req.method === 'OPTIONS') {
        res.end();
        return;
      }
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        log(`[CLIENT] ${data.type || 'LOG'}: ${JSON.stringify(data.payload || data)}`);
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        log(`[CLIENT-ERROR] ${err.message}`);
        res.end(JSON.stringify({ ok: false }));
      }
    }
  }), 'dsh-a-upload-plugin: /debug-log');

  // 1. 上传接口（支持二进制流直传）
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/upload-handler',
    handler: async (req, res) => {
      log(`Incoming /upload-handler ${req.method} ${req.url}`);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        });
        res.end();
        return;
      }

      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: '只支持 POST 方法' }));
        return;
      }

      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const originalName = url.searchParams.get('name') || ('upload_' + Date.now());
        let workspaceRoot = url.searchParams.get('workspace') || '';

        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
          workspaceRoot = process.env.DSH_WORKSPACE || process.cwd() || '/root/工作区';
        }

        const targetDir = path.resolve(workspaceRoot, '文件上传');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext);
        let finalFileName = originalName;
        let count = 1;
        while (fs.existsSync(path.join(targetDir, finalFileName))) {
          finalFileName = `${base} (${count})${ext}`;
          count++;
        }

        const finalFilePath = path.join(targetDir, finalFileName);
        const writeStream = fs.createWriteStream(finalFilePath);

        await new Promise((resolve, reject) => {
          req.pipe(writeStream);
          req.on('error', reject);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        const stat = fs.statSync(finalFilePath);
        log(`Saved file: ${finalFilePath} (size: ${stat.size} bytes)`);

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({
          ok: true,
          fileName: finalFileName,
          relativeReference: `文件上传/${finalFileName}`,
          absolutePath: finalFilePath,
          size: stat.size
        }));
      } catch (err) {
        log(`Save error: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || '文件落盘失败' }));
      }
    }
  }), 'dsh-a-upload-plugin: /upload-handler');
}
