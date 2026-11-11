import { transform } from "sucrase";
import { loadBrepWithOcct } from "@/lib/brepKernel";
import { createLocalId } from "@/lib/localIds";
import { extractScriptParams, updateScriptParam, type ScriptParam, type ScriptParamValue } from "@/lib/scriptParams";
import type { ImportedMesh, WorkplaneShape } from "@/types/layerling";

export const DEFAULT_SCRIPT_SOURCE = `import { cylinder, cutAll, unwrap } from 'brepjs/quick';

// Parametric Mounting Flange
function mountingFlange({
  outerDia = 80,    // [30:200] Outer diameter (mm)
  boreDia = 25,     // [10:100] Center bore diameter (mm)
  flangeThick = 8,  // [3:30] Flange thickness (mm)
  holes = 4,        // [3:12] Number of bolt holes
  boltDia = 6,      // [3:16] Bolt hole diameter (mm)
  boltBcd = 55,     // [20:160] Bolt circle diameter (mm)
} = {}) {
  // Main flange body cylinder
  const body = cylinder(outerDia / 2, flangeThick);

  // Center bore
  const centerHole = cylinder(boreDia / 2, flangeThick + 2, { at: [0, 0, -1] });

  // Bolt holes arrayed around the BCD
  const boltHoles = [];
  for (let i = 0; i < holes; i++) {
    const angle = (i * 2 * Math.PI) / holes;
    const x = (boltBcd / 2) * Math.cos(angle);
    const y = (boltBcd / 2) * Math.sin(angle);
    boltHoles.push(cylinder(boltDia / 2, flangeThick + 2, { at: [x, y, -1] }));
  }

  // Subtract center bore and bolt holes
  return unwrap(cutAll(body, [centerHole, ...boltHoles]));
}

export default mountingFlange();
`;

