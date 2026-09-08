import fs from 'node:fs';
import path from 'node:path';

export const name = 'dsh-a-upload-plugin';
export const inject = ['webServer'];

/**
 * DSH 附件上传插件 - 后端服务
 * 监听非 /api 路由（避免被 DSH 客户端网关 401 拦截），接收文件并落盘到当前工作区的「文件上传」目录。
 */
export function apply(ctx) {
  const route = {
    kind: 'exact',
    path: '/upload-handler',
    handler: async (req, res) => {
      // 允许跨域与预检
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
        res.end(JSON.stringify({ ok: false, error: '只支持 POST 请求' }));
        return;
      }

      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const rawName = url.searchParams.get('name') || ('upload_' + Date.now());
        const originalName = decodeURIComponent(rawName);
        const rawWs = url.searchParams.get('workspace') || '';
        let workspaceRoot = rawWs ? decodeURIComponent(rawWs) : '';

        // 动态定位当前工作区物理路径
        if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
          workspaceRoot = process.env.DSH_WORKSPACE || process.cwd() || '/root/工作区';
        }

        const targetDir = path.resolve(workspaceRoot, '文件上传');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // 处理同名文件防覆盖编号
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

        // 二进制流直接落盘，免去 Base64 编解码与额外内存消耗
        await new Promise((resolve, reject) => {
          req.pipe(writeStream);
          req.on('error', reject);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({
          ok: true,
          fileName: finalFileName,
          relativeReference: `文件上传/${finalFileName}`,
          absolutePath: finalFilePath,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || '文件落盘失败' }));
      }
    },
  };

  ctx.effect(() => ctx.webServer.register(route), 'dsh-a-upload-plugin: /upload-handler route');
}
