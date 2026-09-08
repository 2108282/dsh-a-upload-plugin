# DSH 通用附件上传插件 (`dsh-a-upload-plugin`)

专为 **DeepSeek Harness (DSH)** 及安卓端 **DSHA 容器** 设计的文件/相册上传插件。

---

## ✨ 核心特性

- 📱 **多端通用**：无论是在 Android 手机、iPhone、iPad 还是 PC 电脑（Windows / Mac）浏览器中使用 DSH，点击按钮即可直接调用操作系统原生的文件管理器/相册。
- 📂 **动态工作区存储**：智能识别当前会话所属的工作区路径，并将上传的文件统一安全保存至 `[当前工作区]/文件上传/` 目录下（若目录不存在则自动递归创建）。
- 🏷️ **自动插入引用语法**：上传完成后，自动在对话草稿输入框末尾追加形如 `@"文件上传/xxx.png"` 的标准引用标记，无需手动复制路径，直接按回车发送即可让 Agent 读取操作。
- 🛡️ **防重名覆盖**：遇到同名文件时自动进行 `(1)`, `(2)` 递增编号保护，防止误覆盖历史附件。
- 🚀 **免重新打包容器**：完全遵循 DSH 插件规范与 Cordis 架构，既支持本地软链独立调试，也支持通过 GitHub Actions 自动编译并通过系统插件管理器一键安装。

---

## 🛠️ 项目结构

```text
dsh-upload-plugin/
├── .github/
│   └── workflows/
│       └── release.yml     # GitHub Actions 自动化编译打包与发布流水线
├── cordis.patch.yml        # Cordis 插件插入补丁声明
├── package.json            # 包含 dsh.bundle 和 dsh.client 规范声明
├── build.mjs               # 构建打包脚本
├── src/
│   ├── index.js            # 后端 (Host)：注册 /api/mobile-upload 路由并落盘
│   └── client.js           # 前端 (Client)：在 conversation.input.left 注入回形针按钮
└── lib/
    ├── index.js            # 后端运行入口
    └── client.js           # 封装为 DSH ModuleLoader 的前端产物
```

---

## 📦 如何安装到 DSH

### 方式 1：通过 GitHub Release 安装（推荐）

1. 将本项目推送到你的 GitHub 仓库。
2. 推送版本标签（例如 `git tag v1.0.0 && git push origin v1.0.0`），GitHub Actions 会自动编译并生成 `.tar.gz` 预编译包。
3. 在安卓手机容器命令行或 DSH 终端执行：
   ```bash
   python3 /root/.dsh/plugin-manager.py release 你的GitHub用户名 dsh-upload-plugin latest
   ```
4. 刷新 DSH 网页前端即可生效。

### 方式 2：本地软链安装（开发调试）

在容器内部直接安装当前项目：
```bash
# 1. 软链到全局 plugin-src
ln -s /root/工作区/dsh-upload-plugin /root/.dsh/plugin-src/dsh-upload-plugin

# 2. 软链到 web profile 的 node_modules
ln -s /root/.dsh/plugin-src/dsh-upload-plugin /root/.dsh/profiles/web/node_modules/dsh-upload-plugin

# 3. 在 /root/.dsh/profiles/web/package.json 中的 dsh.profile.bundles 数组追加 "dsh-upload-plugin"
# 并在 dependencies 中添加 "dsh-upload-plugin": "link:/root/.dsh/plugin-src/dsh-upload-plugin"
```

---

## 📄 开源许可

[MIT License](LICENSE)
