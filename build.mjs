import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGIN_ID = 'dsh-a-upload-plugin';
const srcDir = path.resolve(__dirname, 'src');
const libDir = path.resolve(__dirname, 'lib');

if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

// 1. 构建后端 Host 文件：复制 src/index.js -> lib/index.js
const hostSrc = fs.readFileSync(path.resolve(srcDir, 'index.js'), 'utf8');
fs.writeFileSync(path.resolve(libDir, 'index.js'), hostSrc, 'utf8');
console.log('✅ [Host] 已生成 lib/index.js');

// 2. 构建前端 Client 文件
async function buildClient() {
  const clientSrcPath = path.resolve(srcDir, 'client.js');
  let bundledCode = '';

  // 尝试使用 esbuild 打包（如果环境中安装了）
  let esbuildAvailable = false;
  try {
    const esbuild = await import('esbuild');
    const res = await esbuild.build({
      entryPoints: [clientSrcPath],
      bundle: true,
      format: 'cjs',
      platform: 'browser',
      target: ['chrome100'],
      external: ['react', 'react-dom'],
      minify: false,
      write: false,
    });
    bundledCode = res.outputFiles[0].text;
    esbuildAvailable = true;
    console.log('⚡ [Client] 已使用 esbuild 完成打包');
  } catch (e) {
    // 未安装 esbuild 时的纯 Node 原生可靠转换
    console.log('ℹ️ [Client] esbuild 未就绪，使用纯原生构建转换器...');
    const rawClient = fs.readFileSync(clientSrcPath, 'utf8');
    
    // 移除 import * as React from 'react'
    let cjsCode = rawClient.replace(/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?/g, 'const React = require("react");');
    // 替换 export const name = ... 为 exports.name = ...
    cjsCode = cjsCode.replace(/export\s+const\s+([a-zA-Z0-9_$]+)\s*=/g, 'exports.$1 =');
    // 替换 export function apply 为 exports.apply = function apply
    cjsCode = cjsCode.replace(/export\s+function\s+([a-zA-Z0-9_$]+)/g, 'exports.$1 = function $1');

    bundledCode = cjsCode;
  }

  // 封装进 DSH 官方 ModuleLoader 规范
  const wrappedClient = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundledCode}
    return module.exports;
  }
});
`;

  fs.writeFileSync(path.resolve(libDir, 'client.js'), wrappedClient, 'utf8');
  console.log('✅ [Client] 已生成符合 DSH 规范的 lib/client.js');
}

await buildClient();
console.log('🎉 [Build] 插件构建全部完成！');
