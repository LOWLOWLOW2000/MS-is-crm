'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  getNeoPointerClips,
  getNeoPointerTemplates,
  NEO_POINTER_CONTENT_CHANGED,
} from '@/lib/neo-pointer-storage';

/** NEOポインタ用スタイル（元HTMLの見た目を再現） */
const NEO_STYLES = `
  .neo-pointer-root {
    --neo-bg: #0a0a0f;
    --neo-surface: #12121a;
    --neo-panel: #1a1a26;
    --neo-border: rgba(120,120,200,0.18);
    --neo-accent: #7c6aff;
    --neo-accent2: #00d4aa;
    --neo-text: #e8e8f0;
    --neo-text-dim: rgba(232,232,240,0.45);
    --neo-glow: rgba(124,106,255,0.25);
  }
  #neo-widget-inner {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transform: scale(0.88) translateY(6px);
    transition: opacity 0.18s ease, transform 0.18s ease;
  }
  #neo-widget-inner.neo-visible {
    opacity: 1;
    transform: scale(1) translateY(0);
    pointer-events: all;
  }
  .neo-body {
    background: rgba(18,18,28,0.97);
    border: 1px solid rgba(124,106,255,0.35);
    border-radius: 12px;
    padding: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px rgba(124,106,255,0.12);
    backdrop-filter: blur(12px);
    position: relative;
  }
  .neo-close-btn {
    position: absolute;
    top: -9px;
    right: -9px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(30,30,44,0.97);
    border: 1.5px solid rgba(180,100,100,0.45);
    color: rgba(255,150,150,0.85);
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
  }
  .neo-close-btn:hover { background: rgba(200,60,60,0.35); border-color: rgba(255,120,120,0.8); transform: scale(1.15); }
  .neo-key {
    width: 46px;
    height: 50px;
    border-radius: 8px;
    border: 1px solid rgba(120,120,200,0.2);
    background: var(--neo-panel);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.12s, border 0.12s, transform 0.1s;
    flex-shrink: 0;
  }
  .neo-key:hover { background: rgba(124,106,255,0.2); border-color: var(--neo-accent); transform: translateY(-2px); }
  .neo-key .num { font-family: ui-monospace, monospace; font-size: 9px; color: var(--neo-accent); line-height: 1; }
  .neo-key .icon { font-size: 18px; line-height: 1; }
  .neo-key .label { font-size: 9px; color: var(--neo-text-dim); line-height: 1; margin-top: 2px; white-space: nowrap; }
  .neo-key.special { background: rgba(124,106,255,0.1); border-color: rgba(124,106,255,0.4); }
  .neo-key.special2 { background: rgba(0,212,170,0.08); border-color: rgba(0,212,170,0.35); }
  .neo-divider { width: 1px; height: 28px; background: var(--neo-border); flex-shrink: 0; }
  .neo-panel {
    position: fixed;
    z-index: 10000;
    background: rgba(18,18,28,0.98);
    border: 1px solid rgba(124,106,255,0.3);
    border-radius: 14px;
    width: 280px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 32px rgba(124,106,255,0.1);
    backdrop-filter: blur(16px);
    overflow: hidden;
    opacity: 0;
    transform: scale(0.9);
    pointer-events: none;
    transition: opacity 0.16s, transform 0.16s;
  }
  .neo-panel.open { opacity: 1; transform: scale(1); pointer-events: all; }
  .neo-panel .panel-header {
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--neo-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .neo-panel .panel-title { font-size: 12px; font-weight: 500; letter-spacing: 0.06em; color: var(--neo-accent); font-family: ui-monospace, monospace; }
  .neo-panel .panel-close {
    width: 20px; height: 20px; border-radius: 50%; background: rgba(255,100,100,0.15); border: 1px solid rgba(255,100,100,0.25);
    display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; color: rgba(255,150,150,0.8);
  }
  .neo-panel .panel-close:hover { background: rgba(255,100,100,0.3); }
  .neo-panel .clipboard-list, .neo-panel .settings-list { max-height: 200px; overflow-y: auto; padding: 8px; }
  .neo-panel .clip-item {
    padding: 8px 12px; border-radius: 8px; font-size: 12px; color: var(--neo-text); cursor: pointer;
    border: 1px solid transparent; transition: background 0.12s, border 0.12s; margin-bottom: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .neo-panel .clip-item:hover { background: rgba(124,106,255,0.12); border-color: rgba(124,106,255,0.25); }
  .neo-panel .clip-item .clip-meta { font-size: 10px; color: var(--neo-text-dim); margin-top: 2px; }
  .neo-panel .setting-row {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--neo-border); margin-bottom: 6px; font-size: 12px;
  }
  .neo-panel .setting-num { font-family: ui-monospace, monospace; font-size: 11px; color: var(--neo-accent); width: 18px; flex-shrink: 0; }
  .neo-panel .setting-name { flex: 1; color: var(--neo-text-dim); }
  .neo-panel .setting-val { font-size: 11px; color: var(--neo-accent2); font-family: ui-monospace, monospace; }
  .neo-toast {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(60px);
    background: rgba(18,18,28,0.97); border: 1px solid var(--neo-accent2); border-radius: 8px;
    padding: 10px 20px; font-size: 12px; color: var(--neo-accent2); font-family: ui-monospace, monospace;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5); transition: transform 0.2s; z-index: 99999; pointer-events: none;
  }
  .neo-toast.neo-show { transform: translateX(-50%) translateY(0); }
`;

