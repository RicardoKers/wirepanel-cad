import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentInstance, Layer, Shape } from "../models";
import { getShapeBounds, translateShape } from "../utils/geometry";

type PropertiesPanelProps = {
  selectedShape: Shape | null;
  selectionCount: number;
  selectedComponentInstance: ComponentInstance | null;
  componentParentOptions: ComponentParentOption[];
  onUpdateComponentInstance: (componentId: string, updater: (instance: ComponentInstance) => ComponentInstance) => void;
  layers: Layer[];
  onUpdateShape: (id: string, updater: (shape: Shape) => Shape) => void;
  onUpdatePotentialShared: (id: string, changes: PotentialSharedChanges) => void;
  onUpdatePotentialNumber: (id: string, nextNumber: number) => void;
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

type ComponentParentOption = {
  componentId: string;
  tag: string;
  type: string;
  partOfId?: string;
};

export default function PropertiesPanel({
  selectedShape,
  selectionCount,
  selectedComponentInstance,
  componentParentOptions,
  onUpdateComponentInstance,
  layers,
  onUpdateShape,
  onUpdatePotentialShared,
  onUpdatePotentialNumber,
  activeLayer
}: PropertiesPanelProps) {
  const { t } = useTranslation();
  const lineStyle = selectedShape?.lineStyle ?? "solid";
  const groupOrigin = useMemo(() => {
    if (!selectedShape || selectedShape.type !== "group") return null;
    return getShapeBounds(selectedShape);
  }, [selectedShape]);
  const selectedLayerId = selectedShape?.layerId ?? "";
  const selectedComponentTag = selectedComponentInstance
    ? `${selectedComponentInstance.tagPrefix}${selectedComponentInstance.tagNumber}`
    : "";

  function updateSelectedComponent(updater: (instance: ComponentInstance) => ComponentInstance) {
    if (!selectedComponentInstance) return;
    onUpdateComponentInstance(selectedComponentInstance.componentId, updater);
  }

  function getPartsDisplayWithDefaults(instance: ComponentInstance): NonNullable<ComponentInstance["partsDisplay"]> {
    return {
      show: instance.partsDisplay?.show ?? false,
      position: instance.partsDisplay?.position ?? "below",
      rotation: instance.partsDisplay?.rotation ?? 0,
      spacing: instance.partsDisplay?.spacing ?? 5,
      offset: instance.partsDisplay?.offset ?? 5,
      scale: instance.partsDisplay?.scale ?? 1,
      addressOffsetX: instance.partsDisplay?.addressOffsetX ?? 6,
      addressOffsetY: instance.partsDisplay?.addressOffsetY ?? 0,
      addressRotation: instance.partsDisplay?.addressRotation ?? 0
    };
  }

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
          <h3>{t("properties.title")}</h3>
        </header>
        <div className="panel-body">
          <p className="muted">{t("properties.empty")}</p>
          {activeLayer && <p className="muted small">{t("properties.activeLayer", { name: activeLayer.name })}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="panel properties-panel">
      <header className="panel-header">
        <h3>{t("properties.title")}</h3>
      </header>
      <div className="panel-body properties-body">
        {selectedComponentInstance && (
          <section className="property-section">
            <h4>{t("properties.componentSection")}: {selectedComponentTag}</h4>
            <label className="row">
              {t("properties.tagPrefix")}
              <input
                type="text"
                value={selectedComponentInstance.tagPrefix}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    tagPrefix: event.target.value.trim().toUpperCase()
                  }))
                }
              />
            </label>
            <label className="row">
              {t("properties.tagNumber")}
              <input
                type="number"
                min={1}
                step={1}
                value={selectedComponentInstance.tagNumber}
                onChange={(event) => {
                  const nextNumber = Number(event.target.value);
                  if (!Number.isInteger(nextNumber) || nextNumber < 1) return;
                  updateSelectedComponent((instance) => ({ ...instance, tagNumber: nextNumber }));
                }}
              />
            </label>
            <label className="row">
              {t("properties.componentType")}
              <input
                type="text"
                value={selectedComponentInstance.type}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({ ...instance, type: event.target.value }))
                }
              />
            </label>
            <label className="row">
              {t("properties.partOf")}
              <select
                value={selectedComponentInstance.partOfId ?? ""}
                onChange={(event) => {
                  const parent = componentParentOptions.find((option) => option.componentId === event.target.value);
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    partOfId: parent?.componentId,
                    partOfTag: parent?.tag
                  }));
                }}
              >
                <option value="">{t("properties.noParent")}</option>
                {componentParentOptions
                  .filter((option) => option.componentId !== selectedComponentInstance.componentId && !option.partOfId)
                  .map((option) => (
                    <option key={option.componentId} value={option.componentId}>
                      {option.tag}{option.type ? ` - ${option.type}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="row">
              {t("properties.showParts")}
              <input
                type="checkbox"
                checked={Boolean(selectedComponentInstance.partsDisplay?.show)}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    partsDisplay: {
                      ...getPartsDisplayWithDefaults(instance),
                      show: event.target.checked
                    }
                  }))
                }
              />
            </label>
            {selectedComponentInstance.partsDisplay?.show && (
              <>
                <label className="row">
                  {t("properties.partsPosition")}
                  <select
                    value={selectedComponentInstance.partsDisplay.position}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          position: event.target.value as NonNullable<ComponentInstance["partsDisplay"]>["position"]
                        }
                      }))
                    }
                  >
                    <option value="below">{t("properties.partsPositions.below")}</option>
                    <option value="right">{t("properties.partsPositions.right")}</option>
                    <option value="above">{t("properties.partsPositions.above")}</option>
                    <option value="left">{t("properties.partsPositions.left")}</option>
                  </select>
                </label>
                <label className="row">
                  {t("properties.partsRotation")}
                  <input
                    type="number"
                    step={15}
                    value={selectedComponentInstance.partsDisplay.rotation}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          rotation: Number(event.target.value) || 0
                        }
                      }))
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.partsSpacing")}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={selectedComponentInstance.partsDisplay.spacing}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          spacing: Math.max(0, Number(event.target.value) || 0)
                        }
                      }))
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.partsOffset")}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={selectedComponentInstance.partsDisplay.offset ?? 5}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          offset: Math.max(0, Number(event.target.value) || 0)
                        }
                      }))
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.partsScale")}
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={selectedComponentInstance.partsDisplay.scale}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          scale: Math.max(0.1, Number(event.target.value) || 1)
                        }
                      }))
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.partsAddressOffsetX")}
                  <input
                    type="number"
                    step={1}
                    value={selectedComponentInstance.partsDisplay.addressOffsetX ?? 6}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          addressOffsetX: Number(event.target.value) || 0
                        }
                      }))
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.partsAddressOffsetY")}
                  <input
                    type="number"
                    step={1}
                    value={selectedComponentInstance.partsDisplay.addressOffsetY ?? 0}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          addressOffsetY: Number(event.target.value) || 0
                        }
                      }))
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.partsAddressRotation")}
                  <input
                    type="number"
                    step={15}
                    value={selectedComponentInstance.partsDisplay.addressRotation ?? 0}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        partsDisplay: {
                          ...getPartsDisplayWithDefaults(instance),
                          show: true,
                          addressRotation: Number(event.target.value) || 0
                        }
                      }))
                    }
                  />
                </label>
              </>
            )}
            {selectedComponentInstance.partOfId && (
              <>
                <label className="row">
                  {t("properties.showParentLink")}
                  <input
                    type="checkbox"
                    checked={Boolean(selectedComponentInstance.showParentLink)}
                    onChange={(event) =>
                      updateSelectedComponent((instance) => ({
                        ...instance,
                        showParentLink: event.target.checked,
                        parentLinkOffsetX: instance.parentLinkOffsetX ?? 6,
                        parentLinkOffsetY: instance.parentLinkOffsetY ?? -2,
                        parentLinkRotation: instance.parentLinkRotation ?? 0
                      }))
                    }
                  />
                </label>
                {selectedComponentInstance.showParentLink && (
                  <>
                    <label className="row">
                      {t("properties.parentLinkOffsetX")}
                      <input
                        type="number"
                        step={0.5}
                        value={selectedComponentInstance.parentLinkOffsetX ?? 6}
                        onChange={(event) =>
                          updateSelectedComponent((instance) => ({
                            ...instance,
                            parentLinkOffsetX: Number(event.target.value) || 0
                          }))
                        }
                      />
                    </label>
                    <label className="row">
                      {t("properties.parentLinkOffsetY")}
                      <input
                        type="number"
                        step={0.5}
                        value={selectedComponentInstance.parentLinkOffsetY ?? -2}
                        onChange={(event) =>
                          updateSelectedComponent((instance) => ({
                            ...instance,
                            parentLinkOffsetY: Number(event.target.value) || 0
                          }))
                        }
                      />
                    </label>
                    <label className="row">
                      {t("properties.parentLinkRotation")}
                      <input
                        type="number"
                        step={15}
                        value={selectedComponentInstance.parentLinkRotation ?? 0}
                        onChange={(event) =>
                          updateSelectedComponent((instance) => ({
                            ...instance,
                            parentLinkRotation: Number(event.target.value) || 0
                          }))
                        }
                      />
                    </label>
                  </>
                )}
              </>
            )}
          </section>
        )}
        {selectedComponentInstance && (
          <section className="property-section">
            <h4>{t("properties.labelSection")}</h4>
            <label className="row">
              {t("properties.showLabel")}
              <input
                type="checkbox"
                checked={selectedComponentInstance.label.visible}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    label: { ...instance.label, visible: event.target.checked }
                  }))
                }
              />
            </label>
            <label className="row">
              {t("properties.labelOffsetX")}
              <input
                type="number"
                value={selectedComponentInstance.label.offsetX}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    label: { ...instance.label, offsetX: Number(event.target.value) || 0 }
                  }))
                }
              />
            </label>
            <label className="row">
              {t("properties.labelOffsetY")}
              <input
                type="number"
                value={selectedComponentInstance.label.offsetY}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    label: { ...instance.label, offsetY: Number(event.target.value) || 0 }
                  }))
                }
              />
            </label>
            <label className="row">
              {t("properties.labelSize")}
              <input
                type="number"
                min={1}
                step={0.5}
                value={selectedComponentInstance.label.fontSize}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    label: { ...instance.label, fontSize: Number(event.target.value) || 1 }
                  }))
                }
              />
            </label>
            <label className="row">
              {t("properties.labelAlign")}
              <select
                value={selectedComponentInstance.label.align}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    label: {
                      ...instance.label,
                      align: event.target.value as "left" | "center" | "right"
                    }
                  }))
                }
              >
                <option value="left">{t("properties.alignTextLeft")}</option>
                <option value="center">{t("properties.alignTextCenter")}</option>
                <option value="right">{t("properties.alignTextRight")}</option>
              </select>
            </label>
            <label className="row">
              {t("properties.labelRotation")}
              <input
                type="number"
                step={15}
                value={selectedComponentInstance.label.rotation}
                onChange={(event) =>
                  updateSelectedComponent((instance) => ({
                    ...instance,
                    label: { ...instance.label, rotation: Number(event.target.value) || 0 }
                  }))
                }
              />
            </label>
          </section>
        )}
        {selectedShape && (
          <section className="property-section">
            <h4>{t("properties.geometrySection")}</h4>
            <label className="row">
              {t("properties.layer")}
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
            {selectedShape.type !== "group" && (
              <>
            <label className="row">
              {t("properties.line")}
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
              {t("properties.lineWidth")}
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
                {t("properties.lineStyle")}
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
                  <option value="solid">{t("properties.continuous")}</option>
                  <option value="dashed">{t("properties.dashed")}</option>
                  <option value="dotted">{t("properties.dotted")}</option>
                </select>
              </label>
            )}
            {selectedShape.type === "potential" && (
              <>
                <label className="row">
                  {t("properties.number")}
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
                  {t("properties.name")}
                  <input
                    type="text"
                    value={selectedShape.potentialName ?? ""}
                    onChange={(event) =>
                      onUpdatePotentialShared(selectedShape.id, { potentialName: event.target.value })
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.diameterMm2")}
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
                <label className="row">{t("properties.x1")}<input type="number" value={selectedShape.x1} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x1: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.y1")}<input type="number" value={selectedShape.y1} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y1: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.x2")}<input type="number" value={selectedShape.x2} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x2: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.y2")}<input type="number" value={selectedShape.y2} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y2: Number(event.target.value) }))
                } /></label>
              </>
            )}
            {selectedShape.type === "circle" && (
              <>
                <label className="row">{t("properties.cx")}<input type="number" value={selectedShape.cx} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cx: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.cy")}<input type="number" value={selectedShape.cy} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cy: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.r")}<input type="number" value={selectedShape.r} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, r: Number(event.target.value) }))
                } /></label>
              </>
            )}
            {selectedShape.type === "arc" && (
              <>
                <label className="row">{t("properties.cx")}<input type="number" value={selectedShape.cx} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cx: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.cy")}<input type="number" value={selectedShape.cy} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, cy: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.r")}<input type="number" value={selectedShape.r} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, r: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.start")}<input type="number" value={selectedShape.startAngle} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, startAngle: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.end")}<input type="number" value={selectedShape.endAngle} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, endAngle: Number(event.target.value) }))
                } /></label>
              </>
            )}
            {selectedShape.type === "text" && (
              <>
                <label className="row">{t("properties.x")}<input type="number" value={selectedShape.x} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.y")}<input type="number" value={selectedShape.y} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.text")}<input type="text" value={selectedShape.text} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, text: event.target.value }))
                } /></label>
                <label className="row">{t("properties.size")}<input type="number" value={selectedShape.fontSize} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, fontSize: Number(event.target.value) || 12 }))
                } /></label>
                <label className="row">
                  {t("properties.link")}
                  <input
                    type="checkbox"
                    checked={Boolean(selectedShape.linkEnabled)}
                    onChange={(event) =>
                      onUpdateShape(selectedShape.id, (shape) => ({ ...shape, linkEnabled: event.target.checked }))
                    }
                  />
                </label>
                <label className="row">
                  {t("properties.target")}
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
                <label className="row">{t("properties.pinX")}<input type="number" value={selectedShape.x} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, x: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.pinY")}<input type="number" value={selectedShape.y} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, y: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.tag")}<input type="text" value={selectedShape.tag} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tag: event.target.value }))
                } /></label>
                <label className="row">{t("properties.tagX")}<input type="number" value={selectedShape.tagX} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tagX: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.tagY")}<input type="number" value={selectedShape.tagY} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tagY: Number(event.target.value) }))
                } /></label>
                <label className="row">{t("properties.tagSize")}<input type="number" value={selectedShape.tagFontSize} onChange={(event) =>
                  onUpdateShape(selectedShape.id, (shape) => ({ ...shape, tagFontSize: Number(event.target.value) || 4 }))
                } /></label>
              </>
            )}
              </>
            )}
            {selectedShape.type === "group" && groupOrigin && (
              <>
            <label className="row">
              {t("properties.originX")}
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
              {t("properties.originY")}
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
          </section>
        )}
      </div>
    </section>
  );
}
