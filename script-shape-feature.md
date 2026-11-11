# Parametric Script Shapes in Layerling

This document provides a comprehensive overview of the **Parametric Script Shape** feature implemented in Layerling, including architectural decisions, user interface integration, interoperability with the [brepjs](https://github.com/foofoodog/brepjs) procedural geometry engine, and guidelines for authoring brepjs scripts that evaluate cleanly in the browser.

---

## 1. Feature Overview

The Parametric Script Shape feature introduces programmable, code-defined 3D shapes to Layerling. Rather than treating imported or pasted procedural models as static triangle meshes, Layerling can now maintain the underlying TypeScript/JavaScript CSG source code, parse user-configurable parameters, expose interactive sliders in the Shape Inspector, and re-evaluate geometry on the fly.

### Key Capabilities

1. **Client-Side B-Rep Sandbox**: Evaluates procedural geometry directly in the browser via `brepjs/quick` without requiring any external backend server or command-line compiler.
2. **OpenSCAD Customizer Syntax**: Detects inline comment annotations (e.g. `// [min:max:step]`) on top-level variable declarations to automatically generate UI controls (sliders, number steppers, checkboxes, and dropdowns).
3. **Two-Way Parameter Synchronization**: Moving a slider in the inspector rewrites the corresponding value in the script source code without disturbing comments or formatting, triggering an instant geometry rebuild.
4. **Interactive Code Editor Modal**: Built-in modal dialog with keyboard shortcuts (`Ctrl+Enter` to apply), real-time compile/runtime error reporting, and parameter re-parsing.
5. **brepjs Playground Interoperability**: Seamless clipboard workflow. Copying geometry in the brepjs playground bundles the source code on the clipboard; Layerling detects this code on paste.
6. **Seamless by Default**: Classic static geometry paste is preserved with zero modal prompts when the feature setting is off (the default). An opt-in advanced setting in **Settings → Appearance** enables the parametric paste workflow.
7. **Model Shapes Library**: A collapsible section above "Custom shapes" in the shape picker displaying all current project shapes with live 3D isometric thumbnails.
8. **Live Demo CI/CD**: Automated GitHub Actions deployment serving a live demo at [layerling.codewarren.com](https://layerling.codewarren.com/) with the companion engine at [brepjs.codewarren.com](https://brepjs.codewarren.com/).

---

## 2. Architecture & Implementation

### 2.1 Data Model (`kind: "script"`)

In [`apps/web/src/types/layerling.ts`](file:///home/mike/code/layerling/apps/web/src/types/layerling.ts), `ShapeKind` was extended with `"script"`. Script shapes carry the following properties on `WorkplaneShape`:
- `scriptSource?: string`: The complete TypeScript/JavaScript source code defining the procedural shape.
- `scriptParams?: ScriptParamDefinition[]`: Parsed parameter metadata (name, type, value, min, max, step, options, label).
- `scriptError?: string | null`: Any compilation or execution error, displayed non-destructively in the UI.

Script shapes are fully serialized into project `.lyl` JSON files ([`lylProject.ts`](file:///home/mike/code/layerling/apps/web/src/lib/lylProject.ts)), enabling complete portability across project save/load cycles.

### 2.2 Execution Sandbox ([`apps/web/src/lib/scriptShape.ts`](file:///home/mike/code/layerling/apps/web/src/lib/scriptShape.ts))

Procedural code executes in an isolated function sandbox. Rather than forcing users to manually import every function, the sandbox dynamically exposes all exported functions and finders from `brepjs`:
- **Solids**: `box`, `cylinder`, `sphere`, `cone`, `torus`, `textSolid`, etc.
- **2D Sketches & Curves**: `rect`, `circle`, `ellipse`, `polygon`, `slot`, `polyline`, `wire`, `bezierCurve`, etc.
- **Boolean Operations**: `fuse`, `fuseAll`, `cut`, `cutAll`, `common`, `intersectAll`.
- **Modifications**: `chamfer`, `fillet`, `offset`, `shell`, `hollow`, `mirror`, `linearArray`, `polarArray`.
- **Transformations**: `translate`, `rotate`, `scale`, `placeOn`, `align`.
- **Selectors & Finders**: `edgeFinder`, `faceFinder`, `parallelTo`, `perpendicularTo`, `atZ`, etc.
- **Interop Helpers**: `unwrap`, `bake`, `toTriangles`.

### 2.3 Parameter Extraction & Code Updating ([`apps/web/src/lib/scriptParams.ts`](file:///home/mike/code/layerling/apps/web/src/lib/scriptParams.ts))

Parameter definitions follow OpenSCAD Customizer conventions:
```typescript
let width = 60;        // [20:120:5] Plate width in millimeters
let boltType = "M4";    // [M3, M4, M5, M6] Mounting fastener size
let countersink = true; // Include 90-degree bevel
```
- **Parsing**: A regular expression scanner extracts top-level `var`, `let`, or `const` declarations accompanied by customizer brackets.
- **Updating**: `updateScriptParamInCode(code, name, value)` uses surgical string replacements targeting only the assigned variable token, keeping comments, whitespace, and formatting intact.

### 2.4 User Interface Integration

- **Shape Inspector** ([`apps/web/src/components/workplane/ShapeInspector.tsx`](file:///home/mike/code/layerling/apps/web/src/components/workplane/ShapeInspector.tsx)):
  When a script shape is selected, the inspector renders live sliders for numeric ranges, dropdown selects for option lists, and checkboxes for booleans, along with an "Edit Script..." button to open the editor.
- **Script Editor Modal** ([`apps/web/src/components/workplane/ScriptEditorModal.tsx`](file:///home/mike/code/layerling/apps/web/src/components/workplane/ScriptEditorModal.tsx)):
  Provides a code editing area with compile-error banners, automatic script title extraction, parameter previews, and quick keyboard execution (`Ctrl+Enter` or `Cmd+Enter`).
- **Script Paste Modal** ([`apps/web/src/components/workplane/ScriptPasteModal.tsx`](file:///home/mike/code/layerling/apps/web/src/components/workplane/ScriptPasteModal.tsx)):
  When enabled in settings, pasting geometry copied from brepjs prompts the user:
  - **Paste as Script Shape**: Keeps procedural code and live sliders.
  - **Paste as Geometry**: Bakes geometry directly to static mesh (classic behavior).
- **Settings Toggle** ([`apps/web/src/components/workplane/WorkspaceSettingsModal.tsx`](file:///home/mike/code/layerling/apps/web/src/components/workplane/WorkspaceSettingsModal.tsx)):
  Located in **Settings (gear icon) → Appearance tab** under *Paste in the middle and drop*:
  `Advanced: Paste procedural code as parametric script shape` (Default: **OFF**).
- **Model Shapes Section** ([`apps/web/src/components/workplane/ModelShapesSection.tsx`](file:///home/mike/code/layerling/apps/web/src/components/workplane/ModelShapesSection.tsx)):
  Appears at the top of the shape picker drawer. Generates 3D isometric thumbnails rendered via `renderMyShapeThumbnail` cached in a memory Map, allowing easy reuse of shapes currently on the workplane.

---

## 3. Requirements for a brepjs Script to Work Properly

To ensure procedural scripts evaluate reliably inside Layerling, author scripts according to the following conventions:

### 3.1 Top-Level Execution and Return Value

1. **The script must produce a 3D Solid or Shape**:
   The script must evaluate to or return a valid brep solid, compound, or meshable shape.
2. **Trailing Expression or Explicit Return**:
   If your code creates a shape at the bottom, ensure it is returned or left as the final expression:
   ```javascript
   // Good: returning the result
   return cutAll(mainBody, [mountingHole1, mountingHole2]);

   // Also good: trailing expression
   cutAll(mainBody, [mountingHole1, mountingHole2]);
   ```
3. **If using a wrapper function, invoke it at the end**:
   When pasting scripts structured as parameterized functions (like `studBrick` or `fanGuard`), always add an invocation at the bottom:
   ```javascript
   function studBrick(studsX, studsY, plateUnits) {
     // ... procedural logic ...
     return result;
   }

   // Required: call the function so the sandbox receives the shape
   studBrick(studsX, studsY, plateUnits);
   ```

### 3.2 Defining Customizer Parameters

Declare all user-facing parameters at the top of the file as `var`, `let`, or `const` declarations with immediate scalar defaults:

```javascript
// Numeric range with min, max, and step
let length = 80;        // [20:150:5] Total length in mm

// Numeric range with default step of 1
let studCount = 4;      // [1:16] Number of studs

// Dropdown enumeration
let headStyle = "hex";  // [hex, socket, button, flat] Fastener head style

// Boolean checkbox toggle
let includeGasket = true; // [true, false] Add sealing lip

// Simple label without range restriction
let partLabel = "CASE"; // Enclosure embossing text
```

#### Syntax Rules:
- Range syntax: `// [min:max:step]` or `// [min:max]`.
- Option syntax: `// [option1, option2, option3]`.
- Everything following the closing bracket `]` becomes the field label in the inspector.
- Avoid dynamic variable initializers for customizer parameters (e.g. `let length = calculateLength();`); use literal scalar values so the inspector can parse and update them safely.

### 3.3 Imports and Dependencies

- **Global Scope**: All functions from `brepjs/quick` are pre-injected into scope. You do not need `import { box, cylinder } from 'brepjs/quick'`.
- **Static Import Statements**: If `import ... from 'brepjs/quick'` or `import ... from 'brepjs'` is included (for instance, when copying directly from the brepjs playground), Layerling automatically strips the import statement before execution so that browser `new Function(...)` does not encounter module syntax errors.

### 3.4 Selectors and Edge/Face Finders

When using topology finders for fillets and chamfers:
```javascript
chamfer(block, 1.0, edgeFinder(block).parallelTo([0, 0, 1]).all());
```
- Ensure the reference shape passed to `edgeFinder(shape)` or `faceFinder(shape)` is the unmodified solid that owns the target edges.
- Ensure the chamfer or fillet radius does not exceed adjacent edge lengths, which would cause an OpenCascade kernel topology exception.

---

## 4. Verification and Test Coverage

The implementation includes comprehensive unit and integration tests:
- **Unit Tests**: [`tests/unit/scriptShape.test.ts`](file:///home/mike/code/layerling/tests/unit/scriptShape.test.ts)
  - Customizer parameter extraction across integers, floats, and dropdown options.
  - Parameter code updating preserving formatting.
  - Title inference from OpenSCAD comments and function declarations.
  - Dynamic evaluation of parametric models including `studBrick` with `edgeFinder`.
  - Model shapes drawer count and search filtering.
- **TypeScript Verification**: Zero errors under `npm run typecheck` (`tsc -p apps/web/tsconfig.json --noEmit`).
- **Production Build**: Clean static export under `npm run export` and production Next.js build.

