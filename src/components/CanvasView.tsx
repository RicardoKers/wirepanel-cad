import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentInstance, Layer, LineStyle, Page, PdfSettings, Point, Shape, Tool, ViewState } from "../models";
import { angleBetween, arcToPath, distance, getShapeBounds, normalizeAngle } from "../utils/geometry";
import { replacePlaceholders } from "../utils/text";
import { createId } from "../utils/id";
import { formatMarkerAddress, getMarkerLayout, parseMarkerAddress, pointToMarker } from "../utils/markers";

const defaultLineColor = "#000000";
const defaultFill = "transparent";
const minShapeSize = 0.5;
const minArcAngle = 0.01;

const viewClamp = { min: 0.2, max: 80 };

const emptyPoint: Point = { x: 0, y: 0 };
const defaultLineStyle: LineStyle = "solid";
const potentialEdgeFontSize = 3.2;
const potentialMidFontSize = 3.2;
const potentialLabelOffset = 0;
const potentialEdgeLabelOffset = 0.3;
const potentialMidLabelOffset = 2;
const potentialArrowLength = 2.4;
const potentialArrowWidth = 1.4;
const potentialArrowLabelGap = 1;
const potentialArrowLabelShift = 3;
const pinConnectionTolerance = 0.8;
const selectionProximityPx = 6;
const selectionCyclePointPx = 8;
const textSelectionProximityPx = 1;
const textSelectionProximityMm = 0.6;
const potentialJunctionRadius = 0.6;
const pinHoverRadius = 1;

type CanvasViewProps = {
  shapes: Shape[];
  pages: Page[];
  layers: Layer[];
  activeLayer: Layer | undefined;
  tool: Tool;
  selection: string[];
  view: ViewState;
  gridSize: number;
  snapEnabled: boolean;
  pdfSettings: PdfSettings;
  gridColor: string;
  showPinConnection: boolean;
  shouldAutoFit: boolean;
  fitToPageRequest: number;
  pageIndex: number;
  totalPages: number;
  pageId: string;
  placingComponentId: string | null;
  componentInstances: ComponentInstance[];
  nextPotentialNumber: number;
  potentialRender?: Record<string, PotentialRenderInfo>;
  onViewChange: (view: ViewState) => void;
  onAddShape: (shape: Shape) => void;
  onUpdateShape: (id: string, updater: (shape: Shape) => Shape) => void;
  onMoveSelection: (dx: number, dy: number) => void;
  onMoveStart?: () => void;
  onMoveEnd?: () => void;
  onSelect: (ids: string[]) => void;
  onPlaceComponentAt: (componentId: string, x: number, y: number) => void;
  onCancelPlacingComponent: () => void;
  onDeleteSelection: () => void;
  onResizeStart: (bounds: Bounds) => void;
  onResizeSelection: (bounds: Bounds) => void;
  onResizeEnd: () => void;
  onSelectionContextMenu?: (x: number, y: number) => void;
  onCopySelection?: () => void;
  onCutSelection?: () => void;
  onPasteSelection?: (point?: Point) => void;
  onResetTool?: () => void;
  onNavigateToLink?: (pageIndex: number, bounds: Bounds) => void;
  navigateTarget?: { pageId: string; bounds: Bounds } | null;
  onNavigateTargetApplied?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
};

type PotentialLinkTarget = {
  address: string;
  pageIndex: number;
  bounds: Bounds;
};

type PotentialRenderInfo = {
  startVisible: boolean;
  endVisible: boolean;
  startLink?: PotentialLinkTarget;
  endLink?: PotentialLinkTarget;
  showMidLabel: boolean;
  startLabelVisible?: boolean;
  endLabelVisible?: boolean;
  startArrow?: "forward" | "backward";
  endArrow?: "forward" | "backward";
};

type ArcDraft = {
  center: Point;
  start: Point | null;
  end: Point | null;
  startAngle?: number;
  endAngle?: number;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function getRotatedScaledBoundsSize(bounds: Bounds, rotation: number, scale: number) {
  const width = Math.max(1, bounds.maxX - bounds.minX) * scale;
  const height = Math.max(1, bounds.maxY - bounds.minY) * scale;
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos
  };
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type ResizeState = {
  handle: ResizeHandle;
  startBounds: Bounds;
};

type PointerLike = {
  clientX: number;
  clientY: number;
  pointerId?: number;
};

type ShapeHitCandidate = {
  shape: Shape;
  distance: number;
  priority: number;
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

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(point, start);
  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

function distanceToBounds(point: Point, bounds: Bounds) {
  const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX);
  const dy = Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY);
  return Math.hypot(dx, dy);
}

function isAngleWithinArc(angle: number, start: number, end: number) {
  const sweep = end - start;
  if (Math.abs(sweep) >= Math.PI * 2) return true;
  const startNorm = normalizeAngle(start);
  const endNorm = normalizeAngle(end);
  const angleNorm = normalizeAngle(angle);
  if (sweep >= 0) {
    if (startNorm <= endNorm) {
      return angleNorm >= startNorm && angleNorm <= endNorm;
    }
    return angleNorm >= startNorm || angleNorm <= endNorm;
  }
  if (endNorm <= startNorm) {
    return angleNorm <= startNorm && angleNorm >= endNorm;
  }
  return angleNorm <= startNorm || angleNorm >= endNorm;
}

function collectPins(items: Shape[]): Point[] {
  const pins: Point[] = [];
  const visit = (shape: Shape) => {
    if (shape.type === "group") {
      shape.children.forEach((child) => visit(child));
      return;
    }
    if (shape.type !== "pin") return;
    pins.push({ x: shape.x, y: shape.y });
  };
  items.forEach((shape) => visit(shape));
  return pins;
}

function findPinHit(point: Point, pins: Point[]): { point: Point; distance: number } | null {
  let best: { point: Point; distance: number } | null = null;
  pins.forEach((pin) => {
    const dist = Math.hypot(point.x - pin.x, point.y - pin.y);
    if (dist > pinConnectionTolerance) return;
    if (!best || dist < best.distance) {
      best = { point: pin, distance: dist };
    }
  });
  return best;
}

type DistanceCandidate = {
  shape: Shape;
  distance: number;
};

