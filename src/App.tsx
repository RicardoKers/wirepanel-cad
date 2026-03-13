import { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import type { CadFile, Component, Layer, Page, PdfSettings, Point, Shape, Tool, ViewState } from "./models";
import { createId } from "./utils/id";
import { getShapeBounds, translateShape } from "./utils/geometry";
import { replacePlaceholders } from "./utils/text";
import { formatMarkerAddress, getMarkerLayout, markerToBounds, pointToMarker } from "./utils/markers";
import CanvasView from "./components/CanvasView";
import Toolbar from "./components/Toolbar";
import ComponentsPanel from "./components/ComponentsPanel";
import RightPanel from "./components/RightPanel";

const initialLayers: Layer[] = [
  {
    id: createId("layer"),
    name: "Layer 1",
    visible: true,
    locked: false
  }
];

const initialPdfSettings: PdfSettings = {
  size: "A4",
  orientation: "landscape",
  marginLeftMm: 5,
  marginRightMm: 5,
  marginTopMm: 5,
  marginBottomMm: 5,
  project: "Projeto Eletrico",
  drawing: "Diagrama",
  author: "Equipe"
};

type AlignMode = "left" | "right" | "top" | "bottom" | "centerX" | "centerY";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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

type PotentialListItem = {
  number: number;
  name: string;
  diameter: number | null;
  pageId: string;
  pageIndex: number;
  bounds: Bounds;
};

type PotentialSharedChanges = {
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  potentialName?: string;
  potentialDiameter?: number | null;
  layerId?: string;
};

type PotentialEndpointInfo = {
  key: string;
  number: number;
  shared: PotentialSharedChanges;
};

type PotentialArrowDirection = "forward" | "backward";

type JsPdfWithLineDash = jsPDF & {
  setLineDash?: (dashArray: number[], dashPhase?: number) => jsPDF;
};


const initialPageId = createId("page");

const initialPages: Page[] = [
  { id: initialPageId, name: "Page 1", shapes: [] }
];

export default function App() {
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [activeLayerId, setActiveLayerId] = useState<string>(initialLayers[0].id);
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [activePageId, setActivePageId] = useState<string>(initialPageId);
  const [components, setComponents] = useState<Component[]>([]);
  const [selectionByPage, setSelectionByPage] = useState<Record<string, string[]>>({});
  const [tool, setTool] = useState<Tool>("select");
  const [viewByPage, setViewByPage] = useState<Record<string, ViewState>>({});
  const [gridSize, setGridSize] = useState(2.5);
  const [gridColor, setGridColor] = useState("#e7edf5");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showPinConnection, setShowPinConnection] = useState(true);
  const [placingComponentId, setPlacingComponentId] = useState<string | null>(null);
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>(initialPdfSettings);
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null);
  const [pageMenu, setPageMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [navigateTarget, setNavigateTarget] = useState<{ pageId: string; bounds: Bounds } | null>(null);
  const resizeRef = useRef<{ bounds: Bounds; shapes: Shape[] } | null>(null);
  const clipboardRef = useRef<{ shapes: Shape[]; offsetX: number; offsetY: number } | null>(null);
  const historyRef = useRef<{ past: AppSnapshot[]; future: AppSnapshot[] }>({ past: [], future: [] });
  const isRestoringRef = useRef(false);
  const lastSerializedRef = useRef<string>("");
  const historyPausedRef = useRef(false);

  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? layers[0],
    [layers, activeLayerId]
  );

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );
  const activePageIndex = useMemo(
    () => Math.max(0, pages.findIndex((page) => page.id === activePageId)),
    [pages, activePageId]
  );

  const shapes = activePage?.shapes ?? [];
  const selection = selectionByPage[activePageId] ?? [];
  const view = viewByPage[activePageId] ?? { scale: 1, offsetX: 0, offsetY: 0 };
  const shouldAutoFit = !viewByPage[activePageId];

  const { potentialRender, potentialList, nextPotentialNumber } = useMemo(() => {
    type Endpoint = {
      key: string;
      point: Point;
      cell: ReturnType<typeof pointToMarker>;
    };

    type PotentialSegment = {
      id: string;
      number: number;
      name: string;
      diameter: number | null;
      pageId: string;
      pageIndex: number;
      start: Endpoint;
      end: Endpoint;
      length: number;
      bounds: Bounds;
    };

    type PotentialComponent = {
      number: number;
      pageId: string;
      pageIndex: number;
      segmentIds: string[];
      startEndpoint: Endpoint | null;
      endEndpoint: Endpoint | null;
      largestSegmentId: string;
      orderEndpoint: Endpoint | null;
    };

    const layout = getMarkerLayout(pdfSettings);
    const segments: PotentialSegment[] = [];

    const roundCoord = (value: number) => Math.round(value * 1000) / 1000;
    const makeKey = (point: Point) => `${roundCoord(point.x)}|${roundCoord(point.y)}`;
    const getBounds = (start: Point, end: Point): Bounds => ({
      minX: Math.min(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxX: Math.max(start.x, end.x),
      maxY: Math.max(start.y, end.y)
    });

    const visitShape = (shape: Shape, pageId: string, pageIndex: number) => {
      if (shape.type === "group") {
        shape.children.forEach((child) => visitShape(child, pageId, pageIndex));
        return;
      }
      if (shape.type !== "potential") return;
      const startPoint = { x: shape.x1, y: shape.y1 };
      const endPoint = { x: shape.x2, y: shape.y2 };
      const start: Endpoint = {
        key: makeKey(startPoint),
        point: startPoint,
        cell: pointToMarker(startPoint, layout)
      };
      const end: Endpoint = {
        key: makeKey(endPoint),
        point: endPoint,
        cell: pointToMarker(endPoint, layout)
      };
      segments.push({
        id: shape.id,
        number: shape.potentialNumber,
        name: shape.potentialName ?? "",
        diameter: shape.potentialDiameter ?? null,
        pageId,
        pageIndex,
        start,
        end,
        length: Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y),
        bounds: getBounds(startPoint, endPoint)
      });
    };

    const collectPinsByPage = () => {
      const map = new Map<string, Set<string>>();
      const addPoint = (pageId: string, point: Point) => {
        const key = makeKey(point);
        const set = map.get(pageId);
        if (set) {
          set.add(key);
        } else {
          map.set(pageId, new Set([key]));
        }
      };
      const visitPin = (shape: Shape, pageId: string) => {
        if (shape.type === "group") {
          shape.children.forEach((child) => visitPin(child, pageId));
          return;
        }
        if (shape.type !== "pin") return;
        addPoint(pageId, { x: shape.x, y: shape.y });
      };
      pages.forEach((page) => {
        page.shapes.forEach((shape) => visitPin(shape, page.id));
      });
      return map;
    };

    pages.forEach((page, pageIndex) => {
      page.shapes.forEach((shape) => visitShape(shape, page.id, pageIndex));
    });

    const compareEndpoints = (a: Endpoint, b: Endpoint) => {
      const aCol = a.cell ? a.cell.col : Number.MAX_SAFE_INTEGER;
      const bCol = b.cell ? b.cell.col : Number.MAX_SAFE_INTEGER;
      if (aCol !== bCol) return aCol - bCol;
      const aRow = a.cell ? a.cell.row : Number.MAX_SAFE_INTEGER;
      const bRow = b.cell ? b.cell.row : Number.MAX_SAFE_INTEGER;
      if (aRow !== bRow) return aRow - bRow;
      if (a.point.x !== b.point.x) return a.point.x - b.point.x;
      return a.point.y - b.point.y;
    };

    const compareSegments = (a: PotentialSegment, b: PotentialSegment) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      return compareEndpoints(a.start, b.start);
    };

    const pinsByPage = collectPinsByPage();
    const segmentsByNumber = new Map<number, PotentialSegment[]>();
    segments.forEach((segment) => {
      const bucket = segmentsByNumber.get(segment.number);
      if (bucket) {
        bucket.push(segment);
      } else {
        segmentsByNumber.set(segment.number, [segment]);
      }
    });

    const potentialRender: Record<string, PotentialRenderInfo> = {};
    const potentialList: PotentialListItem[] = [];

    segmentsByNumber.forEach((numberSegments, number) => {
      const sortedSegments = [...numberSegments].sort(compareSegments);
        if (sortedSegments.length > 0) {
          const first = sortedSegments[0];
          potentialList.push({
            number,
            name: first.name,
            diameter: first.diameter,
            pageId: first.pageId,
            pageIndex: first.pageIndex,
            bounds: first.bounds
          });
        }

      const segmentsByPage = new Map<string, PotentialSegment[]>();
      numberSegments.forEach((segment) => {
        const bucket = segmentsByPage.get(segment.pageId);
        if (bucket) {
          bucket.push(segment);
        } else {
          segmentsByPage.set(segment.pageId, [segment]);
        }
      });

      const components: PotentialComponent[] = [];

      segmentsByPage.forEach((pageSegments) => {
        const segmentById = new Map(pageSegments.map((segment) => [segment.id, segment]));
        const endpointCounts = new Map<string, number>();
        const endpointToSegments = new Map<string, string[]>();

        pageSegments.forEach((segment) => {
          [segment.start, segment.end].forEach((endpoint) => {
            endpointCounts.set(endpoint.key, (endpointCounts.get(endpoint.key) ?? 0) + 1);
            const list = endpointToSegments.get(endpoint.key);
            if (list) {
              list.push(segment.id);
            } else {
              endpointToSegments.set(endpoint.key, [segment.id]);
            }
          });
        });

        const visited = new Set<string>();
        pageSegments.forEach((segment) => {
          if (visited.has(segment.id)) return;
          const queue = [segment.id];
          const componentSegmentIds: string[] = [];
          while (queue.length > 0) {
            const currentId = queue.pop();
            if (!currentId || visited.has(currentId)) continue;
            visited.add(currentId);
            componentSegmentIds.push(currentId);
            const current = segmentById.get(currentId);
            if (!current) continue;
            [current.start.key, current.end.key].forEach((key) => {
              const neighbors = endpointToSegments.get(key) ?? [];
              neighbors.forEach((neighborId) => {
                if (!visited.has(neighborId)) queue.push(neighborId);
              });
            });
          }

          const componentSegments = componentSegmentIds
            .map((id) => segmentById.get(id))
            .filter((item): item is PotentialSegment => Boolean(item));

          const externalEndpoints: Endpoint[] = [];
          componentSegments.forEach((item) => {
            const startCount = endpointCounts.get(item.start.key) ?? 0;
            const endCount = endpointCounts.get(item.end.key) ?? 0;
            if (startCount === 1) externalEndpoints.push(item.start);
            if (endCount === 1) externalEndpoints.push(item.end);
          });

          const startEndpoint =
            externalEndpoints.length > 0 ? [...externalEndpoints].sort(compareEndpoints)[0] : null;
          const endEndpoint =
            externalEndpoints.length > 0
              ? [...externalEndpoints].sort(compareEndpoints)[externalEndpoints.length - 1]
              : null;

          const largestSegment = componentSegments.reduce((acc, item) =>
            item.length > acc.length ? item : acc
          );

          const orderEndpoint = startEndpoint ?? componentSegments[0]?.start ?? null;

          components.push({
            number,
            pageId: componentSegments[0]?.pageId ?? "",
            pageIndex: componentSegments[0]?.pageIndex ?? 0,
            segmentIds: componentSegmentIds,
            startEndpoint,
            endEndpoint,
            largestSegmentId: largestSegment.id,
            orderEndpoint
          });

          const getEndpointRole = (key: string) => {
            if (startEndpoint && key === startEndpoint.key) return "start";
            if (endEndpoint && key === endEndpoint.key) return "end";
            return null;
          };

          componentSegments.forEach((item) => {
            const pinsOnPage = pinsByPage.get(item.pageId) ?? new Set<string>();
            const startConnectedToPin = pinsOnPage.has(item.start.key);
            const endConnectedToPin = pinsOnPage.has(item.end.key);
            const startVisible = (endpointCounts.get(item.start.key) ?? 0) === 1 && !startConnectedToPin;
            const endVisible = (endpointCounts.get(item.end.key) ?? 0) === 1 && !endConnectedToPin;
            const startLabelVisible = startVisible;
            const endLabelVisible = endVisible;
            const startRole = startVisible ? getEndpointRole(item.start.key) : null;
            const endRole = endVisible ? getEndpointRole(item.end.key) : null;
            let startArrow: PotentialArrowDirection | undefined =
              startRole === "start" ? "forward" : startRole === "end" ? "backward" : undefined;
            let endArrow: PotentialArrowDirection | undefined =
              endRole === "start" ? "backward" : endRole === "end" ? "forward" : undefined;
            const isVertical = Math.abs(item.start.point.x - item.end.point.x) <= 0.001;
            if (isVertical) {
              startArrow = startVisible ? "forward" : undefined;
              endArrow = endVisible ? "forward" : undefined;
            }
            potentialRender[item.id] = {
              startVisible,
              endVisible,
              showMidLabel: item.id === largestSegment.id,
              startLabelVisible,
              endLabelVisible,
              startArrow,
              endArrow
            };
          });
        });
      });

      const sortedComponents = components.sort((a, b) => {
        if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
        if (!a.orderEndpoint || !b.orderEndpoint) return 0;
        return compareEndpoints(a.orderEndpoint, b.orderEndpoint);
      });

      sortedComponents.forEach((component, index) => {
        const prev = sortedComponents[index - 1];
        const next = sortedComponents[index + 1];
        const fromLink =
          prev?.endEndpoint?.cell
            ? {
              address: formatMarkerAddress(prev.pageIndex, prev.endEndpoint.cell),
              pageIndex: prev.pageIndex,
              bounds: markerToBounds(prev.endEndpoint.cell, layout)
            }
            : undefined;
        const toLink =
          next?.startEndpoint?.cell
            ? {
              address: formatMarkerAddress(next.pageIndex, next.startEndpoint.cell),
              pageIndex: next.pageIndex,
              bounds: markerToBounds(next.startEndpoint.cell, layout)
            }
            : undefined;

        const applyLinkToSegment = (
          segment: PotentialSegment,
          info: PotentialRenderInfo,
          endpointKey: string,
          link: PotentialLinkTarget
        ) => {
          if (info.startVisible && endpointKey === segment.start.key) {
            info.startLink = link;
          }
          if (info.endVisible && endpointKey === segment.end.key) {
            info.endLink = link;
          }
        };

        component.segmentIds.forEach((segmentId) => {
          const segment = numberSegments.find((item) => item.id === segmentId);
          if (!segment) return;
          const info = potentialRender[segmentId];
          if (!info) return;
          if (fromLink && component.startEndpoint) {
            applyLinkToSegment(segment, info, component.startEndpoint.key, fromLink);
          }
          if (toLink && component.endEndpoint) {
            applyLinkToSegment(segment, info, component.endEndpoint.key, toLink);
          }
        });
      });
    });

    potentialList.sort((a, b) => a.number - b.number);

    const maxNumber = segments.reduce((acc, item) => Math.max(acc, item.number), 0);

    return {
      potentialRender,
      potentialList,
      nextPotentialNumber: maxNumber + 1
    };
  }, [pages, pdfSettings]);

  const selectedShape = useMemo(() => {
    if (selection.length !== 1) return null;
    return shapes.find((shape) => shape.id === selection[0]) ?? null;
  }, [selection, shapes]);
  const canGroupSelection = selection.length > 1;
  const canUngroupSelection = selection.length === 1 && selectedShape?.type === "group";
  const canMoveSelection = selection.length > 0;

  type AppSnapshot = {
    layers: Layer[];
    pages: Page[];
    components: Component[];
    activeLayerId: string;
    activePageId: string;
    tool: Tool;
    gridSize: number;
    gridColor: string;
    snapEnabled: boolean;
    showPinConnection: boolean;
    placingComponentId: string | null;
    pdfSettings: PdfSettings;
  };

  function buildSnapshot(): AppSnapshot {
    return {
      layers,
      pages,
      components,
      activeLayerId,
      activePageId,
      tool,
      gridSize,
      gridColor,
      snapEnabled,
      showPinConnection,
      placingComponentId,
      pdfSettings
    };
  }

  function cloneSnapshot(snapshot: AppSnapshot): AppSnapshot {
    return JSON.parse(JSON.stringify(snapshot)) as AppSnapshot;
  }

  function pushSnapshot(snapshot: AppSnapshot) {
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSerializedRef.current) return;
    historyRef.current.past.push(cloneSnapshot(snapshot));
    historyRef.current.future = [];
    lastSerializedRef.current = serialized;
  }

  function applySnapshot(snapshot: AppSnapshot) {
    setLayers(snapshot.layers);
    setPages(snapshot.pages);
    setComponents(snapshot.components);
    setActiveLayerId(snapshot.activeLayerId);
    setActivePageId(snapshot.activePageId);
    setTool(snapshot.tool);
    setGridSize(snapshot.gridSize);
    setGridColor(snapshot.gridColor);
    setSnapEnabled(snapshot.snapEnabled);
    setShowPinConnection(snapshot.showPinConnection);
    setPlacingComponentId(snapshot.placingComponentId);
    setPdfSettings(snapshot.pdfSettings);
  }

  function handleUndo() {
    const history = historyRef.current;
    if (history.past.length <= 1) return;
    const current = history.past.pop();
    if (!current) return;
    history.future.push(current);
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    isRestoringRef.current = true;
    applySnapshot(cloneSnapshot(previous));
  }

  function handleRedo() {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(next);
    isRestoringRef.current = true;
    applySnapshot(cloneSnapshot(next));
  }

  useEffect(() => {
    function handleClick() {
      setSelectionMenu(null);
      setPageMenu(null);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectionMenu(null);
        setPageMenu(null);
      }
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    setSelectionMenu(null);
  }, [selection, activePageId]);

  useEffect(() => {
    const snapshot = buildSnapshot();
    if (isRestoringRef.current) {
      lastSerializedRef.current = JSON.stringify(snapshot);
      isRestoringRef.current = false;
      return;
    }
    if (historyPausedRef.current) return;
    pushSnapshot(snapshot);
  }, [
    layers,
    pages,
    components,
    activeLayerId,
    activePageId,
    tool,
    gridSize,
    gridColor,
    snapEnabled,
    showPinConnection,
    placingComponentId,
    pdfSettings
  ]);

  function handleDeletePage(pageId: string) {
    if (pages.length <= 1) return;
    const remaining = pages
      .filter((page) => page.id !== pageId)
      .map((page, index) => ({
        ...page,
        name: `Page ${index + 1}`
      }));
    setPages(remaining);
    setSelectionByPage((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setViewByPage((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    if (activePageId === pageId) {
      setActivePageId(remaining[0]?.id ?? "");
    }
  }

  function setSelection(ids: string[]) {
    setSelectionByPage((prev) => ({ ...prev, [activePageId]: ids }));
  }

  function setView(nextView: ViewState) {
    setViewByPage((prev) => ({ ...prev, [activePageId]: nextView }));
  }

  function updateActivePageShapes(updater: (current: Shape[]) => Shape[]) {
    setPages((prev) =>
      prev.map((page) =>
        page.id === activePageId ? { ...page, shapes: updater(page.shapes) } : page
      )
    );
  }

  function cloneShape(shape: Shape): Shape {
    if (shape.type === "group") {
      return { ...shape, children: shape.children.map((child) => cloneShape(child)) };
    }
    return { ...shape };
  }

  function cloneShapeWithNewIds(shape: Shape, nextPotentialNumberRef?: { value: number }): Shape {
    if (shape.type === "group") {
      return {
        ...shape,
        id: createId("shape"),
        children: shape.children.map((child) => cloneShapeWithNewIds(child, nextPotentialNumberRef))
      };
    }
    if (shape.type === "potential" && nextPotentialNumberRef) {
      const nextNumber = nextPotentialNumberRef.value;
      nextPotentialNumberRef.value += 1;
      return { ...shape, id: createId("shape"), potentialNumber: nextNumber };
    }
    return { ...shape, id: createId("shape") };
  }

  const roundCoord = (value: number) => Math.round(value * 1000) / 1000;
  const makePointKey = (point: Point) => `${roundCoord(point.x)}|${roundCoord(point.y)}`;
  const potentialConnectionTolerance = 0.6;
  const pinConnectionTolerance = 0.8;

  type PotentialSegmentInfo = {
    id: string;
    shape: Shape & { type: "potential" };
    shared: PotentialSharedChanges;
  };

  type PotentialHit = {
    number: number;
    shared: PotentialSharedChanges;
    point: Point;
    segmentId: string;
    isEndpoint: boolean;
    distance: number;
  };

  type PinHit = {
    point: Point;
    distance: number;
  };

  const projectPointToSegment = (point: Point, start: Point, end: Point) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
      return { point: { ...start }, t: 0, distance: Math.hypot(point.x - start.x, point.y - start.y) };
    }
    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const projected = { x: start.x + t * dx, y: start.y + t * dy };
    return { point: projected, t, distance: Math.hypot(point.x - projected.x, point.y - projected.y) };
  };

  function collectPotentialEndpoints(items: Shape[]): PotentialEndpointInfo[] {
    const endpoints: PotentialEndpointInfo[] = [];
    const visit = (shape: Shape) => {
      if (shape.type === "group") {
        shape.children.forEach((child) => visit(child));
        return;
      }
      if (shape.type !== "potential") return;
      const shared = extractPotentialShared(shape);
      endpoints.push({
        key: makePointKey({ x: shape.x1, y: shape.y1 }),
        number: shape.potentialNumber,
        shared
      });
      endpoints.push({
        key: makePointKey({ x: shape.x2, y: shape.y2 }),
        number: shape.potentialNumber,
        shared
      });
    };
    items.forEach((shape) => visit(shape));
    return endpoints;
  }

  function collectPotentialSegments(items: Shape[]): PotentialSegmentInfo[] {
    const segments: PotentialSegmentInfo[] = [];
    const visit = (shape: Shape) => {
      if (shape.type === "group") {
        shape.children.forEach((child) => visit(child));
        return;
      }
      if (shape.type !== "potential") return;
      segments.push({ id: shape.id, shape, shared: extractPotentialShared(shape) });
    };
    items.forEach((shape) => visit(shape));
    return segments;
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

  function findPinHit(point: Point, pins: Point[]): PinHit | null {
    let best: PinHit | null = null;
    pins.forEach((pin) => {
      const dist = Math.hypot(point.x - pin.x, point.y - pin.y);
      if (dist > pinConnectionTolerance) return;
      if (!best || dist < best.distance) {
        best = { point: pin, distance: dist };
      }
    });
    return best;
  }

  function findPotentialHit(point: Point, segments: PotentialSegmentInfo[]): PotentialHit | null {
    let best: PotentialHit | null = null;
    segments.forEach((segment) => {
      const startPoint = { x: segment.shape.x1, y: segment.shape.y1 };
      const endPoint = { x: segment.shape.x2, y: segment.shape.y2 };
      const projection = projectPointToSegment(point, startPoint, endPoint);
      if (projection.distance > potentialConnectionTolerance) return;
      const startDist = Math.hypot(projection.point.x - startPoint.x, projection.point.y - startPoint.y);
      const endDist = Math.hypot(projection.point.x - endPoint.x, projection.point.y - endPoint.y);
      const isStart = startDist <= potentialConnectionTolerance;
      const isEnd = endDist <= potentialConnectionTolerance;
      const hitPoint = isStart ? startPoint : isEnd ? endPoint : projection.point;
      const hit: PotentialHit = {
        number: segment.shape.potentialNumber,
        shared: segment.shared,
        point: hitPoint,
        segmentId: segment.id,
        isEndpoint: isStart || isEnd,
        distance: projection.distance
      };
      if (!best || hit.distance < best.distance) {
        best = hit;
      }
    });
    return best;
  }

  function splitPotentialShape(shape: Shape & { type: "potential" }, splitPoints: Point[]) {
    const start = { x: shape.x1, y: shape.y1 };
    const end = { x: shape.x2, y: shape.y2 };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return [shape];
    const uniquePoints = splitPoints.filter((point) => {
      const distStart = Math.hypot(point.x - start.x, point.y - start.y);
      const distEnd = Math.hypot(point.x - end.x, point.y - end.y);
      return distStart > potentialConnectionTolerance && distEnd > potentialConnectionTolerance;
    });
    if (uniquePoints.length === 0) return [shape];
    const pointsWithT = uniquePoints
      .map((point) => {
        const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
        return { point, t };
      })
      .filter((item) => item.t > 0 && item.t < 1)
      .sort((a, b) => a.t - b.t);
    const points = [start, ...pointsWithT.map((item) => item.point), end];
    const segments: Shape[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.001) continue;
      segments.push({
        ...shape,
        id: createId("shape"),
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y
      });
    }
    return segments.length > 0 ? segments : [shape];
  }

  function applyPotentialSplits(items: Shape[], splits: Map<string, Point[]>): Shape[] {
    return items.flatMap((shape) => {
      if (shape.type === "group") {
        return [{ ...shape, children: applyPotentialSplits(shape.children, splits) }];
      }
      const splitPoints = splits.get(shape.id);
      if (shape.type === "potential" && splitPoints && splitPoints.length > 0) {
        return splitPotentialShape(shape, splitPoints);
      }
      return [shape];
    });
  }

  function findPotentialConnection(start: Point, end: Point): PotentialEndpointInfo | null {
    const endpoints = collectPotentialEndpoints(shapes);
    const startKey = makePointKey(start);
    const endKey = makePointKey(end);
    const startMatches = endpoints.filter((item) => item.key === startKey);
    const endMatches = endpoints.filter((item) => item.key === endKey);
    if (startMatches.length === 0 && endMatches.length === 0) return null;
    const sharedMatch = startMatches.find((startItem) =>
      endMatches.some((endItem) => endItem.number === startItem.number)
    );
    return sharedMatch ?? startMatches[0] ?? endMatches[0] ?? null;
  }

  function mergePotentialShared(shape: Shape, shared: PotentialSharedChanges): Shape {
    if (shape.type !== "potential") return shape;
    return {
      ...shape,
      lineColor: shared.lineColor ?? shape.lineColor,
      lineWidth: shared.lineWidth ?? shape.lineWidth,
      lineStyle: shared.lineStyle ?? shape.lineStyle,
      potentialName: shared.potentialName !== undefined ? shared.potentialName : shape.potentialName,
      potentialDiameter:
        shared.potentialDiameter !== undefined ? shared.potentialDiameter : shape.potentialDiameter,
      layerId: shared.layerId ?? shape.layerId
    };
  }

  function addShape(shape: Shape) {
    if (shape.type === "potential") {
      const segments = collectPotentialSegments(shapes);
      const pins = collectPins(shapes);
      const startPotentialHit = findPotentialHit({ x: shape.x1, y: shape.y1 }, segments);
      const endPotentialHit = findPotentialHit({ x: shape.x2, y: shape.y2 }, segments);
      const startPinHit = findPinHit({ x: shape.x1, y: shape.y1 }, pins);
      const endPinHit = findPinHit({ x: shape.x2, y: shape.y2 }, pins);

      const resolveEndpoint = (
        potentialHit: PotentialHit | null,
        pinHit: PinHit | null
      ):
        | { kind: "potential"; hit: PotentialHit }
        | { kind: "pin"; point: Point }
        | null => {
        if (potentialHit && pinHit) {
          if (pinHit.distance <= potentialHit.distance) {
            return { kind: "pin", point: pinHit.point };
          }
          return { kind: "potential", hit: potentialHit };
        }
        if (potentialHit) return { kind: "potential", hit: potentialHit };
        if (pinHit) return { kind: "pin", point: pinHit.point };
        return null;
      };

      const startTarget = resolveEndpoint(startPotentialHit, startPinHit);
      const endTarget = resolveEndpoint(endPotentialHit, endPinHit);
      const connection =
        startTarget?.kind === "potential"
          ? startTarget.hit
          : endTarget?.kind === "potential"
            ? endTarget.hit
            : null;
      const merged = (connection ? mergePotentialShared(shape as Extract<Shape, { type: "potential" }>, connection.shared) : shape) as Extract<Shape, { type: "potential" }>;
      const updatedShape = {
        ...merged,
        potentialNumber: connection ? connection.number : merged.potentialNumber,
        x1:
          startTarget?.kind === "potential"
            ? startTarget.hit.point.x
            : startTarget?.kind === "pin"
              ? startTarget.point.x
              : merged.x1,
        y1:
          startTarget?.kind === "potential"
            ? startTarget.hit.point.y
            : startTarget?.kind === "pin"
              ? startTarget.point.y
              : merged.y1,
        x2:
          endTarget?.kind === "potential"
            ? endTarget.hit.point.x
            : endTarget?.kind === "pin"
              ? endTarget.point.x
              : merged.x2,
        y2:
          endTarget?.kind === "potential"
            ? endTarget.hit.point.y
            : endTarget?.kind === "pin"
              ? endTarget.point.y
              : merged.y2
      };

      const splitRequests = [startTarget, endTarget]
        .filter((target): target is { kind: "potential"; hit: PotentialHit } => target?.kind === "potential")
        .map((target) => target.hit)
        .filter((hit) => !hit.isEndpoint);

      updateActivePageShapes((prev) => {
        let nextShapes = prev;
        if (splitRequests.length > 0) {
          const splits = new Map<string, Point[]>();
          splitRequests.forEach((hit) => {
            const list = splits.get(hit.segmentId);
            if (list) {
              list.push(hit.point);
            } else {
              splits.set(hit.segmentId, [hit.point]);
            }
          });
          nextShapes = applyPotentialSplits(nextShapes, splits);
        }
        return [...nextShapes, updatedShape];
      });
      return;
    }
    updateActivePageShapes((prev) => [...prev, shape]);
  }

  function updateShape(id: string, updater: (shape: Shape) => Shape) {
    updateActivePageShapes((prev) => prev.map((shape) => (shape.id === id ? updater(shape) : shape)));
  }

  function extractPotentialShared(shape: Shape): PotentialSharedChanges {
    if (shape.type !== "potential") return {};
    return {
      lineColor: shape.lineColor,
      lineWidth: shape.lineWidth,
      lineStyle: shape.lineStyle,
      potentialName: shape.potentialName ?? "",
      potentialDiameter: shape.potentialDiameter ?? null,
      layerId: shape.layerId
    };
  }

  function findPotentialSharedInShapes(
    shapes: Shape[],
    number: number,
    excludeId?: string
  ): PotentialSharedChanges | null {
    for (const shape of shapes) {
      if (shape.type === "group") {
        const nested = findPotentialSharedInShapes(shape.children, number, excludeId);
        if (nested) return nested;
        continue;
      }
      if (shape.type !== "potential") continue;
      if (shape.potentialNumber !== number) continue;
      if (excludeId && shape.id === excludeId) continue;
      return extractPotentialShared(shape);
    }
    return null;
  }

  function findPotentialSharedByNumber(
    sourcePages: Page[],
    number: number,
    excludeId?: string
  ): PotentialSharedChanges | null {
    for (const page of sourcePages) {
      const shared = findPotentialSharedInShapes(page.shapes, number, excludeId);
      if (shared) return shared;
    }
    return null;
  }

  function applyPotentialSharedToShapes(
    items: Shape[],
    targetNumber: number,
    changes: PotentialSharedChanges
  ): Shape[] {
    return items.map((shape) => {
      if (shape.type === "group") {
        return { ...shape, children: applyPotentialSharedToShapes(shape.children, targetNumber, changes) };
      }
      if (shape.type === "potential" && shape.potentialNumber === targetNumber) {
        return { ...shape, ...changes };
      }
      return shape;
    });
  }

  function getPotentialNumberById(id: string): number | null {
    for (const page of pages) {
      const number = findPotentialNumber(page.shapes, id);
      if (number !== null) return number;
    }
    return null;
  }

  function findPotentialNumber(shapes: Shape[], id: string): number | null {
    for (const shape of shapes) {
      if (shape.type === "group") {
        const nested = findPotentialNumber(shape.children, id);
        if (nested !== null) return nested;
        continue;
      }
      if (shape.type === "potential" && shape.id === id) return shape.potentialNumber;
    }
    return null;
  }

  function isPotentialShape(shape: Shape): shape is Extract<Shape, { type: "potential" }> {
    return shape.type === "potential";
  }

  function updatePotentialShared(id: string, changes: PotentialSharedChanges) {
    const targetNumber = getPotentialNumberById(id);
    if (targetNumber === null) {
      updateShape(id, (shape) => {
        if (shape.type !== "potential") return shape;
        return { ...shape, ...changes };
      });
      return;
    }
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        shapes: applyPotentialSharedToShapes(page.shapes, targetNumber, changes)
      }))
    );
  }

  function updatePotentialNumber(id: string, nextNumber: number) {
    setPages((prev) => {
      const currentNumber = getPotentialNumberById(id);
      if (currentNumber !== null && currentNumber === nextNumber) {
        return prev;
      }
      const existingShared = findPotentialSharedByNumber(prev, nextNumber, id);
      let updatedPotential: Extract<Shape, { type: "potential" }> | null = null;
      const updateShapes = (items: Shape[]): Shape[] =>
        items.map((shape) => {
          if (shape.type === "group") {
            return { ...shape, children: updateShapes(shape.children) };
          }
          if (isPotentialShape(shape) && shape.id === id) {
            const nextShape = { ...shape, potentialNumber: nextNumber };
            updatedPotential = nextShape;
            return nextShape;
          }
          return shape;
      });

      let nextPages = prev.map((page) => ({ ...page, shapes: updateShapes(page.shapes) }));
      if (updatedPotential) {
        const shared = existingShared ?? extractPotentialShared(updatedPotential);
        nextPages = nextPages.map((page) => ({
          ...page,
          shapes: applyPotentialSharedToShapes(page.shapes, nextNumber, shared)
        }));
      }
      return nextPages;
    });
  }

  function renumberPotentialShape(shape: Shape, numberMap: Map<number, number>): Shape {
    if (shape.type === "group") {
      return { ...shape, children: shape.children.map((child) => renumberPotentialShape(child, numberMap)) };
    }
    if (shape.type === "potential") {
      const nextNumber = numberMap.get(shape.potentialNumber);
      if (nextNumber === undefined) return shape;
      return { ...shape, potentialNumber: nextNumber };
    }
    return shape;
  }

  function handleRenumberPotentials() {
    if (potentialList.length === 0) return;
    const ordered = [...potentialList].sort((a, b) => {
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
      if (a.bounds.minY !== b.bounds.minY) return a.bounds.minY - b.bounds.minY;
      if (a.bounds.minX !== b.bounds.minX) return a.bounds.minX - b.bounds.minX;
      return a.number - b.number;
    });
    const numberMap = new Map<number, number>();
    ordered.forEach((item, index) => {
      numberMap.set(item.number, index + 1);
    });
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        shapes: page.shapes.map((shape) => renumberPotentialShape(shape, numberMap))
      }))
    );
  }

  function getSelectionBounds(selectedShapes: Shape[]): Bounds | null {
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
  }

  function moveSelection(dx: number, dy: number) {
    if (selection.length === 0) return;
    updateActivePageShapes((prev) =>
      prev.map((shape) => (selection.includes(shape.id) ? translateShape(shape, dx, dy) : shape))
    );
  }

  function alignSelection(mode: AlignMode) {
    if (selection.length < 2) return;
    const selectedShapes = shapes.filter((shape) => selection.includes(shape.id));
    if (selectedShapes.length < 2) return;

    const selectionBounds = getSelectionBounds(selectedShapes);
    if (!selectionBounds) return;

    const selectionCenterX = (selectionBounds.minX + selectionBounds.maxX) / 2;
    const selectionCenterY = (selectionBounds.minY + selectionBounds.maxY) / 2;

    updateActivePageShapes((prev) =>
      prev.map((shape) => {
        if (!selection.includes(shape.id)) return shape;
        const bounds = getShapeBounds(shape);
        let dx = 0;
        let dy = 0;
        switch (mode) {
          case "left":
            dx = selectionBounds.minX - bounds.minX;
            break;
          case "right":
            dx = selectionBounds.maxX - bounds.maxX;
            break;
          case "top":
            dy = selectionBounds.minY - bounds.minY;
            break;
          case "bottom":
            dy = selectionBounds.maxY - bounds.maxY;
            break;
          case "centerX":
            dx = selectionCenterX - (bounds.minX + bounds.maxX) / 2;
            break;
          case "centerY":
            dy = selectionCenterY - (bounds.minY + bounds.maxY) / 2;
            break;
          default:
            break;
        }
        return translateShape(shape, dx, dy);
      })
    );
  }

  function handleResizeStart(bounds: Bounds) {
    const selectedShapes = shapes.filter((shape) => selection.includes(shape.id));
    if (selectedShapes.length === 0) return;
    resizeRef.current = { bounds, shapes: selectedShapes };
    historyPausedRef.current = true;
  }

  function handleResizeSelection(nextBounds: Bounds) {
    const snapshot = resizeRef.current;
    if (!snapshot) return;
    const startBounds = snapshot.bounds;
    const startWidth = Math.max(1, startBounds.maxX - startBounds.minX);
    const startHeight = Math.max(1, startBounds.maxY - startBounds.minY);
    const nextWidth = Math.max(1, nextBounds.maxX - nextBounds.minX);
    const nextHeight = Math.max(1, nextBounds.maxY - nextBounds.minY);
    const scaleX = nextWidth / startWidth;
    const scaleY = nextHeight / startHeight;
    const scaleAvg = (scaleX + scaleY) / 2;
    const snapshotMap = new Map(snapshot.shapes.map((shape) => [shape.id, shape]));

    const scalePoint = (x: number, y: number) => ({
      x: nextBounds.minX + (x - startBounds.minX) * scaleX,
      y: nextBounds.minY + (y - startBounds.minY) * scaleY
    });

    const scaleShape = (baseShape: Shape): Shape => {
      if (baseShape.type === "line") {
        const p1 = scalePoint(baseShape.x1, baseShape.y1);
        const p2 = scalePoint(baseShape.x2, baseShape.y2);
        return { ...baseShape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      }
      if (baseShape.type === "potential") {
        const p1 = scalePoint(baseShape.x1, baseShape.y1);
        const p2 = scalePoint(baseShape.x2, baseShape.y2);
        return { ...baseShape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      }
      if (baseShape.type === "circle") {
        const center = scalePoint(baseShape.cx, baseShape.cy);
        return { ...baseShape, cx: center.x, cy: center.y, r: Math.max(0.5, baseShape.r * scaleAvg) };
      }
      if (baseShape.type === "arc") {
        const center = scalePoint(baseShape.cx, baseShape.cy);
        return { ...baseShape, cx: center.x, cy: center.y, r: Math.max(0.5, baseShape.r * scaleAvg) };
      }
      if (baseShape.type === "text") {
        const pos = scalePoint(baseShape.x, baseShape.y);
        return { ...baseShape, x: pos.x, y: pos.y, fontSize: Math.max(6, baseShape.fontSize * scaleAvg) };
      }
      if (baseShape.type === "pin") {
        const pos = scalePoint(baseShape.x, baseShape.y);
        const tagPos = scalePoint(baseShape.tagX, baseShape.tagY);
        return {
          ...baseShape,
          x: pos.x,
          y: pos.y,
          tagX: tagPos.x,
          tagY: tagPos.y,
          tagFontSize: Math.max(4, baseShape.tagFontSize * scaleAvg)
        };
      }
      if (baseShape.type === "group") {
        return {
          ...baseShape,
          children: baseShape.children.map((child) => scaleShape(child))
        };
      }
      return baseShape;
    };

    updateActivePageShapes((prev) =>
      prev.map((shape) => {
        const baseShape = snapshotMap.get(shape.id);
        if (!baseShape) return shape;
        return scaleShape(baseShape);
      })
    );
  }

  function rotateSelection(degrees: number) {
    if (selection.length === 0) return;
    const selectedShapes = shapes.filter((shape) => selection.includes(shape.id));
    const selectionBounds = getSelectionBounds(selectedShapes);
    if (!selectionBounds) return;
    const center = {
      x: (selectionBounds.minX + selectionBounds.maxX) / 2,
      y: (selectionBounds.minY + selectionBounds.maxY) / 2
    };
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const rotatePoint = (x: number, y: number) => {
      const dx = x - center.x;
      const dy = y - center.y;
      return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
      };
    };
    const transformArc = (arc: Shape) => {
      if (arc.type !== "arc") return arc;
      const nextCenter = rotatePoint(arc.cx, arc.cy);
      return {
        ...arc,
        cx: nextCenter.x,
        cy: nextCenter.y,
        startAngle: arc.startAngle + radians,
        endAngle: arc.endAngle + radians
      };
    };
    const transformShape = (shape: Shape): Shape => {
      if (shape.type === "line") {
        const p1 = rotatePoint(shape.x1, shape.y1);
        const p2 = rotatePoint(shape.x2, shape.y2);
        return { ...shape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      }
      if (shape.type === "potential") {
        const p1 = rotatePoint(shape.x1, shape.y1);
        const p2 = rotatePoint(shape.x2, shape.y2);
        return { ...shape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      }
      if (shape.type === "circle") {
        const centerPoint = rotatePoint(shape.cx, shape.cy);
        return { ...shape, cx: centerPoint.x, cy: centerPoint.y };
      }
      if (shape.type === "arc") {
        return transformArc(shape);
      }
      if (shape.type === "text") {
        const pos = rotatePoint(shape.x, shape.y);
        return { ...shape, x: pos.x, y: pos.y };
      }
      if (shape.type === "pin") {
        const pos = rotatePoint(shape.x, shape.y);
        const tagPos = rotatePoint(shape.tagX, shape.tagY);
        return { ...shape, x: pos.x, y: pos.y, tagX: tagPos.x, tagY: tagPos.y };
      }
      if (shape.type === "group") {
        return { ...shape, children: shape.children.map((child) => transformShape(child)) };
      }
      return shape;
    };
    updateActivePageShapes((prev) =>
      prev.map((shape) => (selection.includes(shape.id) ? transformShape(shape) : shape))
    );
  }

  function mirrorSelection(axis: "horizontal" | "vertical") {
    if (selection.length === 0) return;
    const selectedShapes = shapes.filter((shape) => selection.includes(shape.id));
    const selectionBounds = getSelectionBounds(selectedShapes);
    if (!selectionBounds) return;
    const center = {
      x: (selectionBounds.minX + selectionBounds.maxX) / 2,
      y: (selectionBounds.minY + selectionBounds.maxY) / 2
    };
    const mirrorPoint = (x: number, y: number) => {
      if (axis === "horizontal") {
        return { x: center.x * 2 - x, y };
      }
      return { x, y: center.y * 2 - y };
    };
    const mirrorAngle = (angle: number) => {
      if (axis === "horizontal") return Math.PI - angle;
      return -angle;
    };
    const transformArc = (arc: Shape) => {
      if (arc.type !== "arc") return arc;
      const nextCenter = mirrorPoint(arc.cx, arc.cy);
      return {
        ...arc,
        cx: nextCenter.x,
        cy: nextCenter.y,
        startAngle: mirrorAngle(arc.startAngle),
        endAngle: mirrorAngle(arc.endAngle)
      };
    };
    const transformShape = (shape: Shape): Shape => {
      if (shape.type === "line") {
        const p1 = mirrorPoint(shape.x1, shape.y1);
        const p2 = mirrorPoint(shape.x2, shape.y2);
        return { ...shape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      }
      if (shape.type === "potential") {
        const p1 = mirrorPoint(shape.x1, shape.y1);
        const p2 = mirrorPoint(shape.x2, shape.y2);
        return { ...shape, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
      }
      if (shape.type === "circle") {
        const centerPoint = mirrorPoint(shape.cx, shape.cy);
        return { ...shape, cx: centerPoint.x, cy: centerPoint.y };
      }
      if (shape.type === "arc") {
        return transformArc(shape);
      }
      if (shape.type === "text") {
        const pos = mirrorPoint(shape.x, shape.y);
        return { ...shape, x: pos.x, y: pos.y };
      }
      if (shape.type === "pin") {
        const pos = mirrorPoint(shape.x, shape.y);
        const tagPos = mirrorPoint(shape.tagX, shape.tagY);
        return { ...shape, x: pos.x, y: pos.y, tagX: tagPos.x, tagY: tagPos.y };
      }
      if (shape.type === "group") {
        return { ...shape, children: shape.children.map((child) => transformShape(child)) };
      }
      return shape;
    };
    updateActivePageShapes((prev) =>
      prev.map((shape) => (selection.includes(shape.id) ? transformShape(shape) : shape))
    );
  }

  function handleResizeEnd() {
    resizeRef.current = null;
    historyPausedRef.current = false;
    pushSnapshot(buildSnapshot());
  }

  function handleSaveJson() {
    const payload: CadFile = {
      version: 2,
      layers,
      pages,
      components
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeProjectName = pdfSettings.project.trim() || "cad-project";
    const fileName = `${safeProjectName.replace(/[\\/:*?"<>|]/g, "-")}.json`;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as CadFile;
        if (!data.layers || !data.pages || !data.components) return;
        setLayers(data.layers);
        setPages(data.pages);
        setComponents(data.components);
        setActiveLayerId(data.layers[0]?.id ?? "");
        setActivePageId(data.pages[0]?.id ?? "");
        setSelectionByPage({});
        setViewByPage({});
      } catch {
        // ignore invalid file
      }
    };
    reader.readAsText(file);
  }

  function handleAddLayer() {
    const layer: Layer = {
      id: createId("layer"),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      locked: false
    };
    setLayers((prev) => [...prev, layer]);
    setActiveLayerId(layer.id);
  }

  function handleDeleteLayer(id: string) {
    if (layers.length <= 1) return;
    setLayers((prev) => {
      const next = prev.filter((layer) => layer.id !== id);
      if (activeLayerId === id) {
        setActiveLayerId(next[0]?.id ?? "");
      }
      return next;
    });
    const filterShapesByLayer = (items: Shape[]): Shape[] =>
      items.reduce<Shape[]>((acc, shape) => {
        if (shape.type === "group") {
          const nextChildren = filterShapesByLayer(shape.children);
          if (nextChildren.length === 0) return acc;
          acc.push({ ...shape, children: nextChildren });
          return acc;
        }
        if (shape.layerId === id) return acc;
        acc.push(shape);
        return acc;
      }, []);
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        shapes: filterShapesByLayer(page.shapes)
      }))
    );
    setSelectionByPage((prev) => {
      const next: Record<string, string[]> = {};
      Object.keys(prev).forEach((pageId) => {
        next[pageId] = [];
      });
      return next;
    });
  }

  function handleRenameLayer(id: string, name: string) {
    setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, name } : layer)));
  }

  function toggleLayerVisibility(id: string) {
    setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, visible: !layer.visible } : layer)));
  }

  function toggleLayerLock(id: string) {
    setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, locked: !layer.locked } : layer)));
  }

  function handleSaveComponent() {
    if (selection.length === 0) return;
    const selectedShapes = shapes.filter((shape) => selection.includes(shape.id));
    if (selectedShapes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    selectedShapes.forEach((shape) => {
      const bounds = getShapeBounds(shape);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
    });
    const componentShapes = selectedShapes.map((shape) => ({
      ...translateShape(shape, -minX, -minY),
      id: createId("cshape")
    }));
    const safeGrid = gridSize > 0 ? gridSize : 0;
    const gridOffsetX = safeGrid ? ((minX % safeGrid) + safeGrid) % safeGrid : 0;
    const gridOffsetY = safeGrid ? ((minY % safeGrid) + safeGrid) % safeGrid : 0;
    const component: Component = {
      id: createId("component"),
      name: `Component ${components.length + 1}`,
      shapes: componentShapes,
      gridOffsetX,
      gridOffsetY
    };
    setComponents((prev) => [...prev, component]);
  }

  function handleRenameComponent(id: string, name: string) {
    setComponents((prev) => prev.map((component) => (component.id === id ? { ...component, name } : component)));
  }

  function handleDeleteComponent(id: string) {
    setComponents((prev) => prev.filter((component) => component.id !== id));
    if (placingComponentId === id) setPlacingComponentId(null);
  }

  function handleDeleteSelection() {
    if (selection.length === 0) return;
    updateActivePageShapes((prev) => prev.filter((shape) => !selection.includes(shape.id)));
    setSelection([]);
  }

  function handleGroupSelection() {
    if (selection.length < 2) return;
    const selectedShapes = shapes.filter((shape) => selection.includes(shape.id));
    if (selectedShapes.length < 2) return;
    const groupShape: Shape = {
      id: createId("shape"),
      type: "group",
      layerId: selectedShapes[0]?.layerId ?? activeLayerId,
      lineColor: "#000000",
      lineWidth: 1,
      fill: "transparent",
      children: selectedShapes
    };
    updateActivePageShapes((prev) => [
      ...prev.filter((shape) => !selection.includes(shape.id)),
      groupShape
    ]);
    setSelection([groupShape.id]);
  }

  function handleUngroupSelection() {
    if (!selectedShape || selectedShape.type !== "group") return;
    const groupShape = selectedShape;
    updateActivePageShapes((prev) => [
      ...prev.filter((shape) => shape.id !== groupShape.id),
      ...groupShape.children
    ]);
    setSelection(groupShape.children.map((child) => child.id));
  }

  function handleMoveSelectionToLayer(layerId: string) {
    if (selection.length === 0) return;
    const potentialIds = new Set(
      shapes.filter((shape) => selection.includes(shape.id) && shape.type === "potential").map((shape) => shape.id)
    );
    const updateLayer = (shape: Shape): Shape => {
      if (shape.type === "group") {
        return {
          ...shape,
          layerId,
          children: shape.children.map((child) => updateLayer(child))
        };
      }
      return { ...shape, layerId };
    };
    updateActivePageShapes((prev) =>
      prev.map((shape) => (selection.includes(shape.id) ? updateLayer(shape) : shape))
    );
    potentialIds.forEach((id) => updatePotentialShared(id, { layerId }));
  }

  function handleCopySelection() {
    if (selection.length === 0) return;
    const selectedShapes = shapes.filter((shape) => selection.includes(shape.id));
    const bounds = selectedShapes.reduce(
      (acc, shape) => {
        const shapeBounds = getShapeBounds(shape);
        return {
          minX: Math.min(acc.minX, shapeBounds.minX),
          minY: Math.min(acc.minY, shapeBounds.minY)
        };
      },
      { minX: Infinity, minY: Infinity }
    );
    clipboardRef.current = {
      shapes: selectedShapes.map((shape) => cloneShape(shape)),
      offsetX: Number.isFinite(bounds.minX) ? bounds.minX : 0,
      offsetY: Number.isFinite(bounds.minY) ? bounds.minY : 0
    };
  }

  function handleCutSelection() {
    if (selection.length === 0) return;
    handleCopySelection();
    updateActivePageShapes((prev) => prev.filter((shape) => !selection.includes(shape.id)));
    setSelection([]);
  }

  function handlePasteSelection(point?: { x: number; y: number }) {
    if (!clipboardRef.current || clipboardRef.current.shapes.length === 0) return;
    const { shapes: clipboardShapes, offsetX, offsetY } = clipboardRef.current;
    const bounds = clipboardShapes.reduce(
      (acc, shape) => {
        const shapeBounds = getShapeBounds(shape);
        return {
          minX: Math.min(acc.minX, shapeBounds.minX),
          minY: Math.min(acc.minY, shapeBounds.minY)
        };
      },
      { minX: Infinity, minY: Infinity }
    );
    const fallbackOffset = 10;
    let dx = fallbackOffset;
    let dy = fallbackOffset;
    if (point) {
      let targetX = point.x;
      let targetY = point.y;
      if (snapEnabled && gridSize > 0) {
        const offsetModX = ((offsetX % gridSize) + gridSize) % gridSize;
        const offsetModY = ((offsetY % gridSize) + gridSize) % gridSize;
        const adjustX = ((targetX - offsetModX) % gridSize + gridSize) % gridSize;
        const adjustY = ((targetY - offsetModY) % gridSize + gridSize) % gridSize;
        targetX -= adjustX;
        targetY -= adjustY;
      }
      dx = targetX - bounds.minX;
      dy = targetY - bounds.minY;
    }
    const nextPotentialNumberRef = { value: nextPotentialNumber };
    const pasted = clipboardShapes.map((shape) =>
      cloneShapeWithNewIds(translateShape(cloneShape(shape), dx, dy), nextPotentialNumberRef)
    );
    updateActivePageShapes((prev) => [...prev, ...pasted]);
    setSelection(pasted.map((shape) => shape.id));
  }

  function handlePlaceComponentAt(componentId: string, x: number, y: number) {
    const component = components.find((item) => item.id === componentId);
    if (!component) return;
    const bounds = component.shapes.reduce(
      (acc, shape) => {
        const shapeBounds = getShapeBounds(shape);
        return {
          minX: Math.min(acc.minX, shapeBounds.minX),
          minY: Math.min(acc.minY, shapeBounds.minY)
        };
      },
      { minX: Infinity, minY: Infinity }
    );
    let targetX = x;
    let targetY = y;
    if (snapEnabled && gridSize > 0) {
      const offsetModX = component.gridOffsetX ?? (((bounds.minX % gridSize) + gridSize) % gridSize);
      const offsetModY = component.gridOffsetY ?? (((bounds.minY % gridSize) + gridSize) % gridSize);
      const adjustX = ((targetX - offsetModX) % gridSize + gridSize) % gridSize;
      const adjustY = ((targetY - offsetModY) % gridSize + gridSize) % gridSize;
      targetX -= adjustX;
      targetY -= adjustY;
    }
    const dx = Number.isFinite(bounds.minX) ? targetX - bounds.minX : targetX;
    const dy = Number.isFinite(bounds.minY) ? targetY - bounds.minY : targetY;
    const nextPotentialNumberRef = { value: nextPotentialNumber };
    const cloneShapeWithNewIds = (shape: Shape, dx: number, dy: number): Shape => {
      const moved = translateShape(shape, dx, dy);
      if (moved.type === "group") {
        return {
          ...moved,
          id: createId("shape"),
          layerId: activeLayerId,
          children: moved.children.map((child) => cloneShapeWithNewIds(child, 0, 0))
        };
      }
      if (moved.type === "potential") {
        const number = nextPotentialNumberRef.value;
        nextPotentialNumberRef.value += 1;
        return {
          ...moved,
          id: createId("shape"),
          layerId: activeLayerId,
          potentialNumber: number
        };
      }
      return { ...moved, id: createId("shape"), layerId: activeLayerId };
    };
    const newShapes = component.shapes.map((shape) => cloneShapeWithNewIds(shape, dx, dy));
    updateActivePageShapes((prev) => [...prev, ...newShapes]);
    setPlacingComponentId(null);
  }

  function handleExportPdf() {
    const sizeMap: Record<PdfSettings["size"], [number, number]> = {
      A4: [210, 297],
      A3: [297, 420]
    };
    const pxToMm = 0.264583;
    const mmToPt = 72 / 25.4;
    const [rawWidth, rawHeight] = sizeMap[pdfSettings.size];
    const pdf = new jsPDF({
      unit: "mm",
      format: [rawWidth, rawHeight],
      orientation: pdfSettings.orientation
    });
    const pdfWithLineDash = pdf as JsPdfWithLineDash;
    const setPdfLineDash = (dashArray: number[], dashPhase = 0) => {
      pdfWithLineDash.setLineDash?.(dashArray, dashPhase);
    };

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

    const visibleLayers = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
    const mapX = (x: number) => x;
    const mapY = (y: number) => y;

    const exportPages = pages.length > 0 ? pages : [{ id: "page-1", name: "Page 1", shapes: [] }];

    const potentialEdgeFontSize = 3.2;
    const potentialMidFontSize = 3.2;
    const potentialEdgeFontPt = potentialEdgeFontSize * mmToPt;
    const potentialMidFontPt = potentialMidFontSize * mmToPt;
    const potentialOffset = 0;
    const potentialEdgeLabelOffset = 0.3;
    const potentialMidLabelOffset = 2;
    const potentialJunctionRadius = 0.6;

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
      return `${number} - ${diameter}mm2`;
    };

    const collectPotentialJunctions = (items: Shape[]) => {
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
      items.forEach((shape) => visit(shape));
      const junctions: { point: Point; color: string }[] = [];
      map.forEach((entry) => {
        if (entry.count >= 3) {
          junctions.push({ point: entry.point, color: entry.color });
        }
      });
      return junctions;
    };

    const potentialArrowLength = 2.4;
    const potentialArrowWidth = 1.4;
    const potentialArrowLabelGap = 1;
    const potentialArrowLabelShift = 3;
    const potentialPdfHorizontalTextLift = 0.3;
    const potentialPdfVerticalTextDrop = 0;
    const potentialPdfVerticalUpOffsetX = 2.5;
    const potentialPdfVerticalUpOffsetY = -3;
    const potentialPdfVerticalDownExtraOffsetY = -5.5;

    const drawPotentialArrow = (
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
      pdf.line(mapX(tipX), mapY(tipY), mapX(leftX), mapY(leftY));
      pdf.line(mapX(tipX), mapY(tipY), mapX(rightX), mapY(rightY));
    };

    const drawPotentialLabel = (
      text: string,
      x: number,
      y: number,
      align: "left" | "center" | "right",
      fontSizePt: number,
      angle: number
    ) => {
      if (!text) return;
      pdf.setFontSize(fontSizePt);
      const textWidth = pdf.getTextWidth(text);
      const textHeight = fontSizePt / mmToPt;
      const angleRad = (angle * Math.PI) / 180;
      const dirX = Math.cos(angleRad);
      const dirY = -Math.sin(angleRad);
      const normX = -dirY;
      const normY = dirX;
      const alignOffset = align === "center" ? textWidth / 2 : align === "right" ? textWidth : 0;
      const originX = x - dirX * alignOffset - normX * (textHeight / 2);
      const originY = y - dirY * alignOffset - normY * (textHeight / 2);
      pdf.text(text, mapX(originX), mapY(originY), { align: "left", baseline: "top", angle });
    };

    exportPages.forEach((page, pageIndex) => {
      if (pageIndex > 0) pdf.addPage([rawWidth, rawHeight], pdfSettings.orientation);

      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      pdf.rect(frameX, frameY, frameWidth, frameHeight);
      if (showMarkers) {
        pdf.line(frameX + markerBandWidth, frameY, frameX + markerBandWidth, frameY + frameHeight);
        pdf.line(frameX, frameY + markerBandHeight, frameX + frameWidth, frameY + markerBandHeight);
        for (let i = 1; i < markerCols; i += 1) {
          const x = frameX + markerBandWidth + columnWidth * i;
          pdf.line(x, frameY, x, frameY + markerBandHeight);
        }
        for (let i = 1; i < markerRows; i += 1) {
          const y = frameY + markerBandHeight + rowHeight * i;
          pdf.line(frameX, y, frameX + markerBandWidth, y);
        }
        pdf.setFontSize(7);
        for (let i = 0; i < markerCols; i += 1) {
          const x = frameX + markerBandWidth + columnWidth * (i + 0.5);
          pdf.text(String(i + 1), x, frameY + markerBandHeight / 2, { align: "center", baseline: "middle" });
        }
        for (let i = 0; i < markerRows; i += 1) {
          const y = frameY + markerBandHeight + rowHeight * (i + 0.5);
          const label = String.fromCharCode(65 + i);
          pdf.text(label, frameX + markerBandWidth / 2, y, { align: "center", baseline: "middle" });
        }
      }

      const drawShape = (shape: Shape) => {
        if (shape.type === "group") {
          shape.children.forEach((child) => drawShape(child));
          return;
        }
        if (!visibleLayers.has(shape.layerId)) return;
        pdf.setDrawColor(shape.lineColor);
        pdf.setLineWidth(Math.max(0.1, shape.lineWidth * pxToMm));
        if (shape.lineStyle === "dashed") {
          setPdfLineDash([3, 2], 0);
          pdf.setLineCap(0);
        } else if (shape.lineStyle === "dotted") {
          setPdfLineDash([0.5, 2], 0);
          pdf.setLineCap(1);
        } else {
          setPdfLineDash([], 0);
          pdf.setLineCap(0);
        }
        if (shape.type === "line") {
          pdf.line(mapX(shape.x1), mapY(shape.y1), mapX(shape.x2), mapY(shape.y2));
        }
        if (shape.type === "potential") {
          pdf.line(mapX(shape.x1), mapY(shape.y1), mapX(shape.x2), mapY(shape.y2));
          const dx = shape.x2 - shape.x1;
          const dy = shape.y2 - shape.y1;
          const renderInfo = potentialRender[shape.id];
          const startLabel = (renderInfo?.startVisible ?? true)
            ? buildPotentialEdgeLabel(shape.potentialName ?? "", renderInfo?.startLink?.address)
            : "";
          const endLabel = (renderInfo?.endVisible ?? true)
            ? buildPotentialEdgeLabel(shape.potentialName ?? "", renderInfo?.endLink?.address)
            : "";
          const startLabelVisible = renderInfo?.startLabelVisible ?? (renderInfo?.startVisible ?? true);
          const endLabelVisible = renderInfo?.endLabelVisible ?? (renderInfo?.endVisible ?? true);
          const showMidLabel = renderInfo?.showMidLabel ?? true;
          const midLabel = showMidLabel
            ? buildPotentialMidLabel(shape.potentialNumber, shape.potentialDiameter ?? null)
            : "";
          const length = Math.hypot(dx, dy) || 1;
          const nx = -dy / length;
          const ny = dx / length;
          const isVertical = Math.abs(dy) > Math.abs(dx);
          const angle = isVertical ? (dy < 0 ? 90 : -90) : 0;
          const edgeNormalSign = ny >= 0 ? 1 : -1;
          const edgeOffsetX = nx * potentialEdgeLabelOffset * edgeNormalSign;
          const edgeOffsetY = ny * potentialEdgeLabelOffset * edgeNormalSign;
          const arrowLabelOffset = potentialArrowLength + potentialArrowLabelGap;
          const endArrowLabelOffset = Math.max(0, arrowLabelOffset - potentialArrowLabelShift);
          const ux = dx / length;
          const uy = dy / length;
          const startX = shape.x1 + nx * potentialOffset - ux * arrowLabelOffset + edgeOffsetX;
          const startY = shape.y1 + ny * potentialOffset - uy * arrowLabelOffset + edgeOffsetY;
          const endX = shape.x2 + nx * potentialOffset + ux * endArrowLabelOffset + edgeOffsetX;
          const endY = shape.y2 + ny * potentialOffset + uy * endArrowLabelOffset + edgeOffsetY;
          const midNormalSign = ny >= 0 ? 1 : -1;
          const midX = (shape.x1 + shape.x2) / 2 + nx * potentialOffset + nx * potentialMidLabelOffset * midNormalSign;
          const midY = (shape.y1 + shape.y2) / 2 + ny * potentialOffset + ny * potentialMidLabelOffset * midNormalSign;
          const textOffsetY = isVertical ? potentialPdfVerticalTextDrop : -potentialPdfHorizontalTextLift;
          const verticalUpOffsetX =
            isVertical && dy !== 0 ? potentialPdfVerticalUpOffsetX * Math.sign(-dy) : 0;
          const verticalUpOffsetYBase =
            isVertical && dy !== 0 ? potentialPdfVerticalUpOffsetY * Math.sign(-dy) : 0;
          const verticalUpOffsetY =
            isVertical && dy > 0 ? verticalUpOffsetYBase + potentialPdfVerticalDownExtraOffsetY : verticalUpOffsetYBase;
          const angleRad = (angle * Math.PI) / 180;
          const textDirX = Math.cos(angleRad);
          const textDirY = -Math.sin(angleRad);
          const startDot = -ux * textDirX - uy * textDirY;
          const endDot = ux * textDirX + uy * textDirY;
          const startAlign = startDot >= 0 ? "left" : "right";
          const endAlign = endDot >= 0 ? "left" : "right";

          pdf.setTextColor(shape.lineColor);
          if (startLabel && startLabelVisible) {
            drawPotentialLabel(
              startLabel,
              startX + verticalUpOffsetX,
              startY + textOffsetY + verticalUpOffsetY,
              startAlign,
              potentialEdgeFontPt,
              angle
            );
          }
          if (endLabel && endLabelVisible) {
            drawPotentialLabel(
              endLabel,
              endX + verticalUpOffsetX,
              endY + textOffsetY + verticalUpOffsetY,
              endAlign,
              potentialEdgeFontPt,
              angle
            );
          }
          if (midLabel) {
            drawPotentialLabel(
              midLabel,
              midX + verticalUpOffsetX,
              midY + textOffsetY + verticalUpOffsetY,
              "center",
              potentialMidFontPt,
              angle
            );
          }

          setPdfLineDash([], 0);
          const startVisible = renderInfo?.startVisible ?? true;
          const endVisible = renderInfo?.endVisible ?? true;
          const startDirection = renderInfo?.startArrow ?? "forward";
          const endDirection = renderInfo?.endArrow ?? "forward";
          if (startVisible) {
            drawPotentialArrow(shape.x1, shape.y1, dx, dy, startDirection);
          }
          if (endVisible) {
            drawPotentialArrow(shape.x2, shape.y2, dx, dy, endDirection);
          }
        }
        if (shape.type === "circle") {
          pdf.circle(mapX(shape.cx), mapY(shape.cy), shape.r);
        }
        if (shape.type === "arc") {
          const segments = 32;
          const step = (shape.endAngle - shape.startAngle) / segments;
          let prevX = shape.cx + Math.cos(shape.startAngle) * shape.r;
          let prevY = shape.cy + Math.sin(shape.startAngle) * shape.r;
          for (let i = 1; i <= segments; i += 1) {
            const angle = shape.startAngle + step * i;
            const nextX = shape.cx + Math.cos(angle) * shape.r;
            const nextY = shape.cy + Math.sin(angle) * shape.r;
            pdf.line(mapX(prevX), mapY(prevY), mapX(nextX), mapY(nextY));
            prevX = nextX;
            prevY = nextY;
          }
        }
        if (shape.type === "text") {
          pdf.setTextColor(shape.lineColor);
          pdf.setFontSize(Math.max(1, shape.fontSize * mmToPt));
          const resolvedText = replacePlaceholders(shape.text, {
            project: pdfSettings.project,
            drawing: pdfSettings.drawing,
            author: pdfSettings.author,
            page: pageIndex + 1,
            totalPages: exportPages.length
          });
          pdf.text(resolvedText, mapX(shape.x), mapY(shape.y));
        }
        if (shape.type === "pin") {
          const cross = 1;
          if (showPinConnection) {
            pdf.line(mapX(shape.x - cross), mapY(shape.y - cross), mapX(shape.x + cross), mapY(shape.y + cross));
            pdf.line(mapX(shape.x - cross), mapY(shape.y + cross), mapX(shape.x + cross), mapY(shape.y - cross));
          }
          pdf.setTextColor(shape.lineColor);
          pdf.setFontSize(Math.max(1, shape.tagFontSize * mmToPt));
          pdf.text(shape.tag, mapX(shape.tagX), mapY(shape.tagY));
        }
        setPdfLineDash([], 0);
        pdf.setLineCap(0);
      };

      page.shapes.forEach((shape) => drawShape(shape));
      const junctions = collectPotentialJunctions(page.shapes);
      if (junctions.length > 0) {
        junctions.forEach((junction) => {
          pdf.setFillColor(junction.color);
          pdf.circle(mapX(junction.point.x), mapY(junction.point.y), potentialJunctionRadius, "F");
        });
      }
    });

    pdf.save("cad-export.pdf");
  }

  return (
    <div className="app">
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
        onExportPdf={handleExportPdf}
      />
      <div className="workspace">
        <aside className="sidebar">
          <ComponentsPanel
            components={components}
            onSaveComponent={handleSaveComponent}
            onSelectComponent={setPlacingComponentId}
            onDeleteComponent={handleDeleteComponent}
            onRenameComponent={handleRenameComponent}
            placingComponentId={placingComponentId}
            showPinConnection={showPinConnection}
          />
        </aside>
        <CanvasView
          key={activePageId}
          shapes={shapes}
          layers={layers}
          activeLayer={activeLayer}
          tool={tool}
          selection={selection}
          view={view}
          gridSize={gridSize}
          snapEnabled={snapEnabled}
          showPinConnection={showPinConnection}
          pdfSettings={pdfSettings}
          gridColor={gridColor}
          shouldAutoFit={shouldAutoFit}
          pageIndex={activePageIndex}
          totalPages={pages.length}
          pageId={activePageId}
          placingComponentId={placingComponentId}
          nextPotentialNumber={nextPotentialNumber}
          potentialRender={potentialRender}
          onViewChange={setView}
          onAddShape={addShape}
          onUpdateShape={updateShape}
          onMoveSelection={moveSelection}
          onMoveStart={() => {
            historyPausedRef.current = true;
          }}
          onMoveEnd={() => {
            historyPausedRef.current = false;
            pushSnapshot(buildSnapshot());
          }}
          onSelect={setSelection}
          onPlaceComponentAt={handlePlaceComponentAt}
          onCancelPlacingComponent={() => setPlacingComponentId(null)}
          onDeleteSelection={handleDeleteSelection}
          onResizeStart={handleResizeStart}
          onResizeSelection={handleResizeSelection}
          onResizeEnd={handleResizeEnd}
          onSelectionContextMenu={(x, y) => {
            if (!canGroupSelection && !canUngroupSelection && !canMoveSelection) return;
            setSelectionMenu({ x, y });
          }}
          onCopySelection={handleCopySelection}
          onCutSelection={handleCutSelection}
          onPasteSelection={handlePasteSelection}
          onResetTool={() => setTool("select")}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onNavigateToLink={(pageIndex, bounds) => {
            const nextPage = pages[pageIndex];
            if (!nextPage) return;
            setActivePageId(nextPage.id);
            setNavigateTarget({ pageId: nextPage.id, bounds });
          }}
          navigateTarget={navigateTarget}
          onNavigateTargetApplied={() => setNavigateTarget(null)}
        />
        <RightPanel
          selectedShape={selectedShape}
          selectionCount={selection.length}
          onUpdateShape={(id, updater) => updateShape(id, updater)}
          onUpdatePotentialShared={updatePotentialShared}
          onUpdatePotentialNumber={updatePotentialNumber}
          onDeleteSelection={handleDeleteSelection}
          onMoveSelection={moveSelection}
          onAlignSelection={alignSelection}
          onRotateSelection={rotateSelection}
          onMirrorSelection={mirrorSelection}
          potentialList={potentialList}
          onRenumberPotentials={handleRenumberPotentials}
          onNavigateToPotential={(pageId, bounds) => {
            setActivePageId(pageId);
            setNavigateTarget({ pageId, bounds });
          }}
          activeLayer={activeLayer}
          layers={layers}
          activeLayerId={activeLayerId}
          onAddLayer={handleAddLayer}
          onDeleteLayer={handleDeleteLayer}
          onSelectLayer={setActiveLayerId}
          onToggleLayerVisibility={toggleLayerVisibility}
          onToggleLayerLock={toggleLayerLock}
          onRenameLayer={handleRenameLayer}
          pdfSettings={pdfSettings}
          onPdfSettingsChange={setPdfSettings}
          gridSize={gridSize}
          onGridSizeChange={setGridSize}
          gridColor={gridColor}
          onGridColorChange={setGridColor}
          snapEnabled={snapEnabled}
          onSnapEnabledChange={setSnapEnabled}
          showPinConnection={showPinConnection}
          onShowPinConnectionChange={setShowPinConnection}
        />
      </div>
      <div className="page-tabs" role="tablist" aria-label="Pages">
        {pages.map((page, index) => (
          <button
            key={page.id}
            className={page.id === activePageId ? "page-tab active" : "page-tab"}
            onClick={() => setActivePageId(page.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              if (pages.length <= 1) return;
              setPageMenu({ id: page.id, x: event.clientX, y: event.clientY });
            }}
          >
            {page.name || `Page ${index + 1}`}
          </button>
        ))}
        <button
          className="page-tab add"
          onClick={() => {
            const nextId = createId("page");
            const nextName = `Page ${pages.length + 1}`;
            setPages((prev) => [...prev, { id: nextId, name: nextName, shapes: [] }]);
            setActivePageId(nextId);
          }}
        >
          +
        </button>
      </div>
      {pageMenu && (
        <div className="context-menu" style={{ top: pageMenu.y, left: pageMenu.x }}>
          <button
            type="button"
            className="context-menu-item danger"
            onClick={() => {
              handleDeletePage(pageMenu.id);
              setPageMenu(null);
            }}
          >
            Delete page
          </button>
        </div>
      )}
      {selectionMenu && (
        <div className="context-menu" style={{ top: selectionMenu.y, left: selectionMenu.x }}>
          {canGroupSelection && (
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                handleGroupSelection();
                setSelectionMenu(null);
              }}
            >
              Group selection
            </button>
          )}
          {canUngroupSelection && (
            <button
              type="button"
              className="context-menu-item"
              onClick={() => {
                handleUngroupSelection();
                setSelectionMenu(null);
              }}
            >
              Ungroup
            </button>
          )}
          {canMoveSelection && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-label">Move to layer</div>
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    handleMoveSelectionToLayer(layer.id);
                    setSelectionMenu(null);
                  }}
                >
                  {layer.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}







