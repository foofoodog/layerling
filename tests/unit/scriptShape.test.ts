import { describe, expect, it } from "vitest";
import { DEFAULT_SCRIPT_SOURCE, executeScriptShape, extractScriptTitle, parseScriptParams } from "@/lib/scriptShape";
import { extractScriptParams, updateScriptParam } from "@/lib/scriptParams";
import { makeScriptShapeAsset, makeShapeFromAsset, toolbarShapeAssets } from "@/lib/shapeCatalog";
import { SHAPE_LIBRARY_SECTIONS } from "@/lib/shapeLibrarySections";
import { countModelShapeMatches } from "@/components/workplane/ModelShapesSection";
import type { WorkplaneShape } from "@/types/layerling";

describe("scriptShape", () => {
  it("parses customizer parameters from the default mounting flange script", () => {
    const params = parseScriptParams(DEFAULT_SCRIPT_SOURCE);
    expect(params.length).toBeGreaterThanOrEqual(6);

    const outerDia = params.find((p) => p.name === "outerDia");
    expect(outerDia).toBeDefined();
    expect(outerDia?.value).toBe(80);
    expect(outerDia?.min).toBe(30);
    expect(outerDia?.max).toBe(200);

    const holes = params.find((p) => p.name === "holes");
    expect(holes).toBeDefined();
    expect(holes?.value).toBe(4);
    expect(holes?.min).toBe(3);
    expect(holes?.max).toBe(12);
  });

  it("updates parameter values in code cleanly", () => {
    const params = extractScriptParams(DEFAULT_SCRIPT_SOURCE);
    const outerDia = params.find((p) => p.name === "outerDia")!;
    const updated = updateScriptParam(DEFAULT_SCRIPT_SOURCE, outerDia, 120);

    const reparsed = extractScriptParams(updated);
    const updatedOuterDia = reparsed.find((p) => p.name === "outerDia");
    expect(updatedOuterDia?.value).toBe(120);
    expect(updated).toContain("outerDia = 120");
  });

  it("extracts script title from comment or function name", () => {
    expect(extractScriptTitle(DEFAULT_SCRIPT_SOURCE)).toBe("Parametric Mounting Flange");

    const codeWithoutComment = `
function cableBracket() {
  return cylinder(10, 5);
}
export default cableBracket();
`;
    expect(extractScriptTitle(codeWithoutComment)).toBe("Cable Bracket");

    const topCommentOnly = `// Hex Standoff Spacer
const body = cylinder(5, 20);
`;
    expect(extractScriptTitle(topCommentOnly)).toBe("Hex Standoff Spacer");
  });

  it("does not include a sample script shape in toolbarShapeAssets or systems library section", () => {
    const asset = toolbarShapeAssets.find((a) => a.kind === "script");
    expect(asset).toBeUndefined();

    const systems = SHAPE_LIBRARY_SECTIONS.find((s) => s.id === "systems");
    expect(systems?.shapes).not.toContain("script");
  });

  it("creates a script shape from asset preserving name, source, and parameters", () => {
    const mockShape: WorkplaneShape = {
      id: "test_1",
      name: "Custom Mounting Flange",
      kind: "script",
      color: "#ff8800",
      x: 0,
      z: 0,
      elevation: 0,
      size: 20,
      width: 80,
      depth: 80,
      height: 8,
      rotation: 0,
      rotationX: 0,
      rotationZ: 0,
      scriptSource: DEFAULT_SCRIPT_SOURCE,
      scriptParams: { outerDia: 90 },
      locked: false,
      hidden: false,
    };

    const asset = makeScriptShapeAsset(mockShape);
    expect(asset.id).toBe("script_test_1");
    expect(asset.name).toBe("Custom Mounting Flange");
    expect(asset.scriptSource).toBe(DEFAULT_SCRIPT_SOURCE);
    expect(asset.scriptParams).toEqual({ outerDia: 90 });

    const newShape = makeShapeFromAsset(asset, { x: 10, z: 20, elevation: 0 });
    expect(newShape.kind).toBe("script");
    expect(newShape.name).toBe("Custom Mounting Flange");
    expect(newShape.scriptSource).toBe(DEFAULT_SCRIPT_SOURCE);
    expect(newShape.scriptParams).toEqual({ outerDia: 90 });
    expect(newShape.x).toBe(10);
    expect(newShape.z).toBe(20);
  });

  it("parses title and customizer parameters from studBrick script", () => {
    const studBrickCode = `import {
  box,
  cylinder,
  fuseAll,
  cutAll,
  chamfer,
  edgeFinder,
  unwrap,
} from 'brepjs/quick';

// Parametric stud brick - every standard size falls out of three numbers.
function studBrick(studsX: number, studsY: number, plateUnits: number) {
  const pitch = 8;
  return box(studsX * pitch, studsY * pitch, plateUnits * 3.2);
}

export default studBrick(2, 4, 3);
`;
    expect(extractScriptTitle(studBrickCode)).toBe("Stud Brick");
    const params = parseScriptParams(studBrickCode);
    expect(params.length).toBe(4);
    expect(params[0].name).toBe("studsX");
    expect(params[0].value).toBe(2);
    expect(params[1].name).toBe("studsY");
    expect(params[1].value).toBe(4);
    expect(params[2].name).toBe("plateUnits");
    expect(params[2].value).toBe(3);
    expect(params[3].name).toBe("pitch");
    expect(params[3].value).toBe(8);
  });

  it("correctly counts matching model shapes for search", () => {
    const shapes: WorkplaneShape[] = [
      { id: "1", name: "Mounting Flange", kind: "script", scriptSource: "code1", color: "#f00", x: 0, z: 0, elevation: 0, size: 20, width: 80, depth: 80, height: 8, rotation: 0, rotationX: 0, rotationZ: 0, locked: false, hidden: false },
      { id: "2", name: "Mounting Flange", kind: "script", scriptSource: "code1", color: "#f00", x: 10, z: 0, elevation: 0, size: 20, width: 80, depth: 80, height: 8, rotation: 0, rotationX: 0, rotationZ: 0, locked: false, hidden: false }, // duplicate
      { id: "3", name: "Base Box", kind: "box", color: "#00f", x: 0, z: 0, elevation: 0, size: 20, width: 20, depth: 20, height: 20, rotation: 0, rotationX: 0, rotationZ: 0, locked: false, hidden: false },
    ];

    expect(countModelShapeMatches(shapes, "flange")).toBe(1);
    expect(countModelShapeMatches(shapes, "box")).toBe(1);
    expect(countModelShapeMatches(shapes, "xyz")).toBe(0);
  });

  it("executes a script returning an array of solids into a single merged mesh", async () => {
    const multiSolidCode = `import { box, translate } from 'brepjs/quick';
function multiPart() {
  const b1 = box(10, 10, 10);
  const b2 = translate(box(10, 10, 10), [20, 0, 0]);
  return [b1, b2];
}
export default multiPart();
`;
    const result = await executeScriptShape(multiSolidCode);
    expect(result.error).toBeUndefined();
    expect(result.mesh).toBeDefined();
    expect(result.mesh?.triangleCount).toBeGreaterThan(0);
    expect(result.width).toBeGreaterThanOrEqual(25);
  });
});