export default function CanvasView({
  shapes,
  pages,
  layers,
  activeLayer,
  tool,
  selection,
  view,
  gridSize,
  snapEnabled,
  pdfSettings,
  gridColor,
  showPinConnection,
  shouldAutoFit,
  fitToPageRequest,
  pageIndex,
  totalPages,
  pageId,
  placingComponentId,
  componentInstances,
  nextPotentialNumber,
  potentialRender,
  onViewChange,
  onAddShape,
  onUpdateShape,
  onMoveSelection,
  onMoveStart,
  onMoveEnd,
  onSelect,
  onPlaceComponentAt,
  onCancelPlacingComponent,
  onDeleteSelection,
  onResizeStart,
  onResizeSelection,
  onResizeEnd,
  onSelectionContextMenu,
  onCopySelection,
  onCutSelection,
  onPasteSelection,
  onResetTool,
  onNavigateToLink,
  navigateTarget,
  onNavigateTargetApplied,
  onUndo,
  onRedo
}: CanvasViewProps) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [arcDraft, setArcDraft] = useState<ArcDraft | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [marquee, setMarquee] = useState<{ start: Point; end: Point; additive: boolean; mode: "intersect" | "contain" } | null>(null);
  const [pinHover, setPinHover] = useState<Point | null>(null);
  const dragPointRef = useRef<Point>(emptyPoint);
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const lastPointerRef = useRef<Point>(emptyPoint);
  const selectionCycleRef = useRef<{ point: Point; candidateIds: string[]; index: number } | null>(null);
  const tagDragRef = useRef<{ id: string; last: Point } | null>(null);
  const lastFitToPageRequestRef = useRef(0);
  const endpointDragRef = useRef<{
    id: string;
    endpoint: "start" | "end";
    last: Point;
    pointerId?: number;
    target?: SVGCircleElement;
  } | null>(null);
  const arcAngleRef = useRef<{ lastRaw: number; unwrapped: number } | null>(null);

  useEffect(() => {
    setDraft(null);
    setArcDraft(null);
    arcAngleRef.current = null;
  }, [tool]);

  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id)),
    [layers]
  );
  const selectableLayerIds = useMemo(
    () => new Set(layers.filter((layer) => layer.visible && !layer.locked).map((layer) => layer.id)),
    [layers]
  );

  function isShapeVisible(shape: Shape): boolean {
    if (shape.type === "group") {
      return shape.children.some((child) => isShapeVisible(child));
    }
    return visibleLayerIds.has(shape.layerId);
  }

  function isShapeSelectable(shape: Shape): boolean {
    if (shape.type === "group") {
      return shape.children.some((child) => isShapeSelectable(child));
    }
    return selectableLayerIds.has(shape.layerId);
  }

  const selectedShapes = useMemo(() => shapes.filter((shape) => selection.includes(shape.id)), [selection, shapes]);

  const selectionBounds = useMemo(() => {
    if (selectedShapes.length === 0) return null;
    return selectedShapes.reduce(
      (acc, shape) => {
        const bounds = getShapeBounds(shape);
        return {
          minX: Math.min(acc.minX, bounds.minX),
          minY: Math.min(acc.minY, bounds.minY),
          maxX: Math.max(acc.maxX, bounds.maxX),
          maxY: Math.max(acc.maxY, bounds.maxY)
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
  }, [selectedShapes]);

  const potentialJunctions = useMemo(() => {
    const roundCoord = (value: number) => Math.round(value * 1000) / 1000;
    const makePointKey = (point: Point) => `${roundCoord(point.x)}|${roundCoord(point.y)}`;
    const map = new Map<string, { point: Point; count: number; color: string }>();
    const addPoint = (point: Point, color: string) => {
      const key = makePointKey(point);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      map.set(key, { point, count: 1, color });
    };
    const visit = (shape: Shape) => {
      if (shape.type === "group") {
        shape.children.forEach((child) => visit(child));
        return;
      }
      if (shape.type !== "potential") return;
      addPoint({ x: shape.x1, y: shape.y1 }, shape.lineColor);
      addPoint({ x: shape.x2, y: shape.y2 }, shape.lineColor);
    };
    shapes.forEach((shape) => visit(shape));
    const junctions: { key: string; point: Point; color: string }[] = [];
    map.forEach((entry, key) => {
      if (entry.count >= 3) {
        junctions.push({ key, point: entry.point, color: entry.color });
      }
    });
    return junctions;
  }, [shapes]);
  const pinPoints = useMemo(() => collectPins(shapes), [shapes]);

  const isSingleLineOrPotential =
    selectedShapes.length === 1 &&
    (selectedShapes[0].type === "line" || selectedShapes[0].type === "potential");
  const canResizeSelection =
    selectedShapes.length > 0 &&
    selectedShapes.every((shape) => shape.type !== "line" && shape.type !== "potential");

  useEffect(() => {
    if (tool !== "potential") {
      setPinHover(null);
    }
  }, [tool]);

  function getShapeDistance(shape: Shape, point: Point): number {
    if (shape.type === "group") {
      if (shape.children.length === 0) {
        return distanceToBounds(point, getShapeBounds(shape));
      }
      const eligibleChildren = shape.children.filter((child) => isShapeVisible(child) && isShapeSelectable(child));
      if (eligibleChildren.length === 0) {
        return distanceToBounds(point, getShapeBounds(shape));
      }
      return Math.min(...eligibleChildren.map((child) => getShapeDistance(child, point)));
    }
    if (shape.type === "line" || shape.type === "potential") {
      return distanceToSegment(point, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
    }
    if (shape.type === "circle") {
      return Math.abs(distance(point, { x: shape.cx, y: shape.cy }) - shape.r);
    }
    if (shape.type === "arc") {
      const angle = angleBetween({ x: shape.cx, y: shape.cy }, point);
      const inArc = isAngleWithinArc(angle, shape.startAngle, shape.endAngle);
      if (inArc) {
        return Math.abs(distance(point, { x: shape.cx, y: shape.cy }) - shape.r);
      }
      const startPoint = {
        x: shape.cx + Math.cos(shape.startAngle) * shape.r,
        y: shape.cy + Math.sin(shape.startAngle) * shape.r
      };
      const endPoint = {
        x: shape.cx + Math.cos(shape.endAngle) * shape.r,
        y: shape.cy + Math.sin(shape.endAngle) * shape.r
      };
      return Math.min(distance(point, startPoint), distance(point, endPoint));
    }
    if (shape.type === "text") {
      const resolvedText = replacePlaceholders(shape.text, {
        project: pdfSettings.project,
        drawing: pdfSettings.drawing,
        author: pdfSettings.author,
        page: pageIndex + 1,
        totalPages
      });
      const textWidth = resolvedText.length * (shape.fontSize * 0.6);
      const baselineY = shape.y - shape.fontSize * 0.2;
      return distanceToSegment(point, { x: shape.x, y: baselineY }, { x: shape.x + textWidth, y: baselineY });
    }
    if (shape.type === "pin") {
      const textWidth = shape.tag.length * (shape.tagFontSize * 0.6);
      const tagBounds = {
        minX: shape.tagX,
        minY: shape.tagY - shape.tagFontSize,
        maxX: shape.tagX + textWidth,
        maxY: shape.tagY
      };
      const crossDistance = distance(point, { x: shape.x, y: shape.y });
      return Math.min(crossDistance, distanceToBounds(point, tagBounds));
    }
    return distanceToBounds(point, getShapeBounds(shape));
  }

  function getShapeHitPriority(shape: Shape) {
    if (shape.type === "text") return 1;
    if (shape.type === "group") return 3;
    return 2;
  }

  function getShapeHitCandidates(point: Point, includeText = false): ShapeHitCandidate[] {
    const threshold = selectionProximityPx / view.scale;
    const textThreshold = Math.min(textSelectionProximityPx / view.scale, textSelectionProximityMm);
    const candidates: ShapeHitCandidate[] = [];

    shapes.forEach((shape) => {
      if (!isShapeVisible(shape) || !isShapeSelectable(shape)) return;
      if (shape.type === "text" && !includeText) return;
      const dist = getShapeDistance(shape, point);
      const allowedDistance = shape.type === "text" ? textThreshold : threshold;
      if (dist <= allowedDistance) {
        candidates.push({ shape, distance: dist, priority: getShapeHitPriority(shape) });
      }
    });

    return candidates.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.shape.id.localeCompare(b.shape.id);
    });
  }

  function findClosestShape(point: Point, includeText = false): Shape | null {
    return getShapeHitCandidates(point, includeText)[0]?.shape ?? null;
  }

  function findSelectionTarget(point: Point, includeText = false): Shape | null {
    const candidates = getShapeHitCandidates(point, includeText);
    if (candidates.length === 0) {
      selectionCycleRef.current = null;
      return null;
    }

    const candidateIds = candidates.map((candidate) => candidate.shape.id);
    const lastCycle = selectionCycleRef.current;
    const cycleDistance = lastCycle ? distance(point, lastCycle.point) * view.scale : Infinity;
    const sameCycle =
      lastCycle !== null &&
      cycleDistance <= selectionCyclePointPx &&
      lastCycle.candidateIds.length === candidateIds.length &&
      lastCycle.candidateIds.every((id, index) => id === candidateIds[index]);

    if (sameCycle) {
      const nextIndex = (lastCycle.index + 1) % candidates.length;
      selectionCycleRef.current = { point, candidateIds, index: nextIndex };
      return candidates[nextIndex].shape;
    }

    selectionCycleRef.current = { point, candidateIds, index: 0 };
    return candidates[0].shape;
  }

  function applySelection(event: ReactPointerEvent<SVGElement>, target: Shape, world: Point) {
    if (!isShapeVisible(target) || !isShapeSelectable(target)) return;
    if (target.type !== "group") {
      const layer = layers.find((item) => item.id === target.layerId);
      if (layer?.locked) return;
    }
    const isSelected = selection.includes(target.id);
    if (event.shiftKey) {
      if (isSelected) {
        onSelect(selection.filter((id) => id !== target.id));
      } else {
        onSelect([...selection, target.id]);
      }
      return;
    }
    if (!isSelected) {
      onSelect([target.id]);
    }
    startDrag(world);
  }

  function getWorldPoint(event: PointerLike) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left - view.offsetX) / view.scale;
    const y = (event.clientY - rect.top - view.offsetY) / view.scale;
    return { x, y };
  }

  function getWorldPointFromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left - view.offsetX) / view.scale;
    const y = (clientY - rect.top - view.offsetY) / view.scale;
    return { x, y };
  }

  function snapPoint(point: Point) {
    if (!snapEnabled) return point;
    const snappedX = Math.round(point.x / gridSize) * gridSize;
    const snappedY = Math.round(point.y / gridSize) * gridSize;
    return { x: snappedX, y: snappedY };
  }

  function startDrag(point: Point) {
    dragPointRef.current = point;
    setIsDragging(true);
    onMoveStart?.();
  }

  function getResizedBounds(state: ResizeState, point: Point): Bounds {
    const { startBounds, handle } = state;
    let minX = startBounds.minX;
    let maxX = startBounds.maxX;
    let minY = startBounds.minY;
    let maxY = startBounds.maxY;

    if (handle.includes("w")) minX = point.x;
    if (handle.includes("e")) maxX = point.x;
    if (handle.includes("n")) minY = point.y;
    if (handle.includes("s")) maxY = point.y;

    const minSize = 1;
    if (maxX - minX < minSize) {
      if (handle.includes("w")) {
        minX = maxX - minSize;
      } else if (handle.includes("e")) {
        maxX = minX + minSize;
      }
    }
    if (maxY - minY < minSize) {
      if (handle.includes("n")) {
        minY = maxY - minSize;
      } else if (handle.includes("s")) {
        maxY = minY + minSize;
      }
    }

    return { minX, minY, maxX, maxY };
  }

  function unwrapAngle(rawAngle: number) {
    if (!arcAngleRef.current) {
      arcAngleRef.current = { lastRaw: rawAngle, unwrapped: rawAngle };
      return rawAngle;
    }
    let delta = rawAngle - arcAngleRef.current.lastRaw;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    arcAngleRef.current.unwrapped += delta;
    arcAngleRef.current.lastRaw = rawAngle;
    return arcAngleRef.current.unwrapped;
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    containerRef.current?.focus();
    const rawWorld = getWorldPoint(event);
    const world = snapPoint(rawWorld);
    lastPointerRef.current = world;

    if (placingComponentId) {
      onPlaceComponentAt(placingComponentId, world.x, world.y);
      return;
    }

    if (tool === "pan") {
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: view.offsetX,
        offsetY: view.offsetY
      };
      setIsPanning(true);
      return;
    }

    if (tool === "select") {
      const nearestShape = findSelectionTarget(rawWorld);
      if (nearestShape) {
        applySelection(event, nearestShape, world);
        return;
      }
      if (!event.shiftKey) {
        onSelect([]);
      }
      const mode = event.altKey ? "contain" : "intersect";
      setMarquee({ start: world, end: world, additive: event.shiftKey, mode });
      return;
    }

    if (!activeLayer || activeLayer.locked) return;

    if (tool === "line") {
      const line: Shape = {
        id: createId("shape"),
        type: "line",
        layerId: activeLayer.id,
        lineColor: defaultLineColor,
        lineWidth: 1,
        fill: defaultFill,
        lineStyle: defaultLineStyle,
        x1: world.x,
        y1: world.y,
        x2: world.x,
        y2: world.y
      };
      setDraft(line);
    }

    if (tool === "potential") {
      const pinHit = findPinHit(rawWorld, pinPoints);
      const startPoint = pinHit ? pinHit.point : world;
      const potential: Shape = {
        id: createId("shape"),
        type: "potential",
        layerId: activeLayer.id,
        lineColor: defaultLineColor,
        lineWidth: 1,
        fill: defaultFill,
        lineStyle: defaultLineStyle,
        x1: startPoint.x,
        y1: startPoint.y,
        x2: startPoint.x,
        y2: startPoint.y,
        potentialNumber: nextPotentialNumber,
        potentialName: "",
        potentialDiameter: null
      };
      setDraft(potential);
    }

    if (tool === "circle") {
      const circle: Shape = {
        id: createId("shape"),
        type: "circle",
        layerId: activeLayer.id,
        lineColor: defaultLineColor,
        lineWidth: 1,
        fill: defaultFill,
        lineStyle: defaultLineStyle,
        cx: world.x,
        cy: world.y,
        r: 0
      };
      setDraft(circle);
    }

    if (tool === "text") {
      const text: Shape = {
        id: createId("shape"),
        type: "text",
        layerId: activeLayer.id,
        lineColor: defaultLineColor,
        lineWidth: 1,
        fill: defaultFill,
        lineStyle: defaultLineStyle,
        x: world.x,
        y: world.y,
        text: t("app.newText"),
        fontSize: 14,
        fontFamily: "Space Grotesk",
        linkEnabled: false,
        linkTarget: ""
      };
      onAddShape(text);
      onSelect([text.id]);
    }

    if (tool === "pin") {
      const pin: Shape = {
        id: createId("shape"),
        type: "pin",
        layerId: activeLayer.id,
        lineColor: defaultLineColor,
        lineWidth: 1,
        fill: defaultFill,
        lineStyle: defaultLineStyle,
        x: world.x,
        y: world.y,
        tag: t("app.newPin"),
        tagX: world.x,
        tagY: world.y,
        tagFontSize: 3
      };
      onAddShape(pin);
      onSelect([pin.id]);
    }

    if (tool === "arc") {
      if (!arcDraft) {
        setArcDraft({ center: world, start: null, end: null });
      } else if (!arcDraft.start) {
        const startAngle = angleBetween(arcDraft.center, world);
        arcAngleRef.current = { lastRaw: startAngle, unwrapped: startAngle };
        setArcDraft({ ...arcDraft, start: world, end: world, startAngle, endAngle: startAngle });
      } else {
        const start = arcDraft.start;
        const startAngle = arcDraft.startAngle ?? angleBetween(arcDraft.center, start);
        const endAngle = arcDraft.endAngle ?? angleBetween(arcDraft.center, world);
        const radius = distance(arcDraft.center, start);
        const angleSpan = Math.abs(endAngle - startAngle);
        if (radius < minShapeSize || angleSpan < minArcAngle) {
          setArcDraft(null);
          arcAngleRef.current = null;
          return;
        }
        const arc: Shape = {
          id: createId("shape"),
          type: "arc",
          layerId: activeLayer.id,
          lineColor: defaultLineColor,
          lineWidth: 1,
          fill: defaultFill,
          lineStyle: defaultLineStyle,
          cx: arcDraft.center.x,
          cy: arcDraft.center.y,
          r: radius,
          startAngle,
          endAngle
        };
        onAddShape(arc);
        setArcDraft(null);
        arcAngleRef.current = null;
      }
    }
  }

  function updateEndpointDrag(event: PointerLike) {
    if (!endpointDragRef.current) return false;
    if (
      endpointDragRef.current.pointerId !== undefined &&
      event.pointerId !== undefined &&
      endpointDragRef.current.pointerId !== event.pointerId
    ) {
      return true;
    }
    const world = snapPoint(getWorldPoint(event));
    const { id, endpoint, last } = endpointDragRef.current;
    if (world.x === last.x && world.y === last.y) return true;
    endpointDragRef.current = { ...endpointDragRef.current, last: world };
    onUpdateShape(id, (shape) => {
      if (shape.type !== "line" && shape.type !== "potential") return shape;
      if (endpoint === "start") return { ...shape, x1: world.x, y1: world.y };
      return { ...shape, x2: world.x, y2: world.y };
    });
    return true;
  }

  function finishEndpointDrag(event?: PointerLike) {
    if (!endpointDragRef.current) return;
    if (
      event?.pointerId !== undefined &&
      endpointDragRef.current.pointerId !== undefined &&
      endpointDragRef.current.pointerId !== event.pointerId
    ) {
      return;
    }
    const { pointerId, target } = endpointDragRef.current;
    if (pointerId !== undefined && target?.releasePointerCapture) {
      target.releasePointerCapture(pointerId);
    }
    endpointDragRef.current = null;
    onMoveEnd?.();
    setIsDragging(false);
    setIsPanning(false);
  }

  useEffect(() => {
    const handleWindowPointerMove = (event: globalThis.PointerEvent) => {
      if (!endpointDragRef.current) return;
      updateEndpointDrag(event);
    };
    const handleWindowPointerUp = (event: globalThis.PointerEvent) => {
      if (!endpointDragRef.current) return;
      finishEndpointDrag(event);
    };
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [gridSize, snapEnabled, view, onUpdateShape, onMoveEnd]);

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const rawWorld = getWorldPoint(event);
    const world = snapPoint(rawWorld);
    lastPointerRef.current = world;
    if (tagDragRef.current) {
      const { id, last } = tagDragRef.current;
      const dx = world.x - last.x;
      const dy = world.y - last.y;
      tagDragRef.current = { id, last: world };
      if (dx !== 0 || dy !== 0) {
        onUpdateShape(id, (shape) => {
          if (shape.type !== "pin") return shape;
          return { ...shape, tagX: shape.tagX + dx, tagY: shape.tagY + dy };
        });
      }
      return;
    }
    if (updateEndpointDrag(event)) return;
    if (resizeState) {
      const nextBounds = getResizedBounds(resizeState, world);
      onResizeSelection(nextBounds);
      return;
    }
    if (marquee) {
      setMarquee({ ...marquee, end: world });
      return;
    }
    if (isDragging) {
      const last = dragPointRef.current;
      const dx = world.x - last.x;
      const dy = world.y - last.y;
      dragPointRef.current = world;
      onMoveSelection(dx, dy);
      return;
    }

    if (isPanning && panStartRef.current) {
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      onViewChange({
        ...view,
        offsetX: panStartRef.current.offsetX + dx,
        offsetY: panStartRef.current.offsetY + dy
      });
      return;
    }

    const pinHit = tool === "potential" ? findPinHit(rawWorld, pinPoints) : null;
    setPinHover((prev) => {
      const nextPoint = tool === "potential" && pinHit ? pinHit.point : null;
      if (!prev && !nextPoint) return prev;
      if (prev && nextPoint && prev.x === nextPoint.x && prev.y === nextPoint.y) return prev;
      return nextPoint;
    });

    if (draft?.type === "line") {
      setDraft({ ...draft, x2: world.x, y2: world.y });
    }

    if (draft?.type === "potential") {
      const endPoint = pinHit ? pinHit.point : world;
      setDraft({ ...draft, x2: endPoint.x, y2: endPoint.y });
    }

    if (draft?.type === "circle") {
      const radius = distance({ x: draft.cx, y: draft.cy }, world);
      setDraft({ ...draft, r: radius });
    }

    if (arcDraft && arcDraft.start) {
      const rawAngle = angleBetween(arcDraft.center, world);
      const endAngle = unwrapAngle(rawAngle);
      setArcDraft({ ...arcDraft, end: world, endAngle });
    }
  }

  function handlePointerUp() {
    if (tagDragRef.current) {
      tagDragRef.current = null;
      onMoveEnd?.();
      setIsDragging(false);
      setIsPanning(false);
      return;
    }
    if (endpointDragRef.current) {
      finishEndpointDrag();
      return;
    }
    if (resizeState) {
      setResizeState(null);
      onResizeEnd();
      setIsDragging(false);
      setIsPanning(false);
      return;
    }
    if (marquee) {
      const { start, end, additive, mode } = marquee;
      setMarquee(null);
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxX = Math.max(start.x, end.x);
      const maxY = Math.max(start.y, end.y);
      const width = maxX - minX;
      const height = maxY - minY;

      if (width > 2 || height > 2) {
        const inside = shapes
          .filter((shape) => isShapeSelectable(shape))
          .filter((shape) => {
            const bounds = getShapeBounds(shape);
            const isContained =
              bounds.minX >= minX &&
              bounds.maxX <= maxX &&
              bounds.minY >= minY &&
              bounds.maxY <= maxY;
            if (mode === "contain") {
              return isContained;
            }
            if (shape.type === "text") {
              return isContained;
            }
            return bounds.minX <= maxX && bounds.maxX >= minX && bounds.minY <= maxY && bounds.maxY >= minY;
          })
          .map((shape) => shape.id);
        onSelect(additive ? Array.from(new Set([...selection, ...inside])) : inside);
      }
      setIsDragging(false);
      setIsPanning(false);
      return;
    }
    if (draft) {
      let isValid = true;
      if (draft.type === "line" || draft.type === "potential") {
        isValid = distance({ x: draft.x1, y: draft.y1 }, { x: draft.x2, y: draft.y2 }) >= minShapeSize;
      } else if (draft.type === "circle") {
        isValid = draft.r >= minShapeSize;
      }
      if (isValid) {
        onAddShape(draft);
      }
      setDraft(null);
    }
    if (isDragging) {
      onMoveEnd?.();
    }
    setIsDragging(false);
    setIsPanning(false);
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    if (event.cancelable) {
      event.preventDefault();
    }
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const scaleFactor = Math.exp(-event.deltaY * 0.0015);
    const nextScale = Math.min(viewClamp.max, Math.max(viewClamp.min, view.scale * scaleFactor));
    const worldX = (mouseX - view.offsetX) / view.scale;
    const worldY = (mouseY - view.offsetY) / view.scale;
    const nextOffsetX = mouseX - worldX * nextScale;
    const nextOffsetY = mouseY - worldY * nextScale;
    onViewChange({ scale: nextScale, offsetX: nextOffsetX, offsetY: nextOffsetY });
  }

  function handleSelectionBoundsPointerDown(event: ReactPointerEvent<SVGRectElement>) {
    if (tool !== "select") return;
    event.stopPropagation();
    const world = snapPoint(getWorldPoint(event));
    startDrag(world);
  }

  function handleResizePointerDown(event: ReactPointerEvent<SVGRectElement>, handle: ResizeHandle) {
    if (tool !== "select" || !selectionBounds || !canResizeSelection) return;
    event.stopPropagation();
    onResizeStart(selectionBounds);
    setResizeState({ handle, startBounds: selectionBounds });
  }

  function handleShapePointerDown(event: ReactPointerEvent<SVGElement>, shape: Shape, force = false) {
    if (tool !== "select") return;
    event.stopPropagation();
    const rawWorld = getWorldPoint(event);
    const world = snapPoint(rawWorld);
    const target = force ? shape : findSelectionTarget(rawWorld);
    if (!target) return;
    applySelection(event, target, world);
  }

  function handlePinTagPointerDown(event: ReactPointerEvent<SVGElement>, shape: Shape) {
    if (tool !== "select") return;
    if (shape.type !== "pin") return;
    if (!isShapeVisible(shape) || !isShapeSelectable(shape)) return;
    const layer = layers.find((item) => item.id === shape.layerId);
    if (layer?.locked) return;
    if (event.shiftKey) {
      handleShapePointerDown(event, shape);
      return;
    }
    event.stopPropagation();
    const world = snapPoint(getWorldPoint(event));
    if (!selection.includes(shape.id)) {
      onSelect([shape.id]);
    }
    tagDragRef.current = { id: shape.id, last: world };
    onMoveStart?.();
  }

  function handleEndpointPointerDown(
    event: ReactPointerEvent<SVGCircleElement>,
    shape: Shape,
    endpoint: "start" | "end"
  ) {
    if (tool !== "select") return;
    if (shape.type !== "line" && shape.type !== "potential") return;
    if (!isShapeVisible(shape) || !isShapeSelectable(shape)) return;
    event.stopPropagation();
    const world = snapPoint(getWorldPoint(event));
    lastPointerRef.current = world;
    if (!selection.includes(shape.id)) {
      onSelect([shape.id]);
    }
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    endpointDragRef.current = {
      id: shape.id,
      endpoint,
      last: world,
      pointerId: event.pointerId,
      target: event.currentTarget
    };
    onMoveStart?.();
  }

  function handleEndpointPointerMove(event: ReactPointerEvent<SVGCircleElement>) {
    if (!endpointDragRef.current) return;
    event.stopPropagation();
    updateEndpointDrag(event);
  }

  function handleEndpointPointerUp(event: ReactPointerEvent<SVGCircleElement>) {
    if (!endpointDragRef.current) return;
    event.stopPropagation();
    finishEndpointDrag(event);
  }

  function handleDragOver(event: React.DragEvent<SVGSVGElement>) {
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(event: React.DragEvent<SVGSVGElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const componentId = event.dataTransfer.getData("text/plain");
    if (!componentId) return;
    const world = snapPoint(getWorldPointFromClient(event.clientX, event.clientY));
    onPlaceComponentAt(componentId, world.x, world.y);
  }

  function handleContextMenu(event: React.MouseEvent<SVGSVGElement>) {
    if (!onSelectionContextMenu || selection.length === 0 || !selectionBounds) return;
    const world = getWorldPointFromClient(event.clientX, event.clientY);
    const inside =
      world.x >= selectionBounds.minX &&
      world.x <= selectionBounds.maxX &&
      world.y >= selectionBounds.minY &&
      world.y <= selectionBounds.maxY;
    if (!inside) return;
    event.preventDefault();
    onSelectionContextMenu(event.clientX, event.clientY);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (target?.isContentEditable) return;
    const isModifier = event.metaKey || event.ctrlKey;
    if (isModifier) {
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        return;
      }
      if (key === "y") {
        event.preventDefault();
        onRedo?.();
        return;
      }
      if (key === "c") {
        event.preventDefault();
        onCopySelection?.();
        return;
      }
      if (key === "x") {
        event.preventDefault();
        onCutSelection?.();
        return;
      }
      if (key === "v") {
        event.preventDefault();
        onPasteSelection?.(lastPointerRef.current);
        return;
      }
    }
    if (placingComponentId && event.key === "Escape") {
      onCancelPlacingComponent();
      onResetTool?.();
      return;
    }
    if (event.key === "Escape") {
      onResetTool?.();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      onDeleteSelection();
      return;
    }
    if (selection.length > 0) {
      const step = snapEnabled ? gridSize : 1;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      if (event.key === "ArrowRight") dx = step;
      if (event.key === "ArrowUp") dy = -step;
      if (event.key === "ArrowDown") dy = step;
      if (dx !== 0 || dy !== 0) {
        event.preventDefault();
        onMoveSelection(dx, dy);
      }
    }
  }

  const clipId = "paper-clip";
  const layout = getMarkerLayout(pdfSettings);
  const {
    pageWidth,
    pageHeight,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    markerRows,
    markerCols,
    markerBandWidth,
    markerBandHeight,
    columnWidth,
    rowHeight,
    showMarkers
  } = layout;
  const gridPath = useMemo(() => {
    if (gridSize <= 0) return "";

    const commands: string[] = [];
    const epsilon = gridSize / 1000;

    for (let x = 0; x <= pageWidth + epsilon; x += gridSize) {
      const value = Number(x.toFixed(6));
      commands.push(`M ${value} 0 V ${pageHeight}`);
    }
    for (let y = 0; y <= pageHeight + epsilon; y += gridSize) {
      const value = Number(y.toFixed(6));
      commands.push(`M 0 ${value} H ${pageWidth}`);
    }

    return commands.join(" ");
  }, [gridSize, pageHeight, pageWidth]);

  function fitViewToPage() {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const padding = 24;
    const usableWidth = Math.max(1, rect.width - padding * 2);
    const usableHeight = Math.max(1, rect.height - padding * 2);
    const rawScale = Math.min(usableWidth / pageWidth, usableHeight / pageHeight);
    const nextScale = Math.min(viewClamp.max, Math.max(viewClamp.min, rawScale));
    const offsetX = (rect.width - pageWidth * nextScale) / 2;
    const offsetY = (rect.height - pageHeight * nextScale) / 2;
    onViewChange({ scale: nextScale, offsetX, offsetY });
  }

  useEffect(() => {
    if (!shouldAutoFit) return;
    fitViewToPage();
  }, [onViewChange, pageHeight, pageWidth, shouldAutoFit]);

  useEffect(() => {
    if (fitToPageRequest === 0) return;
    if (fitToPageRequest === lastFitToPageRequestRef.current) return;
    lastFitToPageRequestRef.current = fitToPageRequest;
    fitViewToPage();
  }, [fitToPageRequest, onViewChange, pageHeight, pageWidth]);

  useEffect(() => {
    if (!navigateTarget || navigateTarget.pageId !== pageId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const padding = 24;
    const targetWidth = Math.max(1, navigateTarget.bounds.maxX - navigateTarget.bounds.minX);
    const targetHeight = Math.max(1, navigateTarget.bounds.maxY - navigateTarget.bounds.minY);
    const usableWidth = Math.max(1, rect.width - padding * 2);
    const usableHeight = Math.max(1, rect.height - padding * 2);
    const rawScale = Math.min(usableWidth / targetWidth, usableHeight / targetHeight);
    const nextScale = Math.min(viewClamp.max, Math.max(viewClamp.min, rawScale));
    const centerX = (navigateTarget.bounds.minX + navigateTarget.bounds.maxX) / 2;
    const centerY = (navigateTarget.bounds.minY + navigateTarget.bounds.maxY) / 2;
    const offsetX = rect.width / 2 - centerX * nextScale;
    const offsetY = rect.height / 2 - centerY * nextScale;
    onViewChange({ scale: nextScale, offsetX, offsetY });
    onNavigateTargetApplied?.();
  }, [navigateTarget, onNavigateTargetApplied, onViewChange, pageId]);

  const buildPotentialEdgeLabel = (name: string, address?: string) => {
    const trimmed = name.trim();
    if (address) {
      return trimmed ? `${trimmed} - ${address}` : address;
    }
    return trimmed;
  };

  const buildPotentialMidLabel = (number: number, diameter?: number | null) => {
    if (diameter === null || diameter === undefined || !Number.isFinite(diameter ?? NaN)) {
      return String(number);
    }
    return `${number} - ${diameter}mm²`;
  };

  const getPotentialArrowSegments = (
    tipX: number,
    tipY: number,
    dx: number,
    dy: number,
    direction: "forward" | "backward"
  ) => {
    const length = Math.hypot(dx, dy) || 1;
    const sign = direction === "backward" ? -1 : 1;
    const ux = (dx / length) * sign;
    const uy = (dy / length) * sign;
    const px = -uy;
    const py = ux;
    const baseX = tipX - ux * potentialArrowLength;
    const baseY = tipY - uy * potentialArrowLength;
    const leftX = baseX + px * potentialArrowWidth;
    const leftY = baseY + py * potentialArrowWidth;
    const rightX = baseX - px * potentialArrowWidth;
    const rightY = baseY - py * potentialArrowWidth;
    return [
      { x1: tipX, y1: tipY, x2: leftX, y2: leftY },
      { x1: tipX, y1: tipY, x2: rightX, y2: rightY }
    ];
  };


  const renderedShapes = shapes
    .filter((shape) => isShapeVisible(shape))
    .map((shape) => renderShape(shape, false));

  const renderedComponentLabels = componentInstances
    .filter((instance) => instance.pageId === pageId && instance.label.visible)
    .map((instance) => {
      const linkedShape = shapes.find((shape) => instance.shapeIds.includes(shape.id));
      if (!linkedShape || !isShapeVisible(linkedShape)) return null;
      const bounds = getShapeBounds(linkedShape);
      const x = bounds.minX + instance.label.offsetX;
      const y = bounds.minY + instance.label.offsetY;
      const tag = `${instance.tagPrefix}${instance.tagNumber}`;
      return (
        <text
          key={instance.componentId}
          className="component-label"
          x={x}
          y={y}
          fontSize={instance.label.fontSize}
          textAnchor={instance.label.align === "center" ? "middle" : instance.label.align === "right" ? "end" : "start"}
          transform={instance.label.rotation ? `rotate(${instance.label.rotation} ${x} ${y})` : undefined}
          pointerEvents="none"
        >
          {tag}
        </text>
      );
    });

  const markerLayout = getMarkerLayout(pdfSettings);

  function findShapeByIdIn(items: Shape[], id: string): Shape | null {
    for (const shape of items) {
      if (shape.id === id) return shape;
      if (shape.type === "group") {
        const child = findShapeByIdIn(shape.children, id);
        if (child) return child;
      }
    }
    return null;
  }

  function mergeBounds(a: Bounds, b: Bounds): Bounds {
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY)
    };
  }

  function getInstanceShapes(instance: ComponentInstance): { shapes: Shape[]; bounds: Bounds; page: Page; pageIndex: number } | null {
    const targetPageIndex = pages.findIndex((page) => page.id === instance.pageId);
    const targetPage = pages[targetPageIndex];
    if (!targetPage) return null;
    const instanceShapes = instance.shapeIds
      .map((shapeId) => findShapeByIdIn(targetPage.shapes, shapeId))
      .filter((item): item is Shape => Boolean(item));
    if (instanceShapes.length === 0) return null;
    const bounds = instanceShapes
      .map((shape) => getShapeBounds(shape))
      .reduce((acc, item) => mergeBounds(acc, item));
    return { shapes: instanceShapes, bounds, page: targetPage, pageIndex: targetPageIndex };
  }

  function getInstanceAddress(instance: ComponentInstance) {
    const item = getInstanceShapes(instance);
    if (!item) return "";
    const bounds = item.bounds;
    const cell = pointToMarker(
      {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2
      },
      markerLayout
    );
    return cell ? formatMarkerAddress(item.pageIndex, cell) : "";
  }

  function buildParentLinkText(instance: ComponentInstance) {
    if (!instance.partOfId) return "";
    const parent = componentInstances.find((item) => item.componentId === instance.partOfId);
    if (!parent) return "";
    return getInstanceAddress(parent);
  }

  function handleComponentLinkPointerDown(
    event: ReactPointerEvent<SVGTextElement>,
    linkTarget?: { pageIndex: number; bounds: Bounds }
  ) {
    if (!linkTarget || !onNavigateToLink) return;
    const isModifier = event.metaKey || event.ctrlKey;
    if (!isModifier) return;
    event.preventDefault();
    event.stopPropagation();
    onNavigateToLink(linkTarget.pageIndex, linkTarget.bounds);
  }

  const renderedParentLinks = componentInstances
    .filter((instance) => instance.pageId === pageId && instance.showParentLink && instance.partOfId)
    .map((instance) => {
      const linkedItem = getInstanceShapes(instance);
      if (!linkedItem || !linkedItem.shapes.some((shape) => isShapeVisible(shape))) return null;
      const text = buildParentLinkText(instance);
      if (!text) return null;
      const bounds = linkedItem.bounds;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const textX = centerX + (instance.parentLinkOffsetX ?? (bounds.maxX - centerX + 3));
      const textY = centerY + (instance.parentLinkOffsetY ?? (bounds.minY - centerY - 2));
      const textRotation = instance.parentLinkRotation ?? 0;
      const parent = componentInstances.find((item) => item.componentId === instance.partOfId);
      const parentItem = parent ? getInstanceShapes(parent) : null;
      return (
        <text
          key={`parent-link-${instance.componentId}`}
          className="component-link-label"
          x={textX}
          y={textY}
          fontSize={3.2}
          pointerEvents="all"
          transform={textRotation ? `rotate(${textRotation} ${textX} ${textY})` : undefined}
          onPointerDown={(event) =>
            handleComponentLinkPointerDown(
              event,
              parentItem ? { pageIndex: parentItem.pageIndex, bounds: parentItem.bounds } : undefined
            )
          }
        >
          {text}
        </text>
      );
    });

  const renderedPartReferences = componentInstances
    .filter((instance) => instance.pageId === pageId && instance.partsDisplay?.show)
    .flatMap((parent) => {
      const parentItem = getInstanceShapes(parent);
      const display = parent.partsDisplay;
      if (!parentItem || !display || !parentItem.shapes.some((shape) => isShapeVisible(shape))) return [];
      const parentBounds = parentItem.bounds;
      const parts = componentInstances
        .filter((instance) => instance.partOfId === parent.componentId)
        .sort((a, b) => (a.partOrder ?? 0) - (b.partOrder ?? 0))
        .map((part) => {
          const partItem = getInstanceShapes(part);
          if (!partItem || !partItem.shapes.some((shape) => isShapeVisible(shape))) return null;
          const bounds = partItem.bounds;
          const scale = Math.max(0.1, display.scale);
          const rotatedSize = getRotatedScaledBoundsSize(bounds, display.rotation, scale);
          return {
            part,
            partItem,
            bounds,
            displayWidth: rotatedSize.width,
            displayHeight: rotatedSize.height
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      const spacing = Math.max(0, display.spacing);
      const startOffset = Math.max(0, display.offset ?? spacing);
      const addressOffsetX = display.addressOffsetX ?? 6;
      const addressOffsetY = display.addressOffsetY ?? 0;
      const addressRotation = display.addressRotation ?? 0;
      let horizontalOffset = 0;
      let verticalOffset = 0;
      return parts.map(({ part, partItem, bounds: partBounds, displayWidth, displayHeight }) => {
        const scale = Math.max(0.1, display.scale);
        const parentCenterX = (parentBounds.minX + parentBounds.maxX) / 2;
        const parentCenterY = (parentBounds.minY + parentBounds.maxY) / 2;
        let symbolCenterX = parentCenterX;
        let symbolCenterY = parentBounds.maxY + startOffset + displayHeight / 2;
        if (display.position === "right") {
          symbolCenterX = parentBounds.maxX + startOffset + horizontalOffset + displayWidth / 2;
          symbolCenterY = parentCenterY;
          horizontalOffset += displayWidth + spacing;
        }
        if (display.position === "left") {
          symbolCenterX = parentBounds.minX - startOffset - horizontalOffset - displayWidth / 2;
          symbolCenterY = parentCenterY;
          horizontalOffset += displayWidth + spacing;
        }
        if (display.position === "below") {
          symbolCenterX = parentCenterX;
          symbolCenterY = parentBounds.maxY + startOffset + verticalOffset + displayHeight / 2;
          verticalOffset += displayHeight + spacing;
        }
        if (display.position === "above") {
          symbolCenterX = parentCenterX;
          symbolCenterY = parentBounds.minY - startOffset - verticalOffset - displayHeight / 2;
          verticalOffset += displayHeight + spacing;
        }
        const address = getInstanceAddress(part);
        const textX = symbolCenterX + addressOffsetX;
        const textY = symbolCenterY + addressOffsetY;
        const partCenterX = (partBounds.minX + partBounds.maxX) / 2;
        const partCenterY = (partBounds.minY + partBounds.maxY) / 2;
        const transform = `translate(${symbolCenterX} ${symbolCenterY}) rotate(${display.rotation}) scale(${scale}) translate(${-partCenterX} ${-partCenterY})`;
        return (
          <g key={`part-reference-${parent.componentId}-${part.componentId}`} className="component-part-reference">
            <g transform={transform}>{partItem.shapes.map((shape) => renderShape(shape, true))}</g>
            {address && (
              <text
                className="component-link-label"
                x={textX}
                y={textY}
                fontSize={3}
                dominantBaseline="middle"
                transform={addressRotation ? `rotate(${addressRotation} ${textX} ${textY})` : undefined}
                pointerEvents="all"
                onPointerDown={(event) =>
                  handleComponentLinkPointerDown(event, {
                    pageIndex: partItem.pageIndex,
                    bounds: partItem.bounds
                  })
                }
              >
                {address}
              </text>
            )}
          </g>
        );
      });
    });

  function renderShape(shape: Shape, suppressPointer: boolean): React.ReactNode {
    const isSelected = !suppressPointer && selection.includes(shape.id);
    const className = isSelected ? "shape selected" : "shape";
    const { strokeDasharray, strokeLinecap } = getLineStyleProps(shape.lineStyle);
    const hitWidth = Math.max((selectionProximityPx * 2) / view.scale, shape.lineWidth);
    if (shape.type === "group") {
      const bounds = getShapeBounds(shape);
      const visibleChildren = shape.children.filter((child) => isShapeVisible(child));
      const groupHitProps = suppressPointer
        ? { pointerEvents: "none" as const }
        : { onPointerDown: (event: ReactPointerEvent<SVGElement>) => handleShapePointerDown(event, shape) };
      const groupHitPadding = selectionProximityPx / view.scale;
      const groupHitWidth = Math.max(1, bounds.maxX - bounds.minX);
      const groupHitHeight = Math.max(1, bounds.maxY - bounds.minY);
      return (
        <g key={shape.id}>
          <rect
            x={bounds.minX - groupHitPadding}
            y={bounds.minY - groupHitPadding}
            width={groupHitWidth + groupHitPadding * 2}
            height={groupHitHeight + groupHitPadding * 2}
            className="group-hit"
            fill="rgba(0,0,0,0.001)"
            {...groupHitProps}
          />
          {visibleChildren.map((child) => renderShape(child, true))}
        </g>
      );
    }
    const pointerProps = suppressPointer ? { pointerEvents: "none" as const } : {};
    const hitProps = suppressPointer
      ? { pointerEvents: "none" as const }
      : { pointerEvents: "stroke" as const, onPointerDown: (event: ReactPointerEvent<SVGElement>) => handleShapePointerDown(event, shape) };
    if (shape.type === "line") {
      return (
        <g key={shape.id}>
          <line
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            stroke="transparent"
            strokeWidth={hitWidth}
            strokeLinecap="round"
            {...hitProps}
          />
          <line
            className={className}
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            stroke={shape.lineColor}
            strokeWidth={shape.lineWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
            pointerEvents="none"
            {...pointerProps}
          />
        </g>
      );
    }
    if (shape.type === "potential") {
      const dx = shape.x2 - shape.x1;
      const dy = shape.y2 - shape.y1;
      const renderInfo = potentialRender?.[shape.id];
      const startLabel = (renderInfo?.startVisible ?? true)
        ? buildPotentialEdgeLabel(shape.potentialName ?? "", renderInfo?.startLink?.address)
        : "";
      const endLabel = (renderInfo?.endVisible ?? true)
        ? buildPotentialEdgeLabel(shape.potentialName ?? "", renderInfo?.endLink?.address)
        : "";
      const showMidLabel = renderInfo?.showMidLabel ?? true;
      const midLabel = showMidLabel
        ? buildPotentialMidLabel(shape.potentialNumber, shape.potentialDiameter ?? null)
        : "";
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
      const labelPointerEvents = suppressPointer ? "none" : "all";
      const angleRad = (rotation * Math.PI) / 180;
      const textDirX = Math.cos(angleRad);
      const textDirY = Math.sin(angleRad);
      const startDot = -ux * textDirX - uy * textDirY;
      const endDot = ux * textDirX + uy * textDirY;
      const startLabelAlign = startDot >= 0 ? "start" : "end";
      const endLabelAlign = endDot >= 0 ? "start" : "end";
      const startArrowVisible = renderInfo?.startVisible ?? true;
      const endArrowVisible = renderInfo?.endVisible ?? true;
      const startLabelVisible = renderInfo?.startLabelVisible ?? startArrowVisible;
      const endLabelVisible = renderInfo?.endLabelVisible ?? endArrowVisible;
      const startArrowDirection = renderInfo?.startArrow ?? "forward";
      const endArrowDirection = renderInfo?.endArrow ?? "forward";
      const startArrowSegments = startArrowVisible
        ? getPotentialArrowSegments(shape.x1, shape.y1, dx, dy, startArrowDirection)
        : [];
      const endArrowSegments = endArrowVisible
        ? getPotentialArrowSegments(shape.x2, shape.y2, dx, dy, endArrowDirection)
        : [];

      const handleLabelPointerDown = (
        event: ReactPointerEvent<SVGElement>,
        linkTarget?: { pageIndex: number; bounds: Bounds }
      ) => {
        if (suppressPointer) return;
        const isModifier = event.metaKey || event.ctrlKey;
        if (linkTarget && onNavigateToLink && isModifier) {
          event.preventDefault();
          event.stopPropagation();
          onNavigateToLink(linkTarget.pageIndex, linkTarget.bounds);
          return;
        }
        handleShapePointerDown(event, shape, true);
      };

      const renderLabel = (
        text: string,
        x: number,
        y: number,
        align: "start" | "middle" | "end",
        linkTarget?: { pageIndex: number; bounds: Bounds },
        fontSize?: number
      ) => {
        if (!text) return null;
        const transform = rotation !== 0 ? `rotate(${rotation} ${x} ${y})` : undefined;
        return (
          <text
            className="potential-label"
            x={x}
            y={y}
            fill={shape.lineColor}
            fontSize={fontSize ?? potentialEdgeFontSize}
            fontFamily="Space Grotesk"
            textAnchor={align}
            dominantBaseline="middle"
            pointerEvents={labelPointerEvents}
            transform={transform}
            onPointerDown={(event) => handleLabelPointerDown(event as ReactPointerEvent<SVGElement>, linkTarget)}
          >
            {text}
          </text>
        );
      };

      return (
        <g key={shape.id}>
          <line
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            stroke="transparent"
            strokeWidth={hitWidth}
            strokeLinecap="round"
            {...hitProps}
          />
          <line
            className={className}
            x1={shape.x1}
            y1={shape.y1}
            x2={shape.x2}
            y2={shape.y2}
            stroke={shape.lineColor}
            strokeWidth={shape.lineWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
            pointerEvents="none"
            {...pointerProps}
          />
          {startArrowSegments.map((segment, index) => (
            <line
              key={`arrow-start-${shape.id}-${index}`}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={shape.lineColor}
              strokeWidth={shape.lineWidth}
              strokeLinecap={strokeLinecap}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
          {endArrowSegments.map((segment, index) => (
            <line
              key={`arrow-end-${shape.id}-${index}`}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={shape.lineColor}
              strokeWidth={shape.lineWidth}
              strokeLinecap={strokeLinecap}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
          {startLabelVisible &&
            renderLabel(startLabel, startX, startY, startLabelAlign, renderInfo?.startLink, potentialEdgeFontSize)}
          {endLabelVisible &&
            renderLabel(endLabel, endX, endY, endLabelAlign, renderInfo?.endLink, potentialEdgeFontSize)}
          {renderLabel(midLabel, midX, midY, "middle", undefined, potentialMidFontSize)}
        </g>
      );
    }
    if (shape.type === "circle") {
      return (
        <g key={shape.id}>
          <circle
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            stroke="transparent"
            strokeWidth={hitWidth}
            fill="transparent"
            {...hitProps}
          />
          <circle
            className={className}
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            stroke={shape.lineColor}
            strokeWidth={shape.lineWidth}
            fill={shape.fill ?? "transparent"}
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
            pointerEvents="none"
            {...pointerProps}
          />
        </g>
      );
    }
    if (shape.type === "arc") {
      return (
        <g key={shape.id}>
          <path
            d={arcToPath(shape)}
            stroke="transparent"
            strokeWidth={hitWidth}
            strokeLinecap="round"
            fill="none"
            {...hitProps}
          />
          <path
            className={className}
            d={arcToPath(shape)}
            stroke={shape.lineColor}
            strokeWidth={shape.lineWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
            pointerEvents="none"
            {...pointerProps}
          />
        </g>
      );
    }
    if (shape.type === "text") {
      const resolvedText = replacePlaceholders(shape.text, {
        project: pdfSettings.project,
        drawing: pdfSettings.drawing,
        author: pdfSettings.author,
        page: pageIndex + 1,
        totalPages
      });
      const linkTarget = shape.linkEnabled ? parseMarkerAddress(shape.linkTarget, totalPages, layout) : null;
      const handleTextPointerDown = (event: React.PointerEvent<SVGElement>) => {
        if (suppressPointer) return;
        if ((event.metaKey || event.ctrlKey) && linkTarget && onNavigateToLink) {
          event.preventDefault();
          event.stopPropagation();
          onNavigateToLink(linkTarget.pageIndex, linkTarget.bounds);
          return;
        }
        handleShapePointerDown(event, shape, true);
      };
      return (
        <g key={shape.id}>
          <text
            className={className}
            x={shape.x}
            y={shape.y}
            fill={shape.lineColor}
            fontSize={shape.fontSize}
            fontFamily={shape.fontFamily}
            pointerEvents={suppressPointer ? "none" : "all"}
            onPointerDown={handleTextPointerDown}
          >
            {resolvedText}
          </text>
        </g>
      );
    }
    if (shape.type === "pin") {
      const cross = 1;
      const textWidth = shape.tag.length * (shape.tagFontSize * 0.6);
      const { strokeDasharray, strokeLinecap } = getLineStyleProps(shape.lineStyle);
      const tagBounds = {
        minX: shape.tagX,
        minY: shape.tagY - shape.tagFontSize,
        maxX: shape.tagX + textWidth,
        maxY: shape.tagY
      };
      return (
        <g key={shape.id}>
          <line
            x1={shape.x - cross}
            y1={shape.y - cross}
            x2={shape.x + cross}
            y2={shape.y + cross}
            stroke="transparent"
            strokeWidth={hitWidth}
            strokeLinecap="round"
            {...hitProps}
          />
          <line
            x1={shape.x - cross}
            y1={shape.y + cross}
            x2={shape.x + cross}
            y2={shape.y - cross}
            stroke="transparent"
            strokeWidth={hitWidth}
            strokeLinecap="round"
            {...hitProps}
          />
          {showPinConnection && (
            <>
              <line
                className={className}
                x1={shape.x - cross}
                y1={shape.y - cross}
                x2={shape.x + cross}
                y2={shape.y + cross}
                stroke={shape.lineColor}
                strokeWidth={shape.lineWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap={strokeLinecap}
                pointerEvents="none"
                {...pointerProps}
              />
              <line
                className={className}
                x1={shape.x - cross}
                y1={shape.y + cross}
                x2={shape.x + cross}
                y2={shape.y - cross}
                stroke={shape.lineColor}
                strokeWidth={shape.lineWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap={strokeLinecap}
                pointerEvents="none"
                {...pointerProps}
              />
            </>
          )}
          <rect
            x={tagBounds.minX - hitWidth}
            y={tagBounds.minY - hitWidth}
            width={Math.max(1, tagBounds.maxX - tagBounds.minX) + hitWidth * 2}
            height={Math.max(1, tagBounds.maxY - tagBounds.minY) + hitWidth * 2}
            fill="transparent"
            pointerEvents={suppressPointer ? "none" : "all"}
            onPointerDown={(event) => handlePinTagPointerDown(event, shape)}
          />
          <text
            className={className}
            x={shape.tagX}
            y={shape.tagY}
            fill={shape.lineColor}
            fontSize={shape.tagFontSize}
            fontFamily="Space Grotesk"
            pointerEvents={suppressPointer ? "none" : "all"}
            onPointerDown={(event) => handlePinTagPointerDown(event, shape)}
          >
            {shape.tag}
          </text>
        </g>
      );
    }
    return null;
  }

  const draftShape = draft
    ? (
      draft.type === "line" ? (() => {
        const { strokeDasharray, strokeLinecap } = getLineStyleProps(draft.lineStyle);
        return (
          <line
            x1={draft.x1}
            y1={draft.y1}
            x2={draft.x2}
            y2={draft.y2}
            className="shape draft"
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
          />
        );
      })() : draft.type === "potential" ? (() => {
        const { strokeDasharray, strokeLinecap } = getLineStyleProps(draft.lineStyle);
        return (
          <line
            x1={draft.x1}
            y1={draft.y1}
            x2={draft.x2}
            y2={draft.y2}
            className="shape draft"
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
          />
        );
      })() : draft.type === "circle" ? (() => {
        const { strokeDasharray, strokeLinecap } = getLineStyleProps(draft.lineStyle);
        return (
          <circle
            cx={draft.cx}
            cy={draft.cy}
            r={draft.r}
            className="shape draft"
            strokeDasharray={strokeDasharray}
            strokeLinecap={strokeLinecap}
          />
        );
      })() : null
    )
    : null;

  const arcPreview = arcDraft && arcDraft.start && arcDraft.end ? (() => {
    const startAngle = arcDraft.startAngle ?? angleBetween(arcDraft.center, arcDraft.start);
    const endAngle = arcDraft.endAngle ?? angleBetween(arcDraft.center, arcDraft.end);
    const arc: Shape = {
      id: "draft-arc",
      type: "arc",
      layerId: activeLayer?.id ?? "",
      lineColor: defaultLineColor,
      lineWidth: 1,
      fill: defaultFill,
      lineStyle: defaultLineStyle,
      cx: arcDraft.center.x,
      cy: arcDraft.center.y,
      r: distance(arcDraft.center, arcDraft.start),
      startAngle,
      endAngle
    };
    const { strokeDasharray, strokeLinecap } = getLineStyleProps(arc.lineStyle);
    return (
      <path
        d={arcToPath(arc)}
        className="shape draft"
        strokeDasharray={strokeDasharray}
        strokeLinecap={strokeLinecap}
      />
    );
  })() : null;

  const showSelectionBounds = tool === "select" && selectionBounds && !marquee && !isSingleLineOrPotential;

  const selectionHitRect = showSelectionBounds ? (() => {
    const width = Math.max(1, selectionBounds.maxX - selectionBounds.minX);
    const height = Math.max(1, selectionBounds.maxY - selectionBounds.minY);
    const padding = Math.max(6 / view.scale, 3);
    return (
      <rect
        x={selectionBounds.minX - padding}
        y={selectionBounds.minY - padding}
        width={width + padding * 2}
        height={height + padding * 2}
        className="selection-hit"
        fill="rgba(0,0,0,0.001)"
        pointerEvents="all"
        onPointerDown={handleSelectionBoundsPointerDown}
      />
    );
  })() : null;

  const selectionBoundsRect = showSelectionBounds ? (() => {
    const width = Math.max(1, selectionBounds.maxX - selectionBounds.minX);
    const height = Math.max(1, selectionBounds.maxY - selectionBounds.minY);
    return (
      <rect
        x={selectionBounds.minX}
        y={selectionBounds.minY}
        width={width}
        height={height}
        className="selection-bounds"
      />
    );
  })() : null;

  const handleSize = 8 / view.scale;
  const handleOffset = handleSize / 2;

  const selectionHandles = tool === "select" && selectionBounds && !marquee && canResizeSelection ? (() => {
    const { minX, minY, maxX, maxY } = selectionBounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const handles: { id: ResizeHandle; x: number; y: number; cursor: string }[] = [
      { id: "nw", x: minX, y: minY, cursor: "nwse-resize" },
      { id: "n", x: midX, y: minY, cursor: "ns-resize" },
      { id: "ne", x: maxX, y: minY, cursor: "nesw-resize" },
      { id: "e", x: maxX, y: midY, cursor: "ew-resize" },
      { id: "se", x: maxX, y: maxY, cursor: "nwse-resize" },
      { id: "s", x: midX, y: maxY, cursor: "ns-resize" },
      { id: "sw", x: minX, y: maxY, cursor: "nesw-resize" },
      { id: "w", x: minX, y: midY, cursor: "ew-resize" }
    ];

    return handles.map((handle) => (
      <rect
        key={handle.id}
        x={handle.x - handleOffset}
        y={handle.y - handleOffset}
        width={handleSize}
        height={handleSize}
        rx={2}
        className="resize-handle"
        style={{ cursor: handle.cursor }}
        onPointerDown={(event) => handleResizePointerDown(event, handle.id)}
      />
    ));
  })() : null;

  const endpointHandles = tool === "select" && !marquee && isSingleLineOrPotential ? (() => {
    const shape = selectedShapes[0];
    if (shape.type !== "line" && shape.type !== "potential") return null;
    const radius = 5 / view.scale;
    return (
      <g>
        <circle
          className="endpoint-handle"
          cx={shape.x1}
          cy={shape.y1}
          r={radius}
          onPointerDown={(event) => handleEndpointPointerDown(event, shape, "start")}
          onPointerMove={handleEndpointPointerMove}
          onPointerUp={handleEndpointPointerUp}
        />
        <circle
          className="endpoint-handle"
          cx={shape.x2}
          cy={shape.y2}
          r={radius}
          onPointerDown={(event) => handleEndpointPointerDown(event, shape, "end")}
          onPointerMove={handleEndpointPointerMove}
          onPointerUp={handleEndpointPointerUp}
        />
      </g>
    );
  })() : null;

  const marqueeRect = marquee ? (() => {
    const minX = Math.min(marquee.start.x, marquee.end.x);
    const minY = Math.min(marquee.start.y, marquee.end.y);
    const width = Math.abs(marquee.start.x - marquee.end.x);
    const height = Math.abs(marquee.start.y - marquee.end.y);
    return <rect x={minX} y={minY} width={width} height={height} className="marquee" />;
  })() : null;

  return (
    <div className="canvas-root" onKeyDown={handleKeyDown} tabIndex={0} ref={containerRef}>
      <svg
        ref={svgRef}
        className={isDragOver ? "canvas drag-over" : placingComponentId ? "canvas placing" : "canvas"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={pageWidth} height={pageHeight} />
          </clipPath>
        </defs>
        <rect width="100%" height="100%" fill="#0b0f12" />
        <g transform={`translate(${view.offsetX} ${view.offsetY}) scale(${view.scale})`}>
          <rect
            x={0}
            y={0}
            width={pageWidth}
            height={pageHeight}
            className="paper-rect"
          />
          {gridPath && (
            <path
              d={gridPath}
              fill="none"
              stroke={gridColor}
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          <rect
            x={frameX}
            y={frameY}
            width={frameWidth}
            height={frameHeight}
            className="paper-frame"
          />
          {showMarkers && (
            <>
              <line
                x1={frameX + markerBandWidth}
                y1={frameY}
                x2={frameX + markerBandWidth}
                y2={frameY + frameHeight}
                className="paper-frame"
              />
              <line
                x1={frameX}
                y1={frameY + markerBandHeight}
                x2={frameX + frameWidth}
                y2={frameY + markerBandHeight}
                className="paper-frame"
              />
              {Array.from({ length: markerCols - 1 }, (_, index) => {
                const x = frameX + markerBandWidth + columnWidth * (index + 1);
                return (
                  <line
                    key={`col-${index}`}
                    x1={x}
                    y1={frameY}
                    x2={x}
                    y2={frameY + markerBandHeight}
                    className="paper-frame"
                  />
                );
              })}
              {Array.from({ length: markerRows - 1 }, (_, index) => {
                const y = frameY + markerBandHeight + rowHeight * (index + 1);
                return (
                  <line
                    key={`row-${index}`}
                    x1={frameX}
                    y1={y}
                    x2={frameX + markerBandWidth}
                    y2={y}
                    className="paper-frame"
                  />
                );
              })}
              {Array.from({ length: markerCols }, (_, index) => {
                const x = frameX + markerBandWidth + columnWidth * (index + 0.5);
                return (
                  <text
                    key={`col-label-${index}`}
                    x={x}
                    y={frameY + markerBandHeight / 2}
                    className="paper-mark"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {index + 1}
                  </text>
                );
              })}
              {Array.from({ length: markerRows }, (_, index) => {
                const y = frameY + markerBandHeight + rowHeight * (index + 0.5);
                return (
                  <text
                    key={`row-label-${index}`}
                    x={frameX + markerBandWidth / 2}
                    y={y}
                    className="paper-mark"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {String.fromCharCode(65 + index)}
                  </text>
                );
              })}
            </>
          )}
          {renderedShapes}
          <g className="component-cross-references">
            {renderedPartReferences}
            {renderedParentLinks}
          </g>
          <g className="component-labels" pointerEvents="none">
            {renderedComponentLabels}
          </g>
          {potentialJunctions.length > 0 && (
            <g className="potential-junctions" pointerEvents="none">
              {potentialJunctions.map((junction) => (
                <circle
                  key={`junction-${junction.key}`}
                  cx={junction.point.x}
                  cy={junction.point.y}
                  r={potentialJunctionRadius}
                  fill={junction.color}
                />
              ))}
            </g>
          )}
          {tool === "potential" && pinHover && (
            <circle
              cx={pinHover.x}
              cy={pinHover.y}
              r={pinHoverRadius}
              fill="none"
              stroke="#36d36c"
              strokeWidth={0.6}
              pointerEvents="none"
            />
          )}
          {selectionHitRect}
          {selectionBoundsRect}
          {selectionHandles}
          {endpointHandles}
          {draftShape}
          {arcPreview}
          {marqueeRect}
        </g>
      </svg>
    </div>
  );
}










