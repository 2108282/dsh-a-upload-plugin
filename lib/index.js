import fs from 'node:fs';
import path from 'node:path';

export const name = 'dsh-a-upload-plugin';
export const inject = ['webServer'];

function getBridgeToken() {
  try {
    if (fs.existsSync('/root/.dsh/.bridge_token')) {
      return fs.readFileSync('/root/.dsh/.bridge_token', 'utf8').trim();
    }
  } catch {}
  return '';
}

function resolveWorkspace(clientPath) {
  if (clientPath && typeof clientPath === 'string' && fs.existsSync(clientPath)) {
    return path.resolve(clientPath);
  }
  return process.env.DSH_WORKSPACE || process.cwd() || '/root/工作区';
}

function copyToUploadDir(srcFilePath, workspaceRoot) {
  const targetDir = path.resolve(workspaceRoot, '文件上传');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const originalName = path.basename(srcFilePath);
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  let finalFileName = originalName;
  let count = 1;
  while (fs.existsSync(path.join(targetDir, finalFileName))) {
    finalFileName = `${base} (${count})${ext}`;
    count++;
  }

  const targetPath = path.join(targetDir, finalFileName);
  fs.copyFileSync(srcFilePath, targetPath);

  return {
    fileName: finalFileName,
    relativeReference: `文件上传/${finalFileName}`,
    absolutePath: targetPath,
  };
}

export function apply(ctx) {
  // 1. 调起手机上的 MT 管理器 (通过 3090 设备桥)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-upload/launch-mt',
    handler: async (req, res) => {
      try {
        const token = getBridgeToken();
        const bridgeUrl = `http://127.0.0.1:3090/app/launch?pkg=bin.mt.plus&token=${encodeURIComponent(token)}`;
        const bridgeRes = await fetch(bridgeUrl);
        const data = await bridgeRes.json();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, result: data }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || '调起 MT 管理器失败' }));
      }
    }
  }), 'dsh-a-upload-plugin: /dsh-upload/launch-mt');

  // 2. 读取手机剪贴板并自动导入文件 (在 MT 管理器复制路径后一键导入)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-upload/clip-import',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const workspaceRoot = resolveWorkspace(url.searchParams.get('workspace'));

        const token = getBridgeToken();
        const bridgeUrl = `http://127.0.0.1:3090/app/clip?token=${encodeURIComponent(token)}`;
        const bridgeRes = await fetch(bridgeUrl);
        const clipData = await bridgeRes.json();
        const clipText = (clipData?.result || '').trim();

        if (!clipText || clipText === '（剪贴板为空）') {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: '手机剪贴板为空，请先在 MT 管理器长按文件 ➔ 复制路径' }));
          return;
        }

        const lines = clipText.split('\n').map((l) => l.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        const imported = [];

        for (const filePath of lines) {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const item = copyToUploadDir(filePath, workspaceRoot);
            imported.push(item);
          }
        }

        if (imported.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: false,
            error: `剪贴板不是有效的手机文件路径：\n"${clipText.slice(0, 80)}"\n提示：在 MT 管理器长按文件 ➔ 属性 ➔ 复制路径`,
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, imported }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || '导入失败' }));
      }
    }
  }), 'dsh-a-upload-plugin: /dsh-upload/clip-import');

  // 3. 手机目录浏览：列出 /sdcard 下的文件夹与文件
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-upload/sdcard-list',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        let currentDir = url.searchParams.get('dir') || '/sdcard';

        currentDir = path.resolve(currentDir);
        if (!currentDir.startsWith('/sdcard') && !currentDir.startsWith('/storage/emulated/0')) {
          currentDir = '/sdcard';
        }

        if (!fs.existsSync(currentDir)) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: '目录不存在: ' + currentDir }));
          return;
        }

        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        const items = [];

        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = path.join(currentDir, entry.name);
          try {
            const isDir = entry.isDirectory();
            const stat = fs.statSync(fullPath);
            items.push({
              name: entry.name,
              fullPath,
              isDir,
              size: isDir ? 0 : stat.size,
              mtime: stat.mtimeMs,
            });
          } catch {}
        }

        items.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name, 'zh-CN');
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          ok: true,
          currentDir,
          parentDir: currentDir === '/sdcard' || currentDir === '/storage/emulated/0' ? null : path.dirname(currentDir),
          items,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }
  }), 'dsh-a-upload-plugin: /dsh-upload/sdcard-list');

  // 4. 批量导入选中的手机文件到当前工作区
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-upload/sdcard-import',
    handler: async (req, res) => {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));

        const { paths: filePaths, workspacePath } = body || {};
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: '请选择要导入的文件' }));
          return;
        }

        const workspaceRoot = resolveWorkspace(workspacePath);
        const imported = [];

        for (const filePath of filePaths) {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const item = copyToUploadDir(filePath, workspaceRoot);
            imported.push(item);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, imported }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || '导入文件出错' }));
      }
    }
  }), 'dsh-a-upload-plugin: /dsh-upload/sdcard-import');
}
