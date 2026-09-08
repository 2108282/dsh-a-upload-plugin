import * as React from 'react';

export const name = 'dsh-a-upload-plugin-client';
export const inject = ['slots'];

const h = React.createElement;

const QUICK_DIRS = [
  { label: '📥 下载 (Download)', path: '/sdcard/Download' },
  { label: '📷 相册 (DCIM)', path: '/sdcard/DCIM' },
  { label: '📁 MT2 文件夹', path: '/sdcard/MT2' },
  { label: '📄 文档 (Documents)', path: '/sdcard/Documents' },
  { label: '🖼️ 图片 (Pictures)', path: '/sdcard/Pictures' },
];

function FilePickerModal(props) {
  const { open, onClose, currentWorkspacePath, onImportSuccess } = props;
  const [currentDir, setCurrentDir] = React.useState('/sdcard/Download');
  const [parentDir, setParentDir] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedPaths, setSelectedPaths] = React.useState([]);
  const [actionMsg, setActionMsg] = React.useState('');

  const loadDirectory = async (dir) => {
    setLoading(true);
    setActionMsg('');
    try {
      const res = await fetch(`/dsh-upload/sdcard-list?dir=${encodeURIComponent(dir)}`);
      const data = await res.json();
      if (data.ok) {
        setCurrentDir(data.currentDir);
        setParentDir(data.parentDir);
        setItems(data.items || []);
        setSelectedPaths([]);
      } else {
        setActionMsg(`❌ 加载失败: ${data.error}`);
      }
    } catch (e) {
      setActionMsg(`❌ 网络错误: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open) {
      loadDirectory(currentDir);
    }
  }, [open]);

  if (!open) return null;

  const toggleSelect = (fullPath) => {
    setSelectedPaths((prev) =>
      prev.includes(fullPath) ? prev.filter((p) => p !== fullPath) : [...prev, fullPath]
    );
  };

  // 1. 调起真机 MT 管理器
  const handleLaunchMT = async () => {
    try {
      setActionMsg('正在调起 MT 管理器...');
      const res = await fetch('/dsh-upload/launch-mt');
      const data = await res.json();
      if (data.ok) {
        setActionMsg('✅ 已打开 MT 管理器！在 MT 中长按文件 ➔ 属性 ➔ 复制路径，切回后点【从剪贴板粘贴路径】');
      } else {
        setActionMsg(`❌ 调起失败: ${data.error}`);
      }
    } catch (e) {
      setActionMsg(`❌ 调起失败: ${e.message}`);
    }
  };

  // 2. 从剪贴板导入
  const handleClipImport = async () => {
    try {
      setActionMsg('正在读取剪贴板文件路径...');
      const res = await fetch(`/dsh-upload/clip-import?workspace=${encodeURIComponent(currentWorkspacePath)}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.imported)) {
        onImportSuccess(data.imported.map((i) => i.relativeReference));
        onClose();
      } else {
        setActionMsg(`❌ 导入失败: ${data.error}`);
      }
    } catch (e) {
      setActionMsg(`❌ 读取错误: ${e.message}`);
    }
  };

  // 3. 导入选中的文件
  const handleImportSelected = async () => {
    if (selectedPaths.length === 0) return;
    try {
      setActionMsg(`正在复制导入 ${selectedPaths.length} 个文件...`);
      const res = await fetch('/dsh-upload/sdcard-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: selectedPaths,
          workspacePath: currentWorkspacePath,
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.imported)) {
        onImportSuccess(data.imported.map((i) => i.relativeReference));
        onClose();
      } else {
        setActionMsg(`❌ 导入出错: ${data.error}`);
      }
    } catch (e) {
      setActionMsg(`❌ 请求错误: ${e.message}`);
    }
  };

  return h('div', {
    style: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
    },
    onClick: onClose,
  }, [
    h('div', {
      key: 'modal-content',
      style: {
        backgroundColor: 'var(--dsw-alias-panel-bg, #1c1c1e)',
        color: 'var(--dsw-alias-label-primary, #fff)',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '540px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid var(--dsw-alias-border-l2, #3a3a3c)',
        overflow: 'hidden',
      },
      onClick: (e) => e.stopPropagation(),
    }, [
      // 头部
      h('div', {
        key: 'header',
        style: {
          padding: '12px 16px',
          borderBottom: '1px solid var(--dsw-alias-border-l2, #3a3a3c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      }, [
        h('strong', { style: { fontSize: '16px' } }, '📱 手机文件选择与 MT 管理器'),
        h('button', {
          type: 'button',
          onClick: onClose,
          style: {
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            fontSize: '18px',
            cursor: 'pointer',
          },
        }, '✕'),
      ]),

      // 快捷工具栏 (打开 MT、从剪贴板粘贴)
      h('div', {
        key: 'actions-bar',
        style: {
          padding: '10px 12px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--dsw-alias-border-l2, #3a3a3c)',
          flexWrap: 'wrap',
        },
      }, [
        h('button', {
          type: 'button',
          onClick: handleLaunchMT,
          style: {
            padding: '7px 12px',
            backgroundColor: '#007aff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
          },
        }, '🚀 打开 MT 管理器'),
        h('button', {
          type: 'button',
          onClick: handleClipImport,
          style: {
            padding: '7px 12px',
            backgroundColor: 'var(--dsw-alias-interactive-bg, #3a3a3c)',
            color: 'inherit',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
          },
        }, '📋 从剪贴板粘贴路径'),
      ]),

      // 快捷书签目录
      h('div', {
        key: 'bookmarks',
        style: {
          padding: '8px 12px',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid var(--dsw-alias-border-l2, #3a3a3c)',
          fontSize: '12px',
        },
      }, QUICK_DIRS.map((d) =>
        h('button', {
          key: d.path,
          type: 'button',
          onClick: () => loadDirectory(d.path),
          style: {
            padding: '4px 10px',
            backgroundColor: currentDir === d.path ? '#007aff' : 'transparent',
            color: currentDir === d.path ? '#fff' : 'var(--dsw-alias-label-secondary, #aaa)',
            border: '1px solid var(--dsw-alias-border-l2, #3a3a3c)',
            borderRadius: '14px',
            cursor: 'pointer',
          },
        }, d.label)
      )),

      // 路径条与上一级按钮
      h('div', {
        key: 'path-bar',
        style: {
          padding: '6px 12px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(0,0,0,0.2)',
          color: 'var(--dsw-alias-label-secondary, #aaa)',
        },
      }, [
        parentDir ? h('button', {
          type: 'button',
          onClick: () => loadDirectory(parentDir),
          style: {
            padding: '2px 8px',
            background: 'var(--dsw-alias-interactive-bg, #3a3a3c)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          },
        }, '⬅ 上一级') : null,
        h('span', { style: { wordBreak: 'break-all', flex: 1 } }, currentDir),
      ]),

      // 提示状态条
      actionMsg ? h('div', {
        key: 'msg',
        style: {
          padding: '6px 12px',
          backgroundColor: '#ff9500',
          color: '#000',
          fontSize: '12px',
          fontWeight: 'bold',
        },
      }, actionMsg) : null,

      // 文件列表
      h('div', {
        key: 'list',
        style: {
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
          minHeight: '220px',
        },
      }, loading ? h('div', { style: { padding: '24px', textAlign: 'center' } }, '正在读取目录...') : items.length === 0 ? h('div', { style: { padding: '24px', textAlign: 'center', color: '#888' } }, '该目录下暂无文件') : items.map((item) =>
        h('div', {
          key: item.fullPath,
          onClick: () => (item.isDir ? loadDirectory(item.fullPath) : toggleSelect(item.fullPath)),
          style: {
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            backgroundColor: selectedPaths.includes(item.fullPath) ? 'rgba(0, 122, 255, 0.25)' : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          },
        }, [
          item.isDir ? null : h('input', {
            type: 'checkbox',
            checked: selectedPaths.includes(item.fullPath),
            onChange: () => toggleSelect(item.fullPath),
            style: { cursor: 'pointer' },
          }),
          h('span', { style: { fontSize: '18px' } }, item.isDir ? '📁' : '📄'),
          h('div', { style: { flex: 1, overflow: 'hidden' } }, [
            h('div', { style: { fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' } }, item.name),
            item.isDir ? null : h('div', { style: { fontSize: '11px', color: '#888' } }, `${(item.size / 1024).toFixed(1)} KB`),
          ]),
        ])
      )),

      // 底部操作区
      h('div', {
        key: 'footer',
        style: {
          padding: '10px 16px',
          borderTop: '1px solid var(--dsw-alias-border-l2, #3a3a3c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0,0,0,0.1)',
        },
      }, [
        h('span', { style: { fontSize: '12px', color: '#aaa' } }, `已选 ${selectedPaths.length} 个文件`),
        h('div', { style: { display: 'flex', gap: '8px' } }, [
          h('button', {
            type: 'button',
            onClick: onClose,
            style: {
              padding: '6px 14px',
              background: 'transparent',
              border: '1px solid var(--dsw-alias-border-l2, #3a3a3c)',
              color: 'inherit',
              borderRadius: '6px',
              cursor: 'pointer',
            },
          }, '取消'),
          h('button', {
            type: 'button',
            onClick: handleImportSelected,
            disabled: selectedPaths.length === 0,
            style: {
              padding: '6px 16px',
              backgroundColor: selectedPaths.length === 0 ? '#444' : '#34c759',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: selectedPaths.length === 0 ? 'not-allowed' : 'pointer',
            },
          }, '确定导入到工作区'),
        ]),
      ]),
    ]),
  ]);
}

function UploadButton(props) {
  const { inputActions, useConversation, useWorkspaces, useInput } = props;
  const [modalOpen, setModalOpen] = React.useState(false);
  const [statusText, setStatusText] = React.useState('');

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

  const handleImportSuccess = (references) => {
    if (!references || references.length === 0) return;
    const mentionTags = references.map((ref) => `@"${ref}"`).join(' ');
    if (inputActions && typeof inputActions.setDraft === 'function') {
      let draft = currentDraft ? currentDraft.trimEnd() : '';
      draft = draft ? `${draft} ${mentionTags} ` : `${mentionTags} `;
      inputActions.setDraft(draft);
    }
    setStatusText(`✅ 成功导入 ${references.length} 个文件！`);
    setTimeout(() => setStatusText(''), 4000);
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

  return h('div', {
    style: { display: 'inline-flex', alignItems: 'center', position: 'relative' },
  }, [
    h('button', {
      key: 'trigger-btn',
      type: 'button',
      onClick: () => setModalOpen(true),
      title: '选择手机文件 / MT管理器导入',
      'aria-label': '选择手机文件',
      style: {
        background: 'transparent',
        border: 'none',
        padding: '6px 8px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--dsw-alias-label-secondary, #666)',
        borderRadius: '6px',
        transition: 'all 0.2s ease',
      },
    }, paperclipIcon),

    statusText ? h('div', {
      key: 'toast',
      style: {
        position: 'absolute',
        bottom: '125%',
        left: 0,
        whiteSpace: 'nowrap',
        backgroundColor: '#34c759',
        color: '#fff',
        fontSize: '12px',
        padding: '4px 8px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        zIndex: 100,
        pointerEvents: 'none',
      },
    }, statusText) : null,

    h(FilePickerModal, {
      key: 'modal',
      open: modalOpen,
      onClose: () => setModalOpen(false),
      currentWorkspacePath,
      onImportSuccess: handleImportSuccess,
    }),
  ]);
}

export function apply(ctx) {
  ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register({
      name: 'conversation.input.left',
      id: 'dsh-upload-button',
      order: 10,
    }, UploadButton)
  );
}
