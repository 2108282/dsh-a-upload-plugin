import * as React from 'react';

export const name = 'dsh-a-upload-plugin-client';
export const inject = ['slots'];

const h = React.createElement;

/**
 * 附件上传按钮组件
 * 嵌入在 DSH 聊天输入框左下角插槽 (conversation.input.left)。
 */
function UploadButton(props) {
  const { inputActions, useConversation, useWorkspaces, useInput } = props;
  const [uploading, setUploading] = React.useState(false);

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

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const references = [];

    // 第一时间将状态反馈填入输入框，确保证明已收到系统选择回调！
    if (inputActions && typeof inputActions.setDraft === 'function') {
      inputActions.setDraft(`[正在读取并上传 ${files.length} 个文件...]`);
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = await file.arrayBuffer();

        const uploadUrl = `/upload-handler?name=${encodeURIComponent(file.name)}&workspace=${encodeURIComponent(currentWorkspacePath)}`;

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: buffer,
        });

        if (!response.ok) {
          const errText = await response.text();
          if (inputActions && typeof inputActions.setDraft === 'function') {
            inputActions.setDraft(`[上传失败: HTTP ${response.status} ${errText}]`);
          }
          return;
        }

        const data = await response.json();
        if (data.ok && data.relativeReference) {
          references.push(data.relativeReference);
        } else {
          if (inputActions && typeof inputActions.setDraft === 'function') {
            inputActions.setDraft(`[上传失败: ${data.error || '未知错误'}]`);
          }
          return;
        }
      }

      if (references.length > 0) {
        const mentionTags = references.map((ref) => `@"${ref}"`).join(' ');
        if (inputActions && typeof inputActions.setDraft === 'function') {
          // 成功填入标准引用标记
          inputActions.setDraft(mentionTags + ' ');
        }
      }
    } catch (err) {
      console.error('[dsh-upload] 上传出错:', err);
      if (inputActions && typeof inputActions.setDraft === 'function') {
        inputActions.setDraft(`[上传出错: ${err.message || String(err)}]`);
      }
    } finally {
      setUploading(false);
      e.target.value = ''; // 允许重复选择相同文件
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

  // 使用标准 HTML5 label 元素包裹 input，确保在移动端点击必定穿透触发，且不被系统丢弃 change 事件
  return h('label', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: uploading ? 'not-allowed' : 'pointer',
      margin: '0 2px',
      padding: '6px 8px',
      borderRadius: '6px',
      color: uploading ? 'var(--dsw-alias-label-tertiary, #999)' : 'var(--dsw-alias-label-secondary, #666)',
      position: 'relative',
    },
    title: '上传附件',
    'aria-label': '上传附件',
  }, [
    h('input', {
      key: 'file-input',
      type: 'file',
      accept: '*/*',
      multiple: true,
      disabled: uploading,
      // 行业标准视觉隐藏方案，确保在 DOM 渲染树上真实存在，绝不被移动端丢弃事件
      style: {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      },
      onChange: handleFileChange,
    }),
    uploading ? spinnerIcon : paperclipIcon,
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
