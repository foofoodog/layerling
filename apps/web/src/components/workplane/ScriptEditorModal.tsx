"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Code, Play, RefreshCw, X } from "lucide-react";
import { DEFAULT_SCRIPT_SOURCE } from "@/lib/scriptShape";

export function ScriptEditorModal({
  isOpen,
  initialSource,
  error,
  onClose,
  onApply,
}: {
  isOpen: boolean;
  initialSource: string;
  error?: string;
  onClose: () => void;
  onApply: (source: string) => void;
}) {
  const [source, setSource] = useState(initialSource || DEFAULT_SCRIPT_SOURCE);

  useEffect(() => {
    if (isOpen) {
      setSource(initialSource || DEFAULT_SCRIPT_SOURCE);
    }
  }, [isOpen, initialSource]);

  if (!isOpen) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = source.substring(0, start) + "  " + source.substring(end);
      setSource(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onApply(source);
    }
  };

  return (
    <div className="script-editor-backdrop" role="dialog" aria-modal="true" aria-labelledby="script-editor-title">
      <div className="script-editor-modal">
        <div className="script-editor-header">
          <div className="script-editor-title-row">
            <Code className="script-editor-icon" size={20} />
            <h2 id="script-editor-title">Script Shape Editor</h2>
          </div>
          <button
            type="button"
            className="script-editor-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="script-editor-hint">
          Write or paste procedural <strong>brepjs</strong> geometry. Use OpenSCAD Customizer comments
          like <code>// [min:max]</code> to generate inspector sliders automatically.
          Press <strong>Ctrl+Enter</strong> to apply.
        </p>

        {error ? (
          <div className="script-editor-error" role="alert">
            <strong>Build Error:</strong> {error}
          </div>
        ) : null}

        <div className="script-editor-code-container">
          <textarea
            className="script-editor-textarea"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste brepjs code here..."
            spellCheck={false}
            autoFocus
          />
        </div>

        <div className="script-editor-footer">
          <button
            type="button"
            className="script-editor-reset-btn"
            onClick={() => setSource(DEFAULT_SCRIPT_SOURCE)}
            title="Reset code to standard mounting flange template"
          >
            <RefreshCw size={14} />
            <span>Reset Template</span>
          </button>

          <div className="script-editor-actions">
            <button
              type="button"
              className="script-editor-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="script-editor-apply-btn"
              onClick={() => onApply(source)}
            >
              <Play size={14} />
              <span>Apply &amp; Build</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .script-editor-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .script-editor-modal {
          background: #181d24;
          color: #e2e8f0;
          border: 1px solid #2d3748;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          width: 100%;
          max-width: 860px;
          height: 85vh;
          max-height: 800px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .script-editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid #2d3748;
          background: #1f2733;
        }
        .script-editor-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .script-editor-title-row h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #f7fafc;
        }
        .script-editor-icon {
          color: #63b3ed;
        }
        .script-editor-close-btn {
          background: transparent;
          border: none;
          color: #a0aec0;
          cursor: pointer;
          border-radius: 6px;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .script-editor-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }
        .script-editor-hint {
          font-size: 12px;
          color: #a0aec0;
          margin: 0;
          padding: 10px 18px;
          background: #1a202c;
          border-bottom: 1px solid #2d3748;
        }
        .script-editor-hint code {
          background: #2d3748;
          color: #68d391;
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 11px;
        }
        .script-editor-error {
          padding: 10px 18px;
          background: #742a2a;
          color: #fff5f5;
          font-size: 12px;
          font-family: monospace;
          border-bottom: 1px solid #9b2c2c;
          white-space: pre-wrap;
          max-height: 100px;
          overflow-y: auto;
        }
        .script-editor-code-container {
          flex: 1;
          display: flex;
          min-height: 0;
          background: #0f1319;
        }
        .script-editor-textarea {
          flex: 1;
          width: 100%;
          height: 100%;
          background: transparent;
          color: #e2e8f0;
          border: none;
          outline: none;
          padding: 16px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
          line-height: 1.5;
          resize: none;
          tab-size: 2;
        }
        .script-editor-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          border-top: 1px solid #2d3748;
          background: #1f2733;
        }
        .script-editor-reset-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid #4a5568;
          color: #cbd5e0;
          border-radius: 6px;
          padding: 7px 12px;
          font-size: 12px;
          cursor: pointer;
        }
        .script-editor-reset-btn:hover {
          background: #2d3748;
          color: #ffffff;
        }
        .script-editor-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .script-editor-cancel-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #cbd5e0;
          border-radius: 6px;
          padding: 7px 14px;
          font-size: 13px;
          cursor: pointer;
        }
        .script-editor-cancel-btn:hover {
          background: #2d3748;
        }
        .script-editor-apply-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #3182ce;
          border: none;
          color: #ffffff;
          border-radius: 6px;
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .script-editor-apply-btn:hover {
          background: #2b6cb0;
        }
      `}</style>
    </div>
  );
}

