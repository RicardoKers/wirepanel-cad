import type { PdfSettings, Point } from "../models";

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type MarkerCell = {
  row: number;
  col: number;
};

export type MarkerLayout = {
  pageWidth: number;
  pageHeight: number;
  frameX: number;
  frameY: number;
  frameWidth: number;
  frameHeight: number;
  markerRows: number;
  markerCols: number;
  markerBandWidth: number;
  markerBandHeight: number;
  columnWidth: number;
  rowHeight: number;
  showMarkers: boolean;
};

const markerSize = 5;

export function getMarkerLayout(pdfSettings: PdfSettings): MarkerLayout {
  const pageSizes: Record<PdfSettings["size"], { width: number; height: number }> = {
    A4: { width: 210, height: 297 },
    A3: { width: 297, height: 420 }
  };
  const pageSize = pageSizes[pdfSettings.size];
  const pageWidth = pdfSettings.orientation === "portrait" ? pageSize.width : pageSize.height;
  const pageHeight = pdfSettings.orientation === "portrait" ? pageSize.height : pageSize.width;
  const frameX = Math.max(0, pdfSettings.marginLeftMm);
  const frameY = Math.max(0, pdfSettings.marginTopMm);
  const frameWidth = Math.max(0, pageWidth - frameX - Math.max(0, pdfSettings.marginRightMm));
  const frameHeight = Math.max(0, pageHeight - frameY - Math.max(0, pdfSettings.marginBottomMm));
  const markerRows = pdfSettings.orientation === "landscape" ? 6 : 8;
  const markerCols = pdfSettings.orientation === "landscape" ? 8 : 6;
  const markerBandWidth = Math.min(markerSize, frameWidth);
  const markerBandHeight = Math.min(markerSize, frameHeight);
  const contentWidth = Math.max(0, frameWidth - markerBandWidth);
  const contentHeight = Math.max(0, frameHeight - markerBandHeight);
  const columnWidth = markerCols > 0 ? contentWidth / markerCols : 0;
  const rowHeight = markerRows > 0 ? contentHeight / markerRows : 0;
  const showMarkers = contentWidth > 0 && contentHeight > 0 && markerBandWidth > 0 && markerBandHeight > 0;

  return {
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
  };
}

export function pointToMarker(point: Point, layout: MarkerLayout): MarkerCell | null {
  if (!layout.showMarkers) return null;
  const originX = layout.frameX + layout.markerBandWidth;
  const originY = layout.frameY + layout.markerBandHeight;
  const x = point.x - originX;
  const y = point.y - originY;
  if (x < 0 || y < 0) return null;
  if (x > layout.columnWidth * layout.markerCols) return null;
  if (y > layout.rowHeight * layout.markerRows) return null;
  const col = Math.min(layout.markerCols - 1, Math.max(0, Math.floor(x / layout.columnWidth)));
  const row = Math.min(layout.markerRows - 1, Math.max(0, Math.floor(y / layout.rowHeight)));
  return { row, col };
}

export function markerToBounds(cell: MarkerCell, layout: MarkerLayout): Bounds {
  const originX = layout.frameX + layout.markerBandWidth;
  const originY = layout.frameY + layout.markerBandHeight;
  const minX = originX + layout.columnWidth * cell.col;
  const minY = originY + layout.rowHeight * cell.row;
  return {
    minX,
    minY,
    maxX: minX + layout.columnWidth,
    maxY: minY + layout.rowHeight
  };
}

export function formatMarkerAddress(pageIndex: number, cell: MarkerCell): string {
  const rowLetter = String.fromCharCode(65 + cell.row);
  return `${pageIndex + 1}.${rowLetter}${cell.col + 1}`;
}

export function parseMarkerAddress(target: string | undefined, totalPages: number, layout: MarkerLayout) {
  if (!target) return null;
  const match = target.trim().toUpperCase().match(/^(\d+)\.([A-Z])(\d+)$/);
  if (!match) return null;
  const pageNumber = Number(match[1]);
  const rowLetter = match[2];
  const colNumber = Number(match[3]);
  if (!Number.isFinite(pageNumber) || !Number.isFinite(colNumber)) return null;
  if (pageNumber < 1 || pageNumber > totalPages) return null;
  const rowIndex = rowLetter.charCodeAt(0) - 65;
  if (rowIndex < 0 || rowIndex >= layout.markerRows) return null;
  if (colNumber < 1 || colNumber > layout.markerCols) return null;
  const colIndex = colNumber - 1;
  const bounds = markerToBounds({ row: rowIndex, col: colIndex }, layout);
  return { pageIndex: pageNumber - 1, bounds };
}