const KEYS = [
  { num: 1, icon: '📋', label: 'クリップ', special: true },
  { num: 2, icon: '📝', label: '定型文', special2: true },
  { num: 3, icon: '🌐', label: '翻訳' },
  { num: 4, icon: '✨', label: 'リライト' },
  { num: 5, icon: '😊', label: '絵文字' },
  { divider: true as const },
  { num: 6, icon: '🗓', label: '日時' },
  { num: 7, icon: '⚡', label: 'スニペット' },
  { num: 8, icon: '🔁', label: 'マクロ' },
  { num: 9, icon: '🔍', label: '検索' },
  { divider: true as const },
  { num: 0, icon: '⚙️', label: '設定' },
];

type PanelId = 'clip' | 'tmpl' | 'settings' | null;

export const NeoPointerWidget = () => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [openPanel, setOpenPanel] = useState<PanelId>(null);
  const [toast, setToast] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [clips, setClips] = useState(() => getNeoPointerClips());
  const [templates, setTemplates] = useState(() => getNeoPointerTemplates());
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseOriginRef = useRef({ x: 0, y: 0 });

  const refreshContent = useCallback(() => {
    setClips(getNeoPointerClips());
    setTemplates(getNeoPointerTemplates());
  }, []);

  useEffect(() => {
    refreshContent();
  }, [refreshContent]);

  useEffect(() => {
    const onContentChanged = (): void => refreshContent();
    window.addEventListener(NEO_POINTER_CONTENT_CHANGED, onContentChanged);
    return () => window.removeEventListener(NEO_POINTER_CONTENT_CHANGED, onContentChanged);
  }, [refreshContent]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2000);
  }, []);

  const hideWidget = useCallback(() => {
    setVisible(false);
    setOpenPanel(null);
    activeInputRef.current = null;
  }, []);

  const closePanels = useCallback(() => setOpenPanel(null), []);

  const openPanelById = useCallback((id: PanelId) => {
    setOpenPanel(id);
  }, []);

  const pasteToActive = useCallback(
    (text: string) => {
      const el = activeInputRef.current;
      if (!el) return;
      if (el.tagName === 'TEXTAREA') {
        const ta = el as HTMLTextAreaElement;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        ta.value = before + text + after;
        ta.selectionStart = ta.selectionEnd = before.length + text.length;
      } else {
        (el as HTMLInputElement).value = (el as HTMLInputElement).value + text;
      }
      el.focus();
      closePanels();
      hideWidget();
      showToast('貼り付けました');
    },
    [closePanels, hideWidget, showToast]
  );

  const insertDate = useCallback(() => {
    const now = new Date();
    const str = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    pasteToActive(str);
  }, [pasteToActive]);

  // フォーカス時に .neo-trigger からウィジェット表示
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!target.matches?.('.neo-trigger')) return;
      activeInputRef.current = target as HTMLInputElement | HTMLTextAreaElement;
      const rect = target.getBoundingClientRect();
      let x = rect.left + 10;
      let y = rect.bottom + 8;
      if (y + 80 > window.innerHeight) y = rect.top - 70;
      if (x + 380 > window.innerWidth) x = window.innerWidth - 390;
      setPos({ x, y });
      setVisible(true);
      setOpenPanel(null);
      mouseOriginRef.current = { x: rect.left, y: rect.top };
    };

    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);

  // マウス移動でウィジェットを消す（パネル開いている間は無効）
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!visible || openPanel) return;
      const w = widgetRef.current;
      if (!w) return;
      const rect = w.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const hw = (rect.width / 2) * 1.2;
      const hh = (rect.height / 2) * 1.2;
      const inside =
        e.clientX >= cx - hw && e.clientX <= cx + hw && e.clientY >= cy - hh && e.clientY <= cy + hh;
      if (inside) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      } else {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(hideWidget, 560);
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [visible, openPanel, hideWidget]);

  // 外クリックで閉じる
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!visible) return;
      if (target.closest?.('#neo-widget-inner') || target.closest?.('.neo-panel')) return;
      if (target.closest?.('.neo-trigger')) return;
      hideWidget();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [visible, hideWidget]);

  const handleKeyClick = useCallback(
    (k: (typeof KEYS)[number]) => {
      if ('divider' in k) return;
      if (k.num === 1) openPanelById('clip');
      else if (k.num === 2) openPanelById('tmpl');
      else if (k.num === 0) openPanelById('settings');
      else if (k.num === 6) insertDate();
      else showToast(`${k.label}（デモ）`);
    },
    [openPanelById, insertDate, showToast]
  );

  const panelStyle = (id: PanelId) => {
    if (openPanel !== id) return {};
    const wr = widgetRef.current?.getBoundingClientRect();
    if (!wr) return { left: pos.x, top: pos.y + 60 };
    let px = wr.left;
    let py = wr.bottom + 8;
    if (px + 280 > window.innerWidth - 10) px = window.innerWidth - 290;
    if (py + 300 > window.innerHeight) py = wr.top - 320;
    return { left: px, top: py };
  };

  return (
    <div className="neo-pointer-root">
      <style dangerouslySetInnerHTML={{ __html: NEO_STYLES }} />
      {/* ウィジェット本体 */}
      <div
        id="neo-widget-inner"
        ref={widgetRef}
        className={visible ? 'neo-visible' : ''}
        style={{ left: pos.x, top: pos.y }}
      >
        <div className="neo-body">
          <button
            type="button"
            className="neo-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              hideWidget();
            }}
            title="閉じる"
          >
            ✕
          </button>
          {KEYS.map((k, i) =>
            'divider' in k ? (
              <div key={`d-${i}`} className="neo-divider" />
            ) : (
              <button
                key={k.num}
                type="button"
                className={`neo-key ${k.special ? 'special' : ''} ${k.special2 ? 'special2' : ''}`}
                onClick={() => handleKeyClick(k)}
              >
                <span className="num">{k.num}</span>
                <span className="icon">{k.icon}</span>
                <span className="label">{k.label}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* クリップボードパネル */}
      <div
        className={`neo-panel ${openPanel === 'clip' ? 'open' : ''}`}
        style={panelStyle('clip')}
      >
        <div className="panel-header">
          <span className="panel-title">📋 クリップボード履歴</span>
          <button type="button" className="panel-close" onClick={closePanels}>
            ✕
          </button>
        </div>
        <div className="clipboard-list">
          {clips.map((item, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              className="clip-item"
              onClick={() => pasteToActive(item.text)}
              onKeyDown={(e) => e.key === 'Enter' && pasteToActive(item.text)}
            >
              {item.text}
              <div className="clip-meta">{item.meta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 定型文パネル */}
      <div
        className={`neo-panel ${openPanel === 'tmpl' ? 'open' : ''}`}
        style={{ ...panelStyle('tmpl'), width: 300 }}
      >
        <div className="panel-header">
          <span className="panel-title">📝 定型文</span>
          <button type="button" className="panel-close" onClick={closePanels}>
            ✕
          </button>
        </div>
        <div className="clipboard-list">
          {templates.map((text, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              className="clip-item"
              onClick={() => pasteToActive(text)}
              onKeyDown={(e) => e.key === 'Enter' && pasteToActive(text)}
            >
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* 設定パネル */}
      <div
        className={`neo-panel ${openPanel === 'settings' ? 'open' : ''}`}
        style={{ ...panelStyle('settings'), width: 260 }}
      >
        <div className="panel-header">
          <span className="panel-title">⚙️ ショートカット設定</span>
          <button type="button" className="panel-close" onClick={closePanels}>
            ✕
          </button>
        </div>
        <div className="settings-list">
          {[
            [1, 'クリップボード', '📋'],
            [2, '定型文', '📝'],
            [0, '設定', '⚙️'],
          ].map(([num, name, val]) => (
            <div key={String(num)} className="setting-row">
              <span className="setting-num">{String(num)}</span>
              <span className="setting-name">{name}</span>
              <span className="setting-val">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* トースト */}
      <div className={`neo-toast ${toastShow ? 'neo-show' : ''}`}>{toast}</div>
    </div>
  );
};
