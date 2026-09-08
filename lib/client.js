window.__ModuleLoader__.load({
  id: "dsh-a-upload-plugin",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
const React = require("react");

exports.name = 'dsh-a-upload-plugin-client';
exports.inject = ['slots'];

const h = React.createElement;

/**
 * 附件上传按钮组件
 * 嵌入在 DSH 聊天输入框左下角插槽 (conversation.input.left)。
 */
function UploadButton(props) {
  const { inputActions, useConversation, useWorkspaces, useInput } = props;
  const [statusText, setStatusText] = React.useState('');
  const [isError, setIsError] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  // 1. 订阅当前会话 ID
  const sessionId = typeof useConversation === 'function' ? useConversation((c) => c?.sessionId) : null;

  // 2. 订阅当前工作区列表
  const workspaces = typeof useWorkspaces === 'function' ? useWorkspaces((w) => w?.items) : null;

  // 3. 订阅当前输入框草稿文本
  const currentDraft = typeof useInput === 'function' ? useInput((s) => s?.draft ?? '') : '';

  // 4. 动态解析当前会话归属的工作区物理路径
  const currentWorkspacePath = React.useMemo(() => {
    if (Array.isArray(workspaces) && workspaces.length > 0) {
      if (sessionId) {
        const matched = workspaces.find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(sessionId));
        if (matched && matched.path) return matched.path;
      }
      return workspaces[0]?.path || '';
    }
    return '';
  }, [workspaces, sessionId]);

  // 显示操作反馈气泡
  const showFeedback = (text, error = false) => {
    setStatusText(text);
    setIsError(error);
    setTimeout(() => {
      setStatusText('');
      setIsError(false);
    }, 4000);
  };

  // 读取文件为 Base64
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const commaIndex = result.indexOf(',');
          resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
        } else {
          reject(new Error('读取文件失败'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  // 处理文件选中与上传
  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setStatusText(`正在读取 0/${files.length}...`);
    setIsError(false);
    const uploadedReferences = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusText(`上传中: ${file.name} (${i + 1}/${files.length})`);

        const base64Data = await readFileAsBase64(file);

        const response = await fetch('/api/mobile-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: file.name,
            data: base64Data,
            workspacePath: currentWorkspacePath,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        if (data.ok && data.relativeReference) {
          uploadedReferences.push(data.relativeReference);
        } else {
          throw new Error(data.error || '保存失败');
        }
      }

      // 将上传的文件引用自动追加到当前输入框的末尾
      if (uploadedReferences.length > 0) {
        const mentionTags = uploadedReferences.map((ref) => `@"${ref}"`).join(' ');
        if (inputActions && typeof inputActions.setDraft === 'function') {
          let draft = currentDraft ? currentDraft.trimEnd() : '';
          draft = draft ? `${draft} ${mentionTags} ` : `${mentionTags} `;
          inputActions.setDraft(draft);
        }
        // 剪贴板备份
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(mentionTags).catch(() => {});
        }
        showFeedback(`✅ 已上传 ${uploadedReferences.length} 个文件并引用！`);
      }
    } catch (err) {
      console.error('[dsh-upload] 上传失败:', err);
      showFeedback(`❌ 上传失败: ${err.message || String(err)}`, true);
    } finally {
      setUploading(false);
      e.target.value = ''; // 清空以允许重复选择
    }
  };

  // 经典回形针图标
  const paperclipIcon = h('svg', {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }, h('path', {
    d: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
  }));

  // 上传旋转动画
  const spinnerIcon = h('svg', {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    style: { animation: 'dsh-uploader-spin 1s linear infinite' },
  }, h('circle', {
    cx: 12,
    cy: 12,
    r: 10,
    strokeDasharray: '32',
    strokeDashoffset: '12',
  }));

  return h('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      position: 'relative',
    },
  }, [
    // 将 input 全透明覆盖在按钮上方，解决 Android display:none 导致丢 onChange 事件的问题
    h('div', {
      key: 'upload-container',
      style: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        overflow: 'hidden',
      },
    }, [
      h('input', {
        key: 'native-file-input',
        type: 'file',
        accept: '*/*',
        multiple: true,
        disabled: uploading,
        title: '选择文件（支持 MT管理器、相册、系统文档）',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: uploading ? 'not-allowed' : 'pointer',
          zIndex: 10,
        },
        onChange: handleFileChange,
      }),
      h('button', {
        key: 'upload-visual-button',
        type: 'button',
        disabled: uploading,
        title: '上传附件',
        'aria-label': '上传附件',
        style: {
          background: 'transparent',
          border: 'none',
          padding: '6px 8px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: uploading ? 'var(--dsw-alias-label-tertiary, #999)' : 'var(--dsw-alias-label-secondary, #666)',
          opacity: uploading ? 0.6 : 1,
          transition: 'all 0.2s ease',
          pointerEvents: 'none',
        },
      }, uploading ? spinnerIcon : paperclipIcon),
    ]),

    // 状态反馈气泡
    statusText ? h('div', {
      key: 'status-tooltip',
      style: {
        position: 'absolute',
        bottom: '125%',
        left: 0,
        whiteSpace: 'nowrap',
        backgroundColor: isError ? '#ff4d4f' : 'var(--dsw-specific-input-major, #2c2c2e)',
        color: '#fff',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        zIndex: 100,
        pointerEvents: 'none',
      },
    }, statusText) : null,

    h('style', {
      key: 'spin-style',
    }, '@keyframes dsh-uploader-spin { 100% { transform: rotate(360deg); } }'),
  ]);
}

/**
 * 客户端注册入口
 */
exports.apply = function apply(ctx) {
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register({
      name: 'conversation.input.left',
      id: 'dsh-upload-button',
      order: 10,
    }, UploadButton)
  );
}

    return module.exports;
  }
});
