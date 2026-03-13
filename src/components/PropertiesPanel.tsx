import { useMemo, useState } from "react";
import type { Layer, Shape } from "../models";
import { getShapeBounds, translateShape } from "../utils/geometry";

type PropertiesPanelProps = {
  selectedShape: Shape | null;
  selectionCount: number;
  layers: Layer[];
  onUpdateShape: (id: string, updater: (shape: Shape) => Shape) => void;
  onUpdatePotentialShared: (id: string, changes: PotentialSharedChanges) => void;
  onUpdatePotentialNumber: (id: string, nextNumber: number) => void;
  onDeleteSelection: () => void;
  onMoveSelection: (dx: number, dy: number) => void;
  onAlignSelection: (mode: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;
  onRotateSelection: (degrees: number) => void;
  onMirrorSelection: (axis: "horizontal" | "vertical") => void;
  activeLayer: Layer | undefined;
};

type PotentialSharedChanges = {
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  potentialName?: string;
  potentialDiameter?: number | null;
  layerId?: string;
};

export default function PropertiesPanel({
  selectedShape,
  selectionCount,
  layers,
  onUpdateShape,
  onUpdatePotentialShared,
  onUpdatePotentialNumber,
  onDeleteSelection,
  onMoveSelection,
  onAlignSelection,
  onRotateSelection,
  onMirrorSelection,
  activeLayer
}: PropertiesPanelProps) {
  const [moveX, setMoveX] = useState(0);
  const [moveY, setMoveY] = useState(0);
  const lineStyle = selectedShape?.lineStyle ?? "solid";
  const groupOrigin = useMemo(() => {
    if (!selectedShape || selectedShape.type !== "group") return null;
    return getShapeBounds(selectedShape);
  }, [selectedShape]);
  const selectedLayerId = selectedShape?.layerId ?? "";

  function updateLayer(shape: Shape, layerId: string): Shape {
    if (shape.type === "group") {
      return {
        ...shape,
        layerId,
        children: shape.children.map((child) => updateLayer(child, layerId))
      };
    }
    return { ...shape, layerId };
  }

  if (selectionCount === 0) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h3>Properties</h3>
        </header>
        <div className="panel-body">
          <p className="muted">Select an object to edit properties.</p>
          {activeLayer && <p className="muted small">Active layer: {activeLayer.name}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="panel properties-panel">
      <header className="panel-header">
        <h3>Properties</h3>
      </header>
      <div className="panel-body properties-body">
        <button className="tool-button danger" onClick={onDeleteSelection}>Delete</button>
        {selectionCount > 0 && (
          <>
            <div className="align-grid">
              <button className="chip" onClick={() => onRotateSelection(-15)}>Rotate -15°</button>
              <button className="chip" onClick={() => onRotateSelection(15)}>Rotate +15°</button>
              <button className="chip" onClick={() => onMirrorSelection("horizontal")}>Mirror Horizontal</button>
              <button className="chip" onClick={() => onMirrorSelection("vertical")}>Mirror Vertical</button>
            </div>
            {selectionCount > 1 && (
              <div className="align-grid">
                <button className="chip" onClick={() => onAlignSelection("left")}>Align Left</button>
                <button className="chip" onClick={() => onAlignSelection("centerX")}>Align Center X</button>
                <button className="chip" onClick={() => onAlignSelection("right")}>Align Right</button>
                <button className="chip" onClick={() => onAlignSelection("top")}>Align Top</button>
                <button className="chip" onClick={() => onAlignSelection("centerY")}>Align Center Y</button>
                <button className="chip" onClick={() => onAlignSelection("bottom")}>Align Bottom</button>
              </div>
            )}
            <div className="move-grid">
              <label className="row">
                Move X
                <input
                  type="number"
                  value={moveX}
                  onChange={(event) => setMoveX(Number(event.target.value) || 0)}
                />
              </label>
              <label className="row">
                Move Y
                <input
                  type="number"
                  value={moveY}
                  onChange={(event) => setMoveY(Number(event.target.value) || 0)}
                />
              </label>
              <button
                className="tool-button"
                onClick={() => onMoveSelection(moveX, moveY)}
              >
                Apply Move
              </button>
            </div>
          </>
        )}
        {selectedShape && (
          <label className="row">
            Layer
            <select
              value={selectedLayerId}
              onChange={(event) =>
                selectedShape.type === "potential"
                  ? onUpdatePotentialShared(selectedShape.id, { layerId: event.target.value })
                  : onUpdateShape(selectedShape.id, (shape) => updateLayer(shape, event.target.value))
              }
            >
              {layers.map((layer) => (
                <option key={layer.id} value={layer.id}>{layer.name}</option>
              ))}
            </select>
          </label>
        )}
          {selectedShape && selectedShape.type !== "group" && (
            <>
              <label className="row">
                Line
                <input
                  type="color"
                  value={selectedShape.lineColor}
                  onChange={(event) =>
                    selectedShape.type === "potential"
                      ? onUpdatePotentialShared(selectedShape.id, { lineColor: event.target.value })
                      : onUpdateShape(selectedShape.id, (shape) => ({ ...shape, lineColor: event.target.value }))
                  }
                />
              </label>
              <label className="row">
                Line width
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={selectedShape.lineWidth}
                  onChange={(event) =>
                    selectedShape.type === "potential"
                      ? onUpdatePotentialShared(selectedShape.id, { lineWidth: Number(event.target.value) || 1 })
                      : onUpdateShape(selectedShape.id, (shape) => ({ ...shape, lineWidth: Number(event.target.value) || 1 }))
                  }
                />
              </label>
              {(selectedShape.type === "line" ||
                selectedShape.type === "circle" ||
                selectedShape.type === "arc" ||
                selectedShape.type === "potential") && (
                <label className="row">
                  Line style
                  <select
                    value={lineStyle}
                    onChange={(event) =>
                      selectedShape.type === "potential"
                        ? onUpdatePotentialShared(selectedShape.id, {
                          lineStyle: event.target.value as "solid" | "dashed" | "dotted"
                        })
                        : onUpdateShape(selectedShape.id, (shape) => ({
                          ...shape,
                          lineStyle: event.target.value as "solid" | "dashed" | "dotted"
                        }))
                    }
                  >
                    <option value="solid">Continuous</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </label>
              )}
              {selectedShape.type === "potential" && (
                <>
                  <label className="row">
                    Number
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={selectedShape.potentialNumber}
                      onChange={(event) => {
                        const nextNumber = Number(event.target.value);
                        if (!Number.isFinite(nextNumber) || nextNumber < 1) return;
                        onUpdatePotentialNumber(selectedShape.id, nextNumber);
                      }}
                    />
                  </label>
                  <label className="row">
                    Name
                    <input
                      type="text"
                      value={selectedShape.potentialName ?? ""}
                      onChange={(event) =>
                        onUpdatePotentialShared(selectedShape.id, { potentialName: event.target.value })
                      }
                    />
                  </label>
                  <label className="row">
                    Diameter (mm2)
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={selectedShape.potentialDiameter ?? ""}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        const nextDiameter = rawValue === "" ? null : Number(rawValue);
                        onUpdatePotentialShared(selectedShape.id, {
                          potentialDiameter:
                            typeof nextDiameter === "number" && Number.isFinite(nextDiameter)
                              ? nextDiameter
                              : null
                        });
                      }}
                    />
                  </label>
                </>
              )}
              {(selectedShape.type === "line" || selectedShape.type === "potential") && (
                <>
                <label className="row">X1<input type="number" value={selectedShape.x1} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x1: Number(event.target.value) }))
                } /></label>
                <label className="row">Y1<input type="number" value={selectedShape.y1} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y1: Number(event.target.value) }))
                } /></label>
                <label className="row">X2<input type="number" value={selectedShape.x2} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x2: Number(event.target.value) }))
                } /></label>
                <label className="row">Y2<input type="number" value={selectedShape.y2} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y2: Number(event.target.value) }))
                } /></label>
              </>
            )}
            {selectedShape.type === "circle" && (
              <>
                <label className="row">CX<input type="number" value={selectedShape.cx} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cx: Number(event.target.value) }))
                } /></label>
                <label className="row">CY<input type="number" value={selectedShape.cy} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cy: Number(event.target.value) }))
                } /></label>
                <label className="row">R<input type="number" value={selectedShape.r} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, r: Number(event.target.value) }))
                } /></label>
              </>
            )}
            {selectedShape.type === "arc" && (
              <>
                <label className="row">CX<input type="number" value={selectedShape.cx} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cx: Number(event.target.value) }))
                } /></label>
                <label className="row">CY<input type="number" value={selectedShape.cy} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cy: Number(event.target.value) }))
                } /></label>
                <label className="row">R<input type="number" value={selectedShape.r} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, r: Number(event.target.value) }))
                } /></label>
                <label className="row">Start<input type="number" value={selectedShape.startAngle} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, startAngle: Number(event.target.value) }))
                } /></label>
                <label className="row">End<input type="number" value={selectedShape.endAngle} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, endAngle: Number(event.target.value) }))
                } /></label>
              </>
            )}
            {selectedShape.type === "text" && (
              <>
                <label className="row">X<input type="number" value={selectedShape.x} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x: Number(event.target.value) }))
                } /></label>
                <label className="row">Y<input type="number" value={selectedShape.y} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y: Number(event.target.value) }))
                } /></label>
                <label className="row">Text<input type="text" value={selectedShape.text} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, text: event.target.value }))
                } /></label>
                <label className="row">Size<input type="number" value={selectedShape.fontSize} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, fontSize: Number(event.target.value) || 12 }))
                } /></label>
                <label className="row">
                  Link
                  <input
                    type="checkbox"
                    checked={Boolean(selectedShape.linkEnabled)}
                    onChange={(event) =>
                      onUpdateShape(selectedShape.id, (shape) => ({ ...shape, linkEnabled: event.target.checked }))
                    }
                  />
                </label>
                <label className="row">
                  Target
                  <input
                    type="text"
                    value={selectedShape.linkTarget ?? ""}
                    onChange={(event) =>
                      onUpdateShape(selectedShape.id, (shape) => ({ ...shape, linkTarget: event.target.value }))
                    }
                  />
                </label>
              </>
            )}
            {selectedShape.type === "pin" && (
              <>
                <label className="row">Pin X<input type="number" value={selectedShape.x} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x: Number(event.target.value) }))
                } /></label>
                <label className="row">Pin Y<input type="number" value={selectedShape.y} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y: Number(event.target.value) }))
                } /></label>
                <label className="row">Tag<input type="text" value={selectedShape.tag} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tag: event.target.value }))
                } /></label>
                <label className="row">Tag X<input type="number" value={selectedShape.tagX} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tagX: Number(event.target.value) }))
                } /></label>
                <label className="row">Tag Y<input type="number" value={selectedShape.tagY} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tagY: Number(event.target.value) }))
                } /></label>
                <label className="row">Tag size<input type="number" value={selectedShape.tagFontSize} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tagFontSize: Number(event.target.value) || 4 }))
                } /></label>
              </>
            )}
          </>
        )}
        {selectedShape && selectedShape.type === "group" && groupOrigin && (
          <>
            <label className="row">
              Origin X
              <input
                type="number"
                value={groupOrigin.minX}
                onChange={(event) => {
                  const nextX = Number(event.target.value);
                  if (Number.isNaN(nextX)) return;
                  onUpdateShape(selectedShape.id, (shape) =>
                    translateShape(shape, nextX - groupOrigin.minX, 0)
                  );
                }}
              />
            </label>
            <label className="row">
              Origin Y
              <input
                type="number"
                value={groupOrigin.minY}
                onChange={(event) => {
                  const nextY = Number(event.target.value);
                  if (Number.isNaN(nextY)) return;
                  onUpdateShape(selectedShape.id, (shape) =>
                    translateShape(shape, 0, nextY - groupOrigin.minY)
                  );
                }}
              />
            </label>
          </>
        )}
      </div>
    </section>
  );
}
