import { useEffect, useState } from "react";
import type { Component, LineStyle, Shape } from "../models";
import { arcToPath, getShapeBounds } from "../utils/geometry";

const potentialEdgeFontSize = 3.2;
const potentialMidFontSize = 3.2;
const potentialLabelOffset = 0;
const potentialEdgeLabelOffset = 0.3;
const potentialMidLabelOffset = 2;
const potentialArrowLength = 2.4;
const potentialArrowLabelGap = 1;
const potentialArrowLabelShift = 3;

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type PotentialLabelLayout = {
  startLabel: string;
  endLabel: string;
  midLabel: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
  startAlign: "start" | "end";
  endAlign: "start" | "end";
  rotation: number;
};

function getLineStyleProps(lineStyle?: LineStyle) {
  const style = lineStyle ?? "solid";
  if (style === "dashed") {
    return { strokeDasharray: "8 4", strokeLinecap: "butt" as const };
  }
  if (style === "dotted") {
    return { strokeDasharray: "0 6", strokeLinecap: "round" as const };
  }
  return { strokeDasharray: undefined, strokeLinecap: "butt" as const };
}

function buildPotentialEdgeLabel(name: string) {
  return name.trim();
}

function buildPotentialMidLabel(number: number, diameter?: number | null) {
  if (diameter === null || diameter === undefined || !Number.isFinite(diameter ?? NaN)) {
    return String(number);
  }
  return `${number} - ${diameter}mm2`;
}

function getPotentialLabelLayout(shape: Shape & { type: "potential" }): PotentialLabelLayout {
  const dx = shape.x2 - shape.x1;
  const dy = shape.y2 - shape.y1;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const nx = -dy / length;
  const ny = dx / length;
  const isVertical = Math.abs(dy) > Math.abs(dx);
  const rotation = isVertical ? (dy < 0 ? -90 : 90) : 0;
  const arrowLabelOffset = potentialArrowLength + potentialArrowLabelGap;
  const endArrowLabelOffset = Math.max(0, arrowLabelOffset - potentialArrowLabelShift);
  const edgeNormalSign = ny >= 0 ? 1 : -1;
  const edgeOffsetX = nx * potentialEdgeLabelOffset * edgeNormalSign;
  const edgeOffsetY = ny * potentialEdgeLabelOffset * edgeNormalSign;
  const startX = shape.x1 + nx * potentialLabelOffset - ux * arrowLabelOffset + edgeOffsetX;
  const startY = shape.y1 + ny * potentialLabelOffset - uy * arrowLabelOffset + edgeOffsetY;
  const endX = shape.x2 + nx * potentialLabelOffset + ux * endArrowLabelOffset + edgeOffsetX;
  const endY = shape.y2 + ny * potentialLabelOffset + uy * endArrowLabelOffset + edgeOffsetY;
  const midNormalSign = ny >= 0 ? 1 : -1;
  const midX = (shape.x1 + shape.x2) / 2 + nx * potentialLabelOffset + nx * potentialMidLabelOffset * midNormalSign;
  const midY = (shape.y1 + shape.y2) / 2 + ny * potentialLabelOffset + ny * potentialMidLabelOffset * midNormalSign;
  const angleRad = (rotation * Math.PI) / 180;
  const textDirX = Math.cos(angleRad);
  const textDirY = Math.sin(angleRad);
  const startDot = -ux * textDirX - uy * textDirY;
  const endDot = ux * textDirX + uy * textDirY;
  const startAlign = startDot >= 0 ? "start" : "end";
  const endAlign = endDot >= 0 ? "start" : "end";
  const startLabel = buildPotentialEdgeLabel(shape.potentialName ?? "");
  const endLabel = buildPotentialEdgeLabel(shape.potentialName ?? "");
  const midLabel = buildPotentialMidLabel(shape.potentialNumber, shape.potentialDiameter ?? null);

  return {
    startLabel,
    endLabel,
    midLabel,
    startX,
    startY,
    endX,
    endY,
    midX,
    midY,
    startAlign,
    endAlign,
    rotation
  };
}

function getTextBounds(
  text: string,
  x: number,
  y: number,
  align: "start" | "middle" | "end",
  fontSize: number,
  rotation: number
): Bounds | null {
  if (!text) return null;
  const width = text.length * (fontSize * 0.6);
  const height = fontSize;
  const left = align === "start" ? 0 : align === "end" ? -width : -width / 2;
  const right = align === "start" ? width : align === "end" ? 0 : width / 2;
  const top = -height / 2;
  const bottom = height / 2;
  const angleRad = (rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom }
  ].map((corner) => ({
    x: x + corner.x * cos - corner.y * sin,
    y: y + corner.x * sin + corner.y * cos
  }));
  return corners.reduce(
    (acc, corner) => ({
      minX: Math.min(acc.minX, corner.x),
      minY: Math.min(acc.minY, corner.y),
      maxX: Math.max(acc.maxX, corner.x),
      maxY: Math.max(acc.maxY, corner.y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function mergeBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

type ComponentsPanelProps = {
  components: Component[];
  onSaveComponent: () => void;
  onSelectComponent: (id: string) => void;
  onDeleteComponent: (id: string) => void;
  onRenameComponent: (id: string, name: string) => void;
  placingComponentId: string | null;
  showPinConnection: boolean;
};

export default function ComponentsPanel({
  components,
  onSaveComponent,
  onSelectComponent,
  onDeleteComponent,
  onRenameComponent,
  placingComponentId,
  showPinConnection
}: ComponentsPanelProps) {
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    function handleClick() {
      setContextMenu(null);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu(null);
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  function getComponentBounds(shapes: Shape[]) {
    return shapes.reduce(
      (acc, shape) => {
        const bounds = getComponentShapeBounds(shape);
        return mergeBounds(acc, bounds);
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
  }

  function getComponentShapeBounds(shape: Shape): Bounds {
    if (shape.type === "group") {
      if (shape.children.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      }
      return shape.children.reduce(
        (acc, child) => mergeBounds(acc, getComponentShapeBounds(child)),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );
    }
    const baseBounds = getShapeBounds(shape);
    if (shape.type !== "potential") return baseBounds;
    const layout = getPotentialLabelLayout(shape);
    const labelBounds = [
      getTextBounds(layout.startLabel, layout.startX, layout.startY, layout.startAlign, potentialEdgeFontSize, layout.rotation),
      getTextBounds(layout.endLabel, layout.endX, layout.endY, layout.endAlign, potentialEdgeFontSize, layout.rotation),
      getTextBounds(layout.midLabel, layout.midX, layout.midY, "middle", potentialMidFontSize, layout.rotation)
    ].filter((bounds): bounds is Bounds => Boolean(bounds));
    return labelBounds.reduce((acc, bounds) => mergeBounds(acc, bounds), baseBounds);
  }

  function renderShape(shape: Shape) {
    if (shape.type === "group") {
      return shape.children.map((child) => renderShape(child));
    }
    if (shape.type === "line") {
      const { strokeDasharray, strokeLinecap } = getLineStyleProps(shape.lineStyle);
      return (
        <line
          key={shape.id}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={shape.lineColor}
          strokeWidth={shape.lineWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap={strokeLinecap}
        />
      );
    }
    if (shape.type === "potential") {
      const { strokeDasharray, strokeLinecap } = getLineStyleProps(shape.lineStyle);
      const layout = getPotentialLabelLayout(shape);
      return (
        <g key={shape.id}>
          <line
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            stroke={shape.lineColor}
            strokeWidth={shape.lineWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
          />
          {layout.startLabel && (
            <text
              className="potential-label"
              x={layout.startX}
              y={layout.startY}
              fill={shape.lineColor}
              fontSize={potentialEdgeFontSize}
              fontFamily="Space Grotesk"
              textAnchor={layout.startAlign}
              dominantBaseline="middle"
              transform={layout.rotation !== 0 ? `rotate(${layout.rotation} ${layout.startX} ${layout.startY})` : undefined}
            >
              {layout.startLabel}
            </text>
          )}
          {layout.endLabel && (
            <text
              className="potential-label"
              x={layout.endX}
              y={layout.endY}
              fill={shape.lineColor}
              fontSize={potentialEdgeFontSize}
              fontFamily="Space Grotesk"
              textAnchor={layout.endAlign}
              dominantBaseline="middle"
              transform={layout.rotation !== 0 ? `rotate(${layout.rotation} ${layout.endX} ${layout.endY})` : undefined}
            >
              {layout.endLabel}
            </text>
          )}
          {layout.midLabel && (
            <text
              className="potential-label"
              x={layout.midX}
              y={layout.midY}
              fill={shape.lineColor}
              fontSize={potentialMidFontSize}
              fontFamily="Space Grotesk"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={layout.rotation !== 0 ? `rotate(${layout.rotation} ${layout.midX} ${layout.midY})` : undefined}
            >
              {layout.midLabel}
            </text>
          )}
        </g>
      );
    }
    if (shape.type === "circle") {
      return (
        <circle
          key={shape.id}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          stroke={shape.lineColor}
          strokeWidth={shape.lineWidth}
          fill="none"
        />
      );
    }
    if (shape.type === "arc") {
      return (
        <path
          key={shape.id}
          d={arcToPath(shape)}
          stroke={shape.lineColor}
          strokeWidth={shape.lineWidth}
          fill="none"
        />
      );
    }
    if (shape.type === "text") {
      return (
        <text
          key={shape.id}
          x={shape.x}
          y={shape.y}
          fill={shape.lineColor}
          fontSize={shape.fontSize}
          fontFamily={shape.fontFamily}
        >
          {shape.text}
        </text>
      );
    }
    if (shape.type === "pin") {
      const cross = 1;
      return (
        <g key={shape.id}>
          {showPinConnection && (
            <>
              <line
                x1={shape.x - cross}
                y1={shape.y - cross}
                x2={shape.x + cross}
                y2={shape.y + cross}
                stroke={shape.lineColor}
                strokeWidth={shape.lineWidth}
              />
              <line
                x1={shape.x - cross}
                y1={shape.y + cross}
                x2={shape.x + cross}
                y2={shape.y - cross}
                stroke={shape.lineColor}
                strokeWidth={shape.lineWidth}
              />
            </>
          )}
          <text
            x={shape.tagX}
            y={shape.tagY}
            fill={shape.lineColor}
            fontSize={shape.tagFontSize}
            fontFamily="Space Grotesk"
          >
            {shape.tag}
          </text>
        </g>
      );
    }
    return null;
  }

  function renderThumbnail(component: Component) {
    if (component.shapes.length === 0) return null;
    const bounds = getComponentBounds(component.shapes);
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const padding = 4;
    const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${width + padding * 2} ${height + padding * 2}`;

    return (
      <svg className="component-thumb" viewBox={viewBox} aria-hidden="true">
        {component.shapes.map((shape) => renderShape(shape))}
      </svg>
    );
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>Components</h3>
        <button className="icon-button" onClick={onSaveComponent}>Save</button>
      </header>
      <div className="panel-body component-list">
        {components.length === 0 && <p className="muted">No components saved yet.</p>}
        {components.map((component) => (
          <div
            key={component.id}
            className={placingComponentId === component.id ? "component-card active" : "component-card"}
            onClick={() => onSelectComponent(component.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ id: component.id, x: event.clientX, y: event.clientY });
            }}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", component.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            {renderThumbnail(component)}
            <input
              className="component-name-input"
              type="text"
              value={component.name}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onRenameComponent(component.id, event.target.value)}
            />
          </div>
        ))}
        <p className="muted small">Click a component, then click on canvas to place it. Hold Alt for contain select.</p>
      </div>
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button
            type="button"
            className="context-menu-item danger"
            onClick={() => {
              onDeleteComponent(contextMenu.id);
              setContextMenu(null);
            }}
          >
            Delete component
          </button>
        </div>
      )}
    </section>
  );
}
