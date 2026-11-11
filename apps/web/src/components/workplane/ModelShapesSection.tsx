"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, Code2, Layers } from "lucide-react";
import type { ShapeAsset, WorkplaneShape } from "@/types/layerling";
import { displayShapeName } from "@/lib/shapeCatalog";
import { meshForShape } from "@/lib/editorMeshCore";
import { renderMyShapeThumbnail } from "@/lib/myShapeThumbnail";

export interface ModelShapesSectionProps {
  shapes: WorkplaneShape[];
  searchQuery?: string;
  onInsert: (shape: WorkplaneShape) => void;
  onDragDone?: () => void;
}

const thumbnailCache = new Map<string, string>();

function getThumbnailCacheKey(shape: WorkplaneShape): string {
  const meshCount = shape.importedMesh?.positions?.length ?? 0;
  return `${shape.id}:${shape.name || ""}:${shape.color || ""}:${meshCount}:${shape.width}x${shape.depth}x${shape.height}`;
}

function ShapeThumbnail({ shape, isScript }: { shape: WorkplaneShape; isScript: boolean }) {
  const [thumbUrl, setThumbUrl] = useState<string>(() => {
    const key = getThumbnailCacheKey(shape);
    return thumbnailCache.get(key) || "";
  });

  useEffect(() => {
    const key = getThumbnailCacheKey(shape);
    const cached = thumbnailCache.get(key);
    if (cached) {
      setThumbUrl(cached);
      return;
    }

    try {
      const mesh = meshForShape(shape);
      if (mesh && mesh.vertices.length > 0 && mesh.faces.length > 0) {
        const url = renderMyShapeThumbnail(
          [
            {
              vertices: mesh.vertices,
              faces: mesh.faces,
              color: shape.color || "#0088cc",
              hole: shape.hole,
            },
          ],
          96,
        );
        if (url) {
          thumbnailCache.set(key, url);
          setThumbUrl(url);
          return;
        }
      }
    } catch {
      // Fallback to stylized icon
    }
  }, [shape]);

  if (thumbUrl) {
    return (
      <span className="model-shape-thumb-wrap">
        <img className="model-shape-img" src={thumbUrl} alt="" draggable={false} />
        {isScript ? (
          <span className="model-shape-script-badge" title="Parametric Script Shape">
            <Code2 size={10} strokeWidth={2.5} />
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span
      className="model-shape-thumb-wrap model-shape-fallback-thumb"
      style={{ "--fallback-color": shape.color || "#38bdf8" } as CSSProperties}
    >
      {isScript ? (
        <Code2 size={22} className="model-shape-fallback-icon" />
      ) : (
        <Layers size={22} className="model-shape-fallback-icon" />
      )}
      {isScript ? (
        <span className="model-shape-script-badge" title="Parametric Script Shape">
          <Code2 size={10} strokeWidth={2.5} />
        </span>
      ) : null}
    </span>
  );
}

export function countModelShapeMatches(shapes: WorkplaneShape[], query: string): number {
  if (!query || !query.trim()) return 0;
  const q = query.toLowerCase().trim();
  const seen = new Set<string>();
  let count = 0;
  for (const shape of shapes) {
    const key = shape.kind === "script" && shape.scriptSource
      ? `script:${shape.name || ""}:${shape.scriptSource}`
      : `${shape.kind}:${shape.name || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      const name = (shape.name || displayShapeName(shape)).toLowerCase();
      const kind = shape.kind.toLowerCase();
      if (name.includes(q) || kind.includes(q)) {
        count++;
      }
    }
  }
  return count;
}

export function ModelShapesSection({
  shapes,
  searchQuery,
  onInsert,
  onDragDone,
}: ModelShapesSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Group unique shapes by name/source so duplicates in the model don't clutter the picker
  const uniqueShapes = useMemo(() => {
    const list: WorkplaneShape[] = [];
    const seen = new Set<string>();

    for (const shape of shapes) {
      const key = shape.kind === "script" && shape.scriptSource
        ? `script:${shape.name || ""}:${shape.scriptSource}`
        : `${shape.kind}:${shape.name || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(shape);
      }
    }
    return list;
  }, [shapes]);

  const filteredShapes = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return uniqueShapes;
    const q = searchQuery.toLowerCase().trim();
    return uniqueShapes.filter((shape) => {
      const name = (shape.name || displayShapeName(shape)).toLowerCase();
      const kind = shape.kind.toLowerCase();
      return name.includes(q) || kind.includes(q);
    });
  }, [uniqueShapes, searchQuery]);

  if (uniqueShapes.length === 0) return null;
  if (searchQuery && filteredShapes.length === 0) return null;

  return (
    <section className="model-shapes-section" aria-label="Model shapes">
      <div className="model-shapes-header">
        <button
          className="model-shapes-toggle"
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <ChevronRight aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
          <Layers size={15} className="model-shapes-title-icon" />
          <span>Model shapes</span>
          <span className="model-shapes-count">{filteredShapes.length}</span>
        </button>
      </div>

      {!collapsed ? (
        <div className="model-shapes-body">
          <div className="shape-menu-list">
            {filteredShapes.map((shape) => {
              const displayName = shape.name || displayShapeName(shape);
              const isScript = shape.kind === "script" || Boolean(shape.scriptSource);
              const asset: ShapeAsset = {
                id: `model_${shape.id}`,
                name: displayName,
                kind: shape.kind,
                src: "",
                color: shape.color || "#3b82f6",
                hole: shape.hole,
                scriptSource: shape.scriptSource,
                scriptParams: shape.scriptParams,
              };

              return (
                <button
                  key={shape.id}
                  className="shape-menu-item model-shape-item"
                  type="button"
                  draggable
                  title={`${displayName} (${isScript ? "Parametric Script" : shape.kind})`}
                  aria-label={displayName}
                  onClick={() => onInsert(shape)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData("application/x-layerling-shape", JSON.stringify(asset));
                  }}
                  onDragEnd={onDragDone}
                >
                  <ShapeThumbnail shape={shape} isScript={isScript} />
                  <span className="model-shape-name">{displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .model-shapes-section {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 8px;
          padding-bottom: 8px;
        }

        .model-shapes-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px;
        }

        .model-shapes-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: #eee;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
          transition: background 0.12s;
        }

        .model-shapes-toggle:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        :global(.model-shapes-title-icon) {
          color: #3b82f6;
        }

        .model-shapes-count {
          background: rgba(59, 130, 246, 0.2);
          color: #93c5fd;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 10px;
          margin-left: 4px;
        }

        .model-shapes-body {
          padding: 6px 8px 4px;
        }

        :global(.model-shape-item) {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        :global(.model-shape-thumb-wrap) {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 48px;
          height: 48px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        :global(.model-shape-img) {
          display: block;
          width: 44px;
          height: 44px;
          object-fit: contain;
          pointer-events: none;
        }

        :global(.model-shape-fallback-thumb) {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
          border: 1px solid rgba(56, 189, 248, 0.25);
        }

        :global(.model-shape-fallback-icon) {
          color: var(--fallback-color, #38bdf8);
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
        }

        :global(.model-shape-script-badge) {
          position: absolute;
          right: 2px;
          bottom: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          background: #0284c7;
          color: #ffffff;
          border-radius: 3px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
          pointer-events: none;
        }

        .model-shape-name {
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
      `}</style>
    </section>
  );
}
