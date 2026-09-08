import fs from 'node:fs';
import path from 'node:path';

export const name = 'dsh-a-upload-plugin';
export const inject = ['webServer'];

/**
 * DSH 附件上传插件 - 后端服务
 * 负责接收浏览器上传的文件并保存在当前工作区的「文件上传」子目录下。
 */
export function apply(ctx) {
  const route = {
    kind: 'exact',
    path: '/api/mobile-upload',
    handler: async (req, res) => {
      // 允许跨域及 OPTIONS 预检
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
        // 读取 HTTP 请求流
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawPayload = Buffer.concat(chunks).toString('utf8');
        const body = JSON.parse(rawPayload);

        const { name: originalName, data: base64Data, workspacePath: clientWorkspace } = body;

        if (!originalName || !base64Data) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: '缺少文件名 (name) 或 Base64 数据 (data)' }));
          return;
        }

        // 动态定位当前工作区物理路径
        let workspaceRoot = clientWorkspace;
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || !fs.existsSync(workspaceRoot)) {
          workspaceRoot = process.env.DSH_WORKSPACE || process.cwd() || '/root/工作区';
        }

        // 确定保存目录：当前工作区/文件上传
        const targetDir = path.resolve(workspaceRoot, '文件上传');
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // 处理同名文件递增编号（避免覆盖已有同名文件）
        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext);
        let finalFileName = originalName;
        let count = 1;
        while (fs.existsSync(path.join(targetDir, finalFileName))) {
          finalFileName = `${base} (${count})${ext}`;
          count++;
        }

        const finalFilePath = path.join(targetDir, finalFileName);
        const fileBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(finalFilePath, fileBuffer);

        const responseData = {
          ok: true,
          fileName: finalFileName,
          // 相对当前工作区的相对引用标记：文件上传/xxx
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

  // 挂载到 DSH webServer 服务中，销毁时自动移除
  ctx.effect(() => ctx.webServer.register(route), 'dsh-upload-plugin: /api/mobile-upload route');
}
