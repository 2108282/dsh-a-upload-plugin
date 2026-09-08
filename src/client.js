import * as React from 'react';

export const name = 'dsh-upload-plugin-client';
export const inject = ['slots'];

const h = React.createElement;

/**
 * 附件上传按钮组件
 * 嵌入在 DSH 聊天输入框左下角插槽 (conversation.input.left)。
 */
function UploadButton(props) {
  const { inputActions, useConversation, useWorkspaces, useInput } = props;
  const fileInputRef = React.useRef(null);
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

  const handleButtonClick = () => {
    if (uploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

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
      reader.onerror = () => reject(reader.error || new Error('文件读取出错'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedReferences = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
          alert(`上传「${file.name}」失败：${data.error || '未知错误'}`);
        }
      }

      // 将上传的文件引用自动追加到当前输入框的末尾
      if (uploadedReferences.length > 0 && inputActions && typeof inputActions.setDraft === 'function') {
        let draft = currentDraft ? currentDraft.trimEnd() : '';
        for (const ref of uploadedReferences) {
          const mentionTag = `@"${ref}"`;
          draft = draft ? `${draft} ${mentionTag}` : mentionTag;
        }
        draft += ' ';
        inputActions.setDraft(draft);
      }
    } catch (err) {
      alert('上传文件出现错误：' + (err.message || String(err)));
    } finally {
      setUploading(false);
      e.target.value = ''; // 允许再次选择相同文件
    }
  };

  // 经典回形针 (Paperclip) 图标
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

  // 上传中的加载动画旋转图标
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
      margin: '0 2px',
      position: 'relative',
    },
  }, [
    h('input', {
      key: 'native-file-input',
      ref: fileInputRef,
      type: 'file',
      multiple: true,
      style: { display: 'none' },
      onChange: handleFileChange,
    }),
    h('button', {
      key: 'upload-trigger-button',
      type: 'button',
      onClick: handleButtonClick,
      disabled: uploading,
      title: uploading ? '正在上传中...' : '上传附件到当前工作区「文件上传」目录',
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
        borderRadius: '6px',
        opacity: uploading ? 0.6 : 1,
        transition: 'all 0.2s ease',
      },
    }, uploading ? spinnerIcon : paperclipIcon),
    h('style', {
      key: 'spin-style',
    }, '@keyframes dsh-uploader-spin { 100% { transform: rotate(360deg); } }'),
  ]);
}

/**
 * 客户端注册入口
 */
export function apply(ctx) {
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register({
      name: 'conversation.input.left',
      id: 'dsh-upload-button',
      order: 10,
    }, UploadButton)
  );
}
