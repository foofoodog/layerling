"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Box, Code2, Sparkles, X } from "lucide-react";

export interface ScriptPasteModalProps {
  isOpen: boolean;
  detectedName: string;
  onClose: () => void;
  onPaste: (options: { mode: "script" | "geometry"; name: string }) => void;
}

export function ScriptPasteModal({
  isOpen,
  detectedName,
  onClose,
  onPaste,
}: ScriptPasteModalProps) {
  const [mode, setMode] = useState<"script" | "geometry">("script");
  const [name, setName] = useState(detectedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(detectedName);
      setMode("script");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isOpen, detectedName]);

  if (!isOpen) return null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const finalName = name.trim() || detectedName;
      onPaste({ mode, name: finalName });
    }
  };

  const handleSubmit = () => {
    const finalName = name.trim() || detectedName;
    onPaste({ mode, name: finalName });
  };

  return (
    <div
      className="script-paste-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-paste-title"
      onKeyDown={handleKeyDown}
    >
      <div className="script-paste-modal">
        <div className="script-paste-header">
          <div className="script-paste-title-row">
            <Sparkles className="script-paste-icon" size={20} />
            <h2 id="script-paste-title">Paste Parametric Shape</h2>
          </div>
          <button
            type="button"
            className="script-paste-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="script-paste-intro">
          The clipboard contains a parameterized <strong>brepjs</strong> script model. Choose how you would like to include it in this design:
        </p>

        <div className="script-paste-options" role="radiogroup" aria-label="Paste mode">
          <button
            type="button"
            className={`script-paste-card ${mode === "script" ? "selected" : ""}`}
            onClick={() => setMode("script")}
            role="radio"
            aria-checked={mode === "script"}
          >
            <div className="script-paste-card-header">
              <Code2 className="script-paste-card-icon" size={18} />
              <span className="script-paste-card-title">Editable Script Shape</span>
              <span className="script-paste-badge">Recommended</span>
            </div>
            <p className="script-paste-card-desc">
              Preserves the procedural code and generates interactive parameter controls (sliders, dropdowns, toggles) in the inspector panel.
            </p>
          </button>

          <button
            type="button"
            className={`script-paste-card ${mode === "geometry" ? "selected" : ""}`}
            onClick={() => setMode("geometry")}
            role="radio"
            aria-checked={mode === "geometry"}
          >
            <div className="script-paste-card-header">
              <Box className="script-paste-card-icon" size={18} />
              <span className="script-paste-card-title">Static Geometry</span>
            </div>
            <p className="script-paste-card-desc">
              Pastes as an immutable 3D mesh without script source or customizer sliders.
            </p>
          </button>
        </div>

        <div className="script-paste-name-section">
          <label htmlFor="script-paste-name-input" className="script-paste-label">
            Shape Name
          </label>
          <input
            id="script-paste-name-input"
            ref={inputRef}
            type="text"
            className="script-paste-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shape name"
          />
          <span className="script-paste-hint">
            Confirm or change the name before placing it on the workplane.
          </span>
        </div>

        <div className="script-paste-footer">
          <button
            type="button"
            className="script-paste-cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="script-paste-confirm-btn"
            onClick={handleSubmit}
          >
            {mode === "script" ? "Paste as Script Shape" : "Paste as Geometry"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .script-paste-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .script-paste-modal {
          width: 100%;
          max-width: 520px;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          color: #eee;
          font-family: inherit;
          overflow: hidden;
          animation: modalAppear 0.15s ease-out;
        }

        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .script-paste-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid #2d2d2d;
        }

        .script-paste-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .script-paste-title-row h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #fff;
        }

        :global(.script-paste-icon) {
          color: #3b82f6;
        }

        .script-paste-close-btn {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s, color 0.12s;
        }

        .script-paste-close-btn:hover {
          background: #2a2a2a;
          color: #fff;
        }

        .script-paste-intro {
          padding: 16px 20px 4px;
          margin: 0;
          font-size: 13px;
          color: #aaa;
          line-height: 1.5;
        }

        .script-paste-intro strong {
          color: #ddd;
        }

        .script-paste-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px 20px 16px;
        }

        .script-paste-card {
          background: #262626;
          border: 1.5px solid #363636;
          border-radius: 8px;
          padding: 12px 14px;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          color: inherit;
        }

        .script-paste-card:hover {
          background: #2b2b2b;
          border-color: #4a4a4a;
        }

        .script-paste-card.selected {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.08);
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .script-paste-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        :global(.script-paste-card-icon) {
          color: #3b82f6;
          flex-shrink: 0;
        }

        .script-paste-card-title {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .script-paste-badge {
          margin-left: auto;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          font-size: 10.5px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 10px;
        }

        .script-paste-card-desc {
          margin: 0;
          font-size: 12px;
          color: #999;
          line-height: 1.4;
          padding-left: 26px;
        }

        .script-paste-name-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0 20px 16px;
        }

        .script-paste-label {
          font-size: 12px;
          font-weight: 500;
          color: #bbb;
        }

        .script-paste-input {
          background: #141414;
          border: 1px solid #444;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13.5px;
          color: #fff;
          outline: none;
          transition: border-color 0.15s;
        }

        .script-paste-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .script-paste-hint {
          font-size: 11px;
          color: #777;
        }

        .script-paste-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #2d2d2d;
          background: #181818;
        }

        .script-paste-cancel-btn {
          background: transparent;
          border: 1px solid #444;
          color: #bbb;
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }

        .script-paste-cancel-btn:hover {
          background: #2a2a2a;
          color: #fff;
          border-color: #555;
        }

        .script-paste-confirm-btn {
          background: #2563eb;
          border: 1px solid #3b82f6;
          color: #fff;
          padding: 7px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
        }

        .script-paste-confirm-btn:hover {
          background: #1d4ed8;
          border-color: #2563eb;
        }
      `}</style>
    </div>
  );
}

