import fs from 'node:fs';
import path from 'node:path';

export const name = 'dsh-a-upload-plugin';
export const inject = ['webServer'];

/**
 * DSH 附件上传插件 - 后端服务
 */
export function apply(ctx) {
  // 1. 文件上传路由：支持二进制流流式写入与 JSON Base64
  const uploadRoute = {
    kind: 'exact',
    path: '/api/mobile-upload',
    handler: async (req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
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
        const queryName = url.searchParams.get('name');
        const queryWorkspace = url.searchParams.get('workspace');
        const contentType = (req.headers['content-type'] || '').toLowerCase();

        let originalName = queryName ? decodeURIComponent(queryName) : '';
        let workspaceRoot = queryWorkspace ? decodeURIComponent(queryWorkspace) : '';
        let fileBuffer = null;

        if (contentType.includes('application/json')) {
          // JSON Base64 模式
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const rawPayload = Buffer.concat(chunks).toString('utf8');
          const body = JSON.parse(rawPayload);
          originalName = body.name || originalName;
          workspaceRoot = body.workspacePath || workspaceRoot;
          if (body.data) {
            fileBuffer = Buffer.from(body.data, 'base64');
          }
        } else {
          // 二进制流直传模式 (移动端极速、超低内存占用)
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          fileBuffer = Buffer.concat(chunks);
        }

        if (!originalName) {
          originalName = 'upload_' + Date.now();
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: '上传的文件内容为空' }));
          return;
        }

        // 动态定位当前工作区
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || !fs.existsSync(workspaceRoot)) {
          workspaceRoot = process.env.DSH_WORKSPACE || process.cwd() || '/root/工作区';
        }

        const targetDir = path.resolve(workspaceRoot, '文件上传');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // 递增防覆盖
        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext);
        let finalFileName = originalName;
        let count = 1;
        while (fs.existsSync(path.join(targetDir, finalFileName))) {
          finalFileName = `${base} (${count})${ext}`;
          count++;
        }

        const finalFilePath = path.join(targetDir, finalFileName);
        fs.writeFileSync(finalFilePath, fileBuffer);

        const responseData = {
          ok: true,
          fileName: finalFileName,
          relativeReference: `文件上传/${finalFileName}`,
          absolutePath: finalFilePath,
          size: fileBuffer.length
        };

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(responseData));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || '保存文件失败' }));
      }
    }
  };

  // 2. 调起 MT 管理器路由 (通过 DSHA 设备桥 127.0.0.1:3090)
  const launchMtRoute = {
    kind: 'exact',
    path: '/api/launch-mt',
    handler: async (req, res) => {
      try {
        let token = '';
        if (fs.existsSync('/root/.dsh/.bridge_token')) {
          token = fs.readFileSync('/root/.dsh/.bridge_token', 'utf8').trim();
        }

        const bridgeUrl = `http://127.0.0.1:3090/app/launch?pkg=bin.mt.plus&token=${encodeURIComponent(token)}`;
        const bridgeRes = await fetch(bridgeUrl);
        const data = await bridgeRes.json();

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ ok: true, bridgeResult: data }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || '调起 MT 管理器失败' }));
      }
    }
  };

  ctx.effect(() => ctx.webServer.register(uploadRoute), 'dsh-a-upload-plugin: /api/mobile-upload route');
  ctx.effect(() => ctx.webServer.register(launchMtRoute), 'dsh-a-upload-plugin: /api/launch-mt route');
}