export function extractScriptTitle(code: string): string | undefined {
  if (!code) return undefined;

  // 1. Look for a comment line directly preceding the main function
  const commentAboveFn = /(?:\/\/\s*(.+?)\r?\n|\/\*\s*(.+?)\s*\*\/)\s*(?:export\s+default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(code);
  if (commentAboveFn) {
    const rawComment = (commentAboveFn[1] || commentAboveFn[2] || "").trim();
    if (rawComment && !/^(?:@|eslint|ts-|prettier)/i.test(rawComment)) {
      const line = rawComment.split("\n")[0].replace(/^[-#*>\s]+/, "").trim();
      if (line.length > 0 && line.length <= 50 && !/[;{}=]/.test(line)) {
        return line;
      }
    }
  }

  // 2. Look for export default functionName() or function functionName
  const fnMatch = /(?:export\s+default\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)|function\s+([A-Za-z0-9_$]+)|export\s+default\s+([A-Za-z0-9_$]+)\s*\()/i.exec(code);
  const name = fnMatch ? (fnMatch[1] || fnMatch[2] || fnMatch[3]) : null;
  if (name && name !== "default" && name !== "anonymous") {
    return name
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  }

  // 3. Fallback: check very first comment line in file if it looks like a title
  const topComment = /^\s*(?:\/\/\s*(.+?)(?:\r?\n|$)|(?:\/\*\s*([\s\S]+?)\s*\*\/))/.exec(code);
  if (topComment) {
    const raw = (topComment[1] || topComment[2] || "").trim();
    if (raw && !/^(?:@|eslint|ts-|import)/i.test(raw)) {
      const line = raw.split("\n")[0].replace(/^[-#*>\s]+/, "").trim();
      if (line.length > 0 && line.length <= 40 && !/[;{}=]/.test(line)) {
        return line;
      }
    }
  }

  return undefined;
}

export interface ScriptEvaluationResult {
  mesh?: ImportedMesh;
  width?: number;
  depth?: number;
  height?: number;
  error?: string;
  source: string;
}

let requestCounter = 0;
const latestRequestForShape = new Map<string, number>();

export function parseScriptParams(code: string): ScriptParam[] {
  try {
    return extractScriptParams(code);
  } catch {
    return [];
  }
}

export async function executeScriptShape(
  code: string,
  paramOverrides?: Record<string, ScriptParamValue>,
): Promise<ScriptEvaluationResult> {
  let source = code || DEFAULT_SCRIPT_SOURCE;

  if (paramOverrides && Object.keys(paramOverrides).length > 0) {
    const params = parseScriptParams(source);
    for (const param of params) {
      if (param.name in paramOverrides) {
        source = updateScriptParam(source, param, paramOverrides[param.name]);
      }
    }
  }

  try {
    const stripped = transform(source, {
      transforms: ["typescript"],
      disableESTransforms: true,
    }).code;

    let cleaned = stripped.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "");
    cleaned = cleaned.replace(/export\s+default\s+/g, "return ");

    const brep = await loadBrepWithOcct();

    // Pass all exported functions, finders, and primitives from brepjs into scope
    const JS_RESERVED = new Set([
      "arguments", "await", "break", "case", "catch", "class", "const", "continue",
      "debugger", "default", "delete", "do", "else", "enum", "eval", "export",
      "extends", "false", "finally", "for", "function", "if", "import", "in",
      "instanceof", "let", "new", "null", "return", "super", "switch", "this",
      "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
    ]);

    const keys: string[] = ["brep"];
    const vals: unknown[] = [brep];

    for (const key of Object.keys(brep)) {
      if (
        /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) &&
        key !== "brep" &&
        !JS_RESERVED.has(key)
      ) {
        keys.push(key);
        vals.push((brep as Record<string, unknown>)[key]);
      }
    }

    const runner = new Function(...keys, `"use strict";\n${cleaned}`);
    const rawResult = runner(...vals);

    const solid = typeof rawResult === "function" ? rawResult(paramOverrides ?? {}) : rawResult;
    if (!solid) {
      throw new Error("Script did not return a 3D solid.");
    }

    const flattenSolids = (val: unknown): unknown[] => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.flatMap(flattenSolids);
      }
      return [val];
    };

    const solidsList = flattenSolids(solid);
    const meshes: { vertices: Float32Array | number[]; triangles: Uint32Array | number[] }[] = [];

    for (const item of solidsList) {
      if (!item) continue;
      const unwrapped = typeof item === "object" && item && "__wrapped" in item ? (item as unknown as { val: unknown }).val : item;
      try {
        const meshed = brep.mesh(unwrapped as Parameters<typeof brep.mesh>[0], { tolerance: 0.1 });
        if (meshed && meshed.vertices.length >= 9 && meshed.triangles.length >= 3) {
          meshes.push(meshed);
        }
      } catch {
        // Skip sub-items that cannot be meshed
      }
    }

    if (meshes.length === 0) {
      throw new Error("Shape produced an empty mesh.");
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    const rawPositions: number[] = [];

    for (const meshed of meshes) {
      const { vertices, triangles } = meshed;
      // Convert from brepjs (Z-up) to Layerling (Y-up): (x, y, z) -> (x, z, -y)
      for (let k = 0; k + 2 < triangles.length; k += 3) {
        for (let c = 0; c < 3; c++) {
          const vi = triangles[k + c] * 3;
          if (vi + 2 >= vertices.length) continue;
          const x = vertices[vi];
          const y = vertices[vi + 2];
          const z = -vertices[vi + 1];
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
          rawPositions.push(x, y, z);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
      }
    }

    if (rawPositions.length === 0) {
      throw new Error("Mesh has no valid vertex coordinates.");
    }

    const width = Math.max(0.1, Number((maxX - minX).toFixed(2)));
    const height = Math.max(0.1, Number((maxY - minY).toFixed(2)));
    const depth = Math.max(0.1, Number((maxZ - minZ).toFixed(2)));
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const localPositions = new Array<number>(rawPositions.length);
    for (let i = 0; i < rawPositions.length; i += 3) {
      localPositions[i] = Number((rawPositions[i] - centerX).toFixed(4));
      localPositions[i + 1] = Number((rawPositions[i + 1] - minY).toFixed(4));
      localPositions[i + 2] = Number((rawPositions[i + 2] - centerZ).toFixed(4));
    }

    const mesh: ImportedMesh = {
      positions: localPositions,
      triangleCount: localPositions.length / 9,
      baseWidth: width,
      baseDepth: depth,
      baseHeight: height,
      sourceFormat: "stl",
      assetId: createLocalId("script-asset").replace(/-/g, ""),
    };

    return {
      mesh,
      width,
      depth,
      height,
      source,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      error: errorMsg,
      source,
    };
  }
}

export function rebuildScriptShapeOffThread(
  shape: WorkplaneShape,
  nextSource: string,
  paramOverrides: Record<string, ScriptParamValue> | undefined,
  apply: (patch: Partial<WorkplaneShape>) => void
) {
  const reqId = ++requestCounter;
  latestRequestForShape.set(shape.id, reqId);

  void executeScriptShape(nextSource, paramOverrides).then((res) => {
    if (latestRequestForShape.get(shape.id) !== reqId) return;
    latestRequestForShape.delete(shape.id);

    if (res.mesh) {
      apply({
        scriptSource: res.source,
        scriptError: undefined,
        scriptParams: paramOverrides ?? shape.scriptParams,
        importedMesh: res.mesh,
        width: res.width ?? shape.width,
        depth: res.depth ?? shape.depth,
        height: res.height ?? shape.height,
        size: Math.max(res.width ?? shape.width, res.depth ?? shape.depth),
      });
    } else if (res.error) {
      apply({
        scriptSource: res.source,
        scriptError: res.error,
      });
    }
  });
}

