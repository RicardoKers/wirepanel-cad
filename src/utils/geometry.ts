import type { ArcShape, Point, Shape } from "../models";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function distance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function angleBetween(center: Point, point: Point) {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

export function normalizeAngle(angle: number) {
  let a = angle;
  const twoPi = Math.PI * 2;
  while (a < 0) a += twoPi;
  while (a >= twoPi) a -= twoPi;
  return a;
}

export function arcToPath(arc: ArcShape) {
  const startX = arc.cx + arc.r * Math.cos(arc.startAngle);
  const startY = arc.cy + arc.r * Math.sin(arc.startAngle);
  const endX = arc.cx + arc.r * Math.cos(arc.endAngle);
  const endY = arc.cy + arc.r * Math.sin(arc.endAngle);
  const delta = arc.endAngle - arc.startAngle;
  const largeArcFlag = Math.abs(delta) > Math.PI ? 1 : 0;
  const sweepFlag = delta >= 0 ? 1 : 0;
  return `M ${startX} ${startY} A ${arc.r} ${arc.r} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
}

export function translateShape(shape: Shape, dx: number, dy: number): Shape {
  switch (shape.type) {
    case "line":
      return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
    case "potential":
      return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy };
    case "circle":
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
    case "arc":
      return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
    case "text":
      return { ...shape, x: shape.x + dx, y: shape.y + dy };
    case "pin":
      return {
        ...shape,
        x: shape.x + dx,
        y: shape.y + dy,
        tagX: shape.tagX + dx,
        tagY: shape.tagY + dy
      };
    case "group":
      return { ...shape, children: shape.children.map((child) => translateShape(child, dx, dy)) };
    default:
      return shape;
  }
}

export function getShapeBounds(shape: Shape): Bounds {
  switch (shape.type) {
    case "line": {
      const minX = Math.min(shape.x1, shape.x2);
      const minY = Math.min(shape.y1, shape.y2);
      const maxX = Math.max(shape.x1, shape.x2);
      const maxY = Math.max(shape.y1, shape.y2);
      return { minX, minY, maxX, maxY };
    }
    case "potential": {
      const minX = Math.min(shape.x1, shape.x2);
      const minY = Math.min(shape.y1, shape.y2);
      const maxX = Math.max(shape.x1, shape.x2);
      const maxY = Math.max(shape.y1, shape.y2);
      return { minX, minY, maxX, maxY };
    }
    case "circle":
      return { minX: shape.cx - shape.r, minY: shape.cy - shape.r, maxX: shape.cx + shape.r, maxY: shape.cy + shape.r };
    case "arc":
      return { minX: shape.cx - shape.r, minY: shape.cy - shape.r, maxX: shape.cx + shape.r, maxY: shape.cy + shape.r };
    case "text":
      return { minX: shape.x, minY: shape.y - shape.fontSize, maxX: shape.x + shape.text.length * (shape.fontSize * 0.6), maxY: shape.y };
    case "pin": {
      const cross = 1;
      const textWidth = shape.tag.length * (shape.tagFontSize * 0.6);
      const textHalfHeight = shape.tagFontSize / 2;
      const minX = Math.min(shape.x - cross, shape.tagX);
      const minY = Math.min(shape.y - cross, shape.tagY - textHalfHeight);
      const maxX = Math.max(shape.x + cross, shape.tagX + textWidth);
      const maxY = Math.max(shape.y + cross, shape.tagY + textHalfHeight);
      return { minX, minY, maxX, maxY };
    }
    case "group": {
      if (shape.children.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      return shape.children.reduce<Bounds>(
        (acc, child) => {
          const bounds = getShapeBounds(child);
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
    default:
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
}


