import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Component, LibraryComponent, LineStyle, Shape } from "../models";
import { buildComponentPlacementKey } from "../utils/components";
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

type ComponentsPanelProps = {
  appComponents: LibraryComponent[];
  projectComponents: Component[];
  onSaveComponent: () => void;
  onImportComponent: (file: File) => void;
  onSelectComponent: (id: string) => void;
  onDeleteComponent: (id: string) => void;
  onRenameComponent: (id: string, name: string) => void;
  onExportComponent?: (id: string) => void;
  placingComponentId: string | null;
  showPinConnection: boolean;
};

type ComponentCardItem = {
  key: string;
  source: "app" | "project";
  component: Component | LibraryComponent;
  editableName: boolean;
};

type ComponentMenuState = {
  item: ComponentCardItem;
  x: number;
  y: number;
};

type ComponentGroup<TComponent extends Component> = {
  key: string;
  label: string;
  items: TComponent[];
};

function buildComponentTypeGroups<TComponent extends Component>(
  components: TComponent[],
  fallbackLabel: string,
  keyPrefix: string
): ComponentGroup<TComponent>[] {
  const groups = new Map<string, { label: string; items: TComponent[] }>();

  components.forEach((component) => {
    const label = component.defaultComponentType?.trim() || fallbackLabel;
    const key = `${keyPrefix}:${label.toLowerCase()}`;
    const bucket = groups.get(key);

    if (bucket) {
      bucket.items.push(component);
    } else {
      groups.set(key, { label, items: [component] });
    }
  });

  return Array.from(groups.entries())
    .sort(([, a], [, b]) => a.label.localeCompare(b.label))
    .map(([key, group]) => ({
      key,
      label: group.label,
      items: group.items
    }));
}

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
  return `${number} - ${diameter}mm\u00B2`;
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

export default function ComponentsPanel({
  appComponents,
  projectComponents,
  onSaveComponent,
  onImportComponent,
  onSelectComponent,
  onDeleteComponent,
  onRenameComponent,
  onExportComponent,
  placingComponentId,
  showPinConnection
}: ComponentsPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [componentMenu, setComponentMenu] = useState<ComponentMenuState | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const searchTerm = query.trim().toLowerCase();

  const filteredAppComponents = useMemo(
    () => appComponents.filter((component) => matchesComponent(component, searchTerm)),
    [appComponents, searchTerm]
  );

  const filteredProjectComponents = useMemo(
    () => projectComponents.filter((component) => matchesComponent(component, searchTerm)),
    [projectComponents, searchTerm]
  );

  const appGroups = useMemo(() => {
    return buildComponentTypeGroups(filteredAppComponents, t("components.untyped"), "app");
  }, [filteredAppComponents, t]);

  const projectGroups = useMemo(() => {
    return buildComponentTypeGroups(filteredProjectComponents, t("components.untyped"), "project");
  }, [filteredProjectComponents, t]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  function handleImportInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    onImportComponent(file);
  }

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

  function renderShape(shape: Shape): ReactNode {
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

  function renderThumbnail(component: Component | LibraryComponent) {
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

  function setComponentDragImage(event: DragEvent<HTMLDivElement>) {
    const thumbnail = event.currentTarget.querySelector<SVGSVGElement>(".component-thumb");
    if (!thumbnail) return;

    const rect = thumbnail.getBoundingClientRect();
    const dragImage = thumbnail.cloneNode(true) as SVGSVGElement;
    dragImage.removeAttribute("class");
    dragImage.setAttribute("width", `${Math.max(48, Math.round(rect.width))}`);
    dragImage.setAttribute("height", `${Math.max(48, Math.round(rect.height))}`);
    dragImage.style.position = "fixed";
    dragImage.style.left = "-1000px";
    dragImage.style.top = "-1000px";
    dragImage.style.overflow = "visible";
    dragImage.style.background = "transparent";
    dragImage.style.pointerEvents = "none";

    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, rect.width / 2, rect.height / 2);
    window.setTimeout(() => dragImage.remove(), 0);
  }

  function renderCard(item: ComponentCardItem) {
    const placementKey = buildComponentPlacementKey(item.source, item.component.id);
    const isActive = placingComponentId === placementKey;
    const tagPrefix = item.component.defaultTagPrefix?.trim().toUpperCase();

    return (
      <div
        key={placementKey}
        className={isActive ? "component-card active" : "component-card"}
        onClick={() => {
          setComponentMenu(null);
          onSelectComponent(placementKey);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setComponentMenu({
            item,
            x: event.clientX,
            y: event.clientY
          });
        }}
        draggable
        onDragStart={(event) => {
          setComponentMenu(null);
          event.dataTransfer.setData("text/plain", placementKey);
          event.dataTransfer.effectAllowed = "copy";
          setComponentDragImage(event);
        }}
      >
        {renderThumbnail(item.component)}
        <div className="component-card-content">
          <div className="component-card-title-row">
            <div className="component-name" title={item.component.name}>{item.component.name}</div>
            {tagPrefix && <span className="component-prefix-pill">{tagPrefix}</span>}
          </div>
        </div>
      </div>
    );
  }

  const noMatches = searchTerm.length > 0 && filteredAppComponents.length === 0 && filteredProjectComponents.length === 0;

  return (
    <section className="panel library-panel" onClick={() => setComponentMenu(null)}>
      <header className="panel-header library-header">
        <h3>{t("components.title")}</h3>
        <div className="library-header-actions">
          <button
            type="button"
            className="icon-button library-add-button"
            title={t("components.importJson")}
            aria-label={t("components.importJson")}
            onClick={() => importInputRef.current?.click()}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button library-add-button"
            title={t("components.saveToProject")}
            aria-label={t("components.saveToProject")}
            onClick={onSaveComponent}
          >
            +
          </button>
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept=".wpm"
            onChange={handleImportInputChange}
          />
        </div>
      </header>
      <div className="panel-body component-list">
        <input
          className="component-search-input"
          type="search"
          value={query}
          placeholder={t("components.searchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="component-section">
          <div className="component-section-header">
            <span>{t("components.appLibrary")}</span>
            <span className="component-section-count">{appComponents.length}</span>
          </div>
          {appGroups.length === 0 ? (
            <p className="muted">{noMatches ? t("components.noMatches") : t("components.emptyAppLibrary")}</p>
          ) : (
            appGroups.map((group) => (
              <div key={group.key} className="component-group">
                <button
                  type="button"
                  className="component-group-toggle"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className="component-group-title">{group.label}</span>
                  <span className="component-group-toggle-meta">
                    <span className="component-group-toggle-count">{group.items.length}</span>
                    <span className="component-group-toggle-icon">
                      {searchTerm.length > 0 || !collapsedGroups[group.key] ? "-" : "+"}
                    </span>
                  </span>
                </button>
                {(searchTerm.length > 0 || !collapsedGroups[group.key]) && (
                  <div className="component-group-grid">
                    {group.items.map((component) => renderCard({
                      key: buildComponentPlacementKey("app", component.id),
                      source: "app",
                      component,
                      editableName: false
                    }))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="component-section">
          <div className="component-section-header">
            <span>{t("components.projectComponents")}</span>
            <span className="component-section-count">{projectComponents.length}</span>
          </div>
          {projectGroups.length === 0 ? (
            <p className="muted">{noMatches ? t("components.noMatches") : t("components.emptyProjectComponents")}</p>
          ) : (
            projectGroups.map((group) => (
              <div key={group.key} className="component-group">
                <button
                  type="button"
                  className="component-group-toggle"
                  onClick={() => toggleGroup(group.key)}
                >
                  <span className="component-group-title">{group.label}</span>
                  <span className="component-group-toggle-meta">
                    <span className="component-group-toggle-count">{group.items.length}</span>
                    <span className="component-group-toggle-icon">
                      {searchTerm.length > 0 || !collapsedGroups[group.key] ? "-" : "+"}
                    </span>
                  </span>
                </button>
                {(searchTerm.length > 0 || !collapsedGroups[group.key]) && (
                  <div className="component-group-grid">
                    {group.items.map((component) => renderCard({
                      key: buildComponentPlacementKey("project", component.id),
                      source: "project",
                      component,
                      editableName: true
                    }))}
                  </div>
                )}
              </div>
            ))
          )}
          <p className="muted small">{t("components.exportHelp")}</p>
        </div>
        <p className="muted small">{t("components.placementHint")}</p>
      </div>
      {componentMenu && (
        <div
          className="context-menu component-context-menu"
          style={{ top: componentMenu.y, left: componentMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              onSelectComponent(buildComponentPlacementKey(componentMenu.item.source, componentMenu.item.component.id));
              setComponentMenu(null);
            }}
          >
            {t("components.insert")}
          </button>
          {componentMenu.item.editableName && (
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                const nextName = window.prompt(t("components.renamePrompt"), componentMenu.item.component.name);
                if (nextName !== null) onRenameComponent(componentMenu.item.component.id, nextName);
                setComponentMenu(null);
              }}
            >
              {t("components.rename")}
            </button>
          )}
          {componentMenu.item.source === "project" && onExportComponent && (
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                onExportComponent(componentMenu.item.component.id);
                setComponentMenu(null);
              }}
            >
              {t("components.exportToAppLibrary")}
            </button>
          )}
          {componentMenu.item.source === "project" && (
            <>
              <div className="context-menu-separator" />
              <button
                type="button"
                className="context-menu-item danger"
                onClick={() => {
                  onDeleteComponent(componentMenu.item.component.id);
                  setComponentMenu(null);
                }}
              >
                {t("components.delete")}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function matchesComponent(component: Component | LibraryComponent, searchTerm: string) {
  if (!searchTerm) return true;
  const haystack = [component.name, component.category, component.description, ...component.tags]
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm);
}
