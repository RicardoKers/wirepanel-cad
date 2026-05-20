import type { AppLibraryComponentFile, Component, ComponentLabel, ComponentSource, LibraryComponent, Shape } from "../models";
import { createId } from "./id";
import { getShapeBounds, translateShape } from "./geometry";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export const appLibraryComponentSchema = "wirepanel-cad.app-library-component" as const;
const legacyAppLibraryComponentSchemas = ["basic2dcad.app-library-component"] as const;
export const appLibraryComponentVersion = 1 as const;

export function cloneShape(shape: Shape): Shape {
  if (shape.type === "group") {
    return { ...shape, children: shape.children.map((child) => cloneShape(child)) };
  }
  return { ...shape };
}

export function cloneShapeWithNewIds(shape: Shape, nextPotentialNumberRef?: { value: number }): Shape {
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

export function getComponentBounds(shapes: Shape[]): Bounds {
  return shapes.reduce(
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

function normalizeShapeIds(shapes: Shape[]) {
  const counterRef = { value: 1 };

  const visit = (shape: Shape): Shape => {
    const nextId = `shape_${counterRef.value}`;
    counterRef.value += 1;
    if (shape.type === "group") {
      return {
        ...shape,
        id: nextId,
        children: shape.children.map((child) => visit(child))
      };
    }
    return {
      ...shape,
      id: nextId
    };
  };

  return shapes.map((shape) => visit(shape));
}

export function createComponentDefinition(
  sourceShapes: Shape[],
  options: {
    id: string;
    name: string;
    gridSize: number;
    category?: string;
    description?: string;
    tags?: string[];
    normalizeIds?: boolean;
    defaultTagPrefix?: string;
    defaultComponentType?: string;
    defaultLabel?: ComponentLabel;
    defaultShowParentLink?: boolean;
    defaultParentLinkOffsetX?: number;
    defaultParentLinkOffsetY?: number;
    defaultParentLinkRotation?: number;
  }
): Component {
  const bounds = getComponentBounds(sourceShapes);
  const originX = Number.isFinite(bounds.minX) ? bounds.minX : 0;
  const originY = Number.isFinite(bounds.minY) ? bounds.minY : 0;
  const translated = sourceShapes.map((shape) => translateShape(cloneShape(shape), -originX, -originY));
  const shapes = options.normalizeIds ? normalizeShapeIds(translated) : translated;
  const safeGrid = options.gridSize > 0 ? options.gridSize : 0;

  return {
    id: options.id,
    name: options.name.trim() || options.id,
    category: options.category?.trim() ?? "",
    description: options.description?.trim() ?? "",
    tags: options.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
    shapes,
    gridOffsetX: safeGrid ? ((originX % safeGrid) + safeGrid) % safeGrid : 0,
    gridOffsetY: safeGrid ? ((originY % safeGrid) + safeGrid) % safeGrid : 0,
    defaultTagPrefix: options.defaultTagPrefix?.trim().toUpperCase() || undefined,
    defaultComponentType: options.defaultComponentType?.trim() || undefined,
    defaultLabel: options.defaultLabel ? { ...options.defaultLabel } : undefined,
    defaultShowParentLink: options.defaultShowParentLink,
    defaultParentLinkOffsetX: options.defaultParentLinkOffsetX,
    defaultParentLinkOffsetY: options.defaultParentLinkOffsetY,
    defaultParentLinkRotation: options.defaultParentLinkRotation
  };
}

export function instantiateComponent(
  component: Component,
  options: {
    x: number;
    y: number;
    gridSize: number;
    snapEnabled: boolean;
    activeLayerId: string;
    nextPotentialNumber: number;
  }
) {
  const bounds = getComponentBounds(component.shapes);
  let targetX = options.x;
  let targetY = options.y;

  if (options.snapEnabled && options.gridSize > 0) {
    const offsetModX = component.gridOffsetX ?? (((bounds.minX % options.gridSize) + options.gridSize) % options.gridSize);
    const offsetModY = component.gridOffsetY ?? (((bounds.minY % options.gridSize) + options.gridSize) % options.gridSize);
    const adjustX = ((targetX - offsetModX) % options.gridSize + options.gridSize) % options.gridSize;
    const adjustY = ((targetY - offsetModY) % options.gridSize + options.gridSize) % options.gridSize;
    targetX -= adjustX;
    targetY -= adjustY;
  }

  const dx = Number.isFinite(bounds.minX) ? targetX - bounds.minX : targetX;
  const dy = Number.isFinite(bounds.minY) ? targetY - bounds.minY : targetY;
  const nextPotentialNumberRef = { value: options.nextPotentialNumber };

  const assignLayerAndIds = (shape: Shape): Shape => {
    if (shape.type === "group") {
      return {
        ...shape,
        id: createId("shape"),
        layerId: options.activeLayerId,
        children: shape.children.map((child) => assignLayerAndIds(child))
      };
    }
    if (shape.type === "potential") {
      const number = nextPotentialNumberRef.value;
      nextPotentialNumberRef.value += 1;
      return {
        ...shape,
        id: createId("shape"),
        layerId: options.activeLayerId,
        potentialNumber: number
      };
    }
    return {
      ...shape,
      id: createId("shape"),
      layerId: options.activeLayerId
    };
  };

  return component.shapes.map((shape) => assignLayerAndIds(translateShape(shape, dx, dy)));
}

export function slugifyComponentName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "component";
}

export function buildComponentPlacementKey(source: ComponentSource, componentId: string) {
  return `${source}:${componentId}`;
}

export function parseComponentPlacementKey(value: string | null): { source: ComponentSource; componentId: string } | null {
  if (!value) return null;
  const [source, ...rest] = value.split(":");
  const componentId = rest.join(":");
  if (!componentId) return null;
  if (source !== "app" && source !== "project") return null;
  return {
    source,
    componentId
  };
}

export function buildAppLibraryComponentFile(component: Component): AppLibraryComponentFile {
  const normalizedComponent = createComponentDefinition(component.shapes, {
    id: component.id,
    name: component.name,
    category: component.category,
    description: component.description,
    tags: component.tags,
    gridSize: 0,
    normalizeIds: true,
    defaultTagPrefix: component.defaultTagPrefix,
    defaultComponentType: component.defaultComponentType,
    defaultLabel: component.defaultLabel,
    defaultShowParentLink: component.defaultShowParentLink,
    defaultParentLinkOffsetX: component.defaultParentLinkOffsetX,
    defaultParentLinkOffsetY: component.defaultParentLinkOffsetY,
    defaultParentLinkRotation: component.defaultParentLinkRotation
  });

  return {
    schema: appLibraryComponentSchema,
    version: appLibraryComponentVersion,
    component: {
      ...normalizedComponent,
      gridOffsetX: component.gridOffsetX,
      gridOffsetY: component.gridOffsetY
    }
  };
}

export function toLibraryComponent(
  file: AppLibraryComponentFile,
  options: { fileName?: string; source?: ComponentSource } = {}
): LibraryComponent {
  return {
    ...file.component,
    source: options.source ?? "app",
    readOnly: true,
    fileName: options.fileName
  };
}

export function isShapeValue(value: unknown): value is Shape {
  return typeof value === "object" && value !== null &&
    typeof (value as Shape).id === "string" &&
    typeof (value as Shape).type === "string" &&
    typeof (value as Shape).layerId === "string";
}

export function isComponentValue(value: unknown): value is Component {
  return typeof value === "object" && value !== null &&
    typeof (value as Component).id === "string" &&
    typeof (value as Component).name === "string" &&
    typeof (value as Component).category === "string" &&
    typeof (value as Component).description === "string" &&
    Array.isArray((value as Component).tags) &&
    (value as Component).tags.every((tag) => typeof tag === "string") &&
    Array.isArray((value as Component).shapes) &&
    (value as Component).shapes.every((shape) => isShapeValue(shape)) &&
    typeof (value as Component).gridOffsetX === "number" &&
    typeof (value as Component).gridOffsetY === "number" &&
    (typeof (value as Component).defaultTagPrefix === "undefined" ||
      typeof (value as Component).defaultTagPrefix === "string") &&
    (typeof (value as Component).defaultComponentType === "undefined" ||
      typeof (value as Component).defaultComponentType === "string") &&
    (typeof (value as Component).defaultShowParentLink === "undefined" ||
      typeof (value as Component).defaultShowParentLink === "boolean") &&
    (typeof (value as Component).defaultParentLinkOffsetX === "undefined" ||
      typeof (value as Component).defaultParentLinkOffsetX === "number") &&
    (typeof (value as Component).defaultParentLinkOffsetY === "undefined" ||
      typeof (value as Component).defaultParentLinkOffsetY === "number") &&
    (typeof (value as Component).defaultParentLinkRotation === "undefined" ||
      typeof (value as Component).defaultParentLinkRotation === "number");
}

export function isAppLibraryComponentFile(value: unknown): value is AppLibraryComponentFile {
  if (typeof value !== "object" || value === null) return false;
  const schema = (value as AppLibraryComponentFile).schema;
  return (schema === appLibraryComponentSchema || legacyAppLibraryComponentSchemas.includes(schema as never)) &&
    (value as AppLibraryComponentFile).version === appLibraryComponentVersion &&
    isComponentValue((value as AppLibraryComponentFile).component);
}
