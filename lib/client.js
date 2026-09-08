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
  const [uploading, setUploading] = React.useState(false);
  const [toast, setToast] = React.useState('');

  const sessionId = typeof useConversation === 'function' ? useConversation((c) => c?.sessionId) : null;
  const workspaces = typeof useWorkspaces === 'function' ? useWorkspaces((w) => w?.items) : null;
  const currentDraft = typeof useInput === 'function' ? useInput((s) => s?.draft ?? '') : '';

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

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    showToast(`正在上传 ${files.length} 个文件...`);
    const references = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 避开 /api 鉴权，直接二进制流发送给 /upload-handler
        const uploadUrl = `/upload-handler?name=${encodeURIComponent(file.name)}&workspace=${encodeURIComponent(currentWorkspacePath)}`;

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: file,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        if (data.ok && data.relativeReference) {
          references.push(data.relativeReference);
        } else {
          throw new Error(data.error || '保存失败');
        }
      }

      if (references.length > 0) {
        const mentionTags = references.map((ref) => `@"${ref}"`).join(' ');
        if (inputActions && typeof inputActions.setDraft === 'function') {
          let draft = currentDraft ? currentDraft.trimEnd() : '';
          draft = draft ? `${draft} ${mentionTags} ` : `${mentionTags} `;
          inputActions.setDraft(draft);
        }
        showToast(`✅ 已上传并填入输入框！`);
      }
    } catch (err) {
      console.error('[dsh-upload] 上传失败:', err);
      showToast(`❌ 失败: ${err.message || String(err)}`);
    } finally {
      setUploading(false);
      e.target.value = ''; // 允许重复选择同名文件
    }
  };

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

  const spinnerIcon = h('svg', {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    style: { animation: 'dsh-spin 1s linear infinite' },
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
    h('div', {
      key: 'btn-box',
      style: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        overflow: 'hidden',
      },
    }, [
      // 原生透明 input 贴在按钮上，用户点击直接触发系统原生文件选择，绝不丢事件
      h('input', {
        key: 'file-input',
        type: 'file',
        accept: '*/*',
        multiple: true,
        disabled: uploading,
        title: '选择文件上传到当前工作区',
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
        key: 'visual-btn',
        type: 'button',
        disabled: uploading,
        title: '上传附件',
        'aria-label': '上传附件',
        style: {
          background: 'transparent',
          border: 'none',
          padding: '6px 8px',
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

    toast ? h('div', {
      key: 'toast-bubble',
      style: {
        position: 'absolute',
        bottom: '125%',
        left: 0,
        whiteSpace: 'nowrap',
        backgroundColor: toast.startsWith('❌') ? '#ff4d4f' : 'var(--dsw-specific-input-major, #2c2c2e)',
        color: '#fff',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        zIndex: 100,
        pointerEvents: 'none',
      },
    }, toast) : null,

    h('style', {
      key: 'keyframes',
    }, '@keyframes dsh-spin { 100% { transform: rotate(360deg); } }'),
  ]);
}

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
