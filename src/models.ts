export type Tool = "select" | "line" | "circle" | "arc" | "text" | "pin" | "potential" | "pan";

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type LineStyle = "solid" | "dashed" | "dotted";

export type ShapeType = "line" | "circle" | "arc" | "text" | "pin" | "potential" | "group";

export type BaseShape = {
  id: string;
  type: ShapeType;
  layerId: string;
  lineColor: string;
  lineWidth: number;
  fill: string;
  lineStyle?: LineStyle;
};

export type LineShape = BaseShape & {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PotentialShape = BaseShape & {
  type: "potential";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  potentialNumber: number;
  potentialName?: string;
  potentialDiameter?: number | null;
};

export type CircleShape = BaseShape & {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
};

export type ArcShape = BaseShape & {
  type: "arc";
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
};

export type TextShape = BaseShape & {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  linkEnabled?: boolean;
  linkTarget?: string;
};

export type PinShape = BaseShape & {
  type: "pin";
  x: number;
  y: number;
  tag: string;
  tagX: number;
  tagY: number;
  tagFontSize: number;
};

export type GroupShape = BaseShape & {
  type: "group";
  children: Shape[];
};

export type Shape = LineShape | CircleShape | ArcShape | TextShape | PinShape | PotentialShape | GroupShape;

export type Component = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  shapes: Shape[];
  gridOffsetX: number;
  gridOffsetY: number;
};

export type ComponentSource = "app" | "project";

export type LibraryComponent = Component & {
  source: ComponentSource;
  readOnly: boolean;
  fileName?: string;
};

export type AppLibraryComponentFile = {
  schema: "basic2dcad.app-library-component";
  version: 1;
  component: Component;
};

export type Page = {
  id: string;
  name: string;
  shapes: Shape[];
};

export type CadFile = {
  version: number;
  layers: Layer[];
  pages: Page[];
  components: Component[];
};

export type ViewState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type Point = {
  x: number;
  y: number;
};

export type PdfSettings = {
  size: "A4" | "A3";
  orientation: "portrait" | "landscape";
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  project: string;
  drawing: string;
  author: string;
};