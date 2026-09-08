import * as React from 'react';

export const name = 'dsh-a-upload-plugin-client';
export const inject = ['slots'];

const h = React.createElement;

// 抓包日志工具：把前端任何步骤实时发送给后台
function sendDebugLog(type, payload) {
  try {
    fetch('/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, time: Date.now() }),
    }).catch(() => {});
  } catch {}
}

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
    setTimeout(() => setToast(''), 5000);
  };

  const handleInputClick = () => {
    sendDebugLog('INPUT_CLICK', { time: Date.now() });
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    sendDebugLog('INPUT_CHANGE', {
      hasFiles: !!files,
      count: files ? files.length : 0,
      fileNames: files ? Array.from(files).map((f) => ({ name: f.name, size: f.size, type: f.type })) : [],
    });

    if (!files || files.length === 0) {
      showToast('⚠️ 未选择任何文件');
      return;
    }

    setUploading(true);
    showToast(`正在读取与上传 ${files.length} 个文件...`);
    const references = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        sendDebugLog('READ_FILE_START', { name: file.name, size: file.size });

        // 读取为 ArrayBuffer，确保真实流数据有效
        const buffer = await file.arrayBuffer();
        sendDebugLog('READ_FILE_DONE', { name: file.name, byteLength: buffer.byteLength });

        const uploadUrl = `/upload-handler?name=${encodeURIComponent(file.name)}&workspace=${encodeURIComponent(currentWorkspacePath)}`;
        sendDebugLog('FETCH_START', { uploadUrl });

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: buffer,
        });

        sendDebugLog('FETCH_RESPONSE', { status: response.status, ok: response.ok });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        sendDebugLog('FETCH_JSON', data);

        if (data.ok && data.relativeReference) {
          references.push(data.relativeReference);
        } else {
          throw new Error(data.error || '保存失败');
        }
      }

      if (references.length > 0) {
        const mentionTags = references.map((ref) => `@"${ref}"`).join(' ');
        sendDebugLog('SET_DRAFT', { mentionTags });

        if (inputActions && typeof inputActions.setDraft === 'function') {
          let draft = currentDraft ? currentDraft.trimEnd() : '';
          draft = draft ? `${draft} ${mentionTags} ` : `${mentionTags} `;
          inputActions.setDraft(draft);
        }

        showToast(`✅ 已成功上传并引用 ${references.length} 个文件！`);
      }
    } catch (err) {
      console.error('[dsh-upload] 上传失败:', err);
      sendDebugLog('UPLOAD_EXCEPTION', { message: err.message, stack: err.stack });
      showToast(`❌ 上传失败: ${err.message || String(err)}`);
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
      // 原生透明 input 贴在按钮上，用户点击直接触发系统原生文件选择
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
        onClick: handleInputClick,
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
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
        backgroundColor: toast.startsWith('❌') ? '#ff4d4f' : '#10a37f',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 'bold',
        padding: '8px 16px',
        borderRadius: '20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        zIndex: 999999,
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
