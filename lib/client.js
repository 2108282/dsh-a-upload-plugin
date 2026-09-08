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
 * 附件上传与 MT 管理器快捷入口组件
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

  // 显示临时提示
  const showFeedback = (text, error = false) => {
    setStatusText(text);
    setIsError(error);
    setTimeout(() => {
      setStatusText('');
      setIsError(false);
    }, 4000);
  };

  // 处理文件选中与上传
  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setStatusText(`正在上传 0/${files.length}...`);
    setIsError(false);
    const uploadedReferences = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusText(`上传中: ${file.name} (${i + 1}/${files.length})`);

        // 使用二进制流直传，免去 Base64 编码开销，速度更快，内存更低
        const uploadUrl = `/api/mobile-upload?name=${encodeURIComponent(file.name)}&workspace=${encodeURIComponent(currentWorkspacePath)}`;
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
          uploadedReferences.push(data.relativeReference);
        } else {
          throw new Error(data.error || '保存失败');
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
        showFeedback(`✅ 已成功上传 ${uploadedReferences.length} 个文件并引用！`);
      }
    } catch (err) {
      console.error('[dsh-upload] 上传失败:', err);
      showFeedback(`❌ 上传失败: ${err.message || String(err)}`, true);
    } finally {
      setUploading(false);
      e.target.value = ''; // 清空以允许重复选择
    }
  };

  // 快捷调起 MT 管理器
  const handleLaunchMT = async () => {
    try {
      showFeedback('正在唤起 MT 管理器...');
      const res = await fetch('/api/launch-mt', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showFeedback('已唤起 MT 管理器！');
      } else {
        showFeedback(`唤起失败: ${data.error}`, true);
      }
    } catch (e) {
      showFeedback(`唤起出错: ${e.message}`, true);
    }
  };

  // 回形针图标
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

  // MT 图标
  const mtIcon = h('span', {
    style: {
      fontSize: '11px',
      fontWeight: 'bold',
      lineHeight: '1',
      border: '1.5px solid currentColor',
      borderRadius: '4px',
      padding: '1px 2px',
      letterSpacing: '-0.5px',
    }
  }, 'MT');

  return h('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      position: 'relative',
    },
  }, [
    // 上传按钮（解决 Android display:none 不触发 change 事件的 bug：直接全透明覆盖）
    h('div', {
      key: 'upload-wrapper',
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
        multiple: true,
        disabled: uploading,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: uploading ? 'not-allowed' : 'pointer',
          zIndex: 5,
        },
        onChange: handleFileChange,
      }),
      h('button', {
        key: 'upload-trigger-ui',
        type: 'button',
        disabled: uploading,
        title: '上传附件（点击调用相册/文件选择器）',
        'aria-label': '上传附件',
        style: {
          background: 'transparent',
          border: 'none',
          padding: '6px 7px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: uploading ? 'var(--dsw-alias-label-tertiary, #999)' : 'var(--dsw-alias-label-secondary, #666)',
          opacity: uploading ? 0.6 : 1,
          transition: 'all 0.2s ease',
          pointerEvents: 'none', // 事件由上层的 input 直接接收
        },
      }, uploading ? spinnerIcon : paperclipIcon),
    ]),

    // 快捷呼出 MT 管理器按钮
    h('button', {
      key: 'mt-trigger-button',
      type: 'button',
      onClick: handleLaunchMT,
      title: '直接打开手机上的 MT 管理器',
      'aria-label': '打开 MT 管理器',
      style: {
        background: 'transparent',
        border: 'none',
        padding: '5px 6px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--dsw-alias-label-secondary, #666)',
        borderRadius: '6px',
        opacity: 0.85,
        transition: 'all 0.2s ease',
      },
    }, mtIcon),

    // 状态提示浮条 (避免 alert 在手机端被静默吞掉)
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
