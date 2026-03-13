import { useState } from "react";
import type { Layer, PdfSettings, Shape } from "../models";
import LayersPanel from "./LayersPanel";
import PropertiesPanel from "./PropertiesPanel";
import SettingsPanel from "./SettingsPanel";
import PotentialsPanel from "./PotentialsPanel";

type RightPanelProps = {
  selectedShape: Shape | null;
  selectionCount: number;
  onUpdateShape: (id: string, updater: (shape: Shape) => Shape) => void;
  onUpdatePotentialShared: (id: string, changes: PotentialSharedChanges) => void;
  onUpdatePotentialNumber: (id: string, nextNumber: number) => void;
  onDeleteSelection: () => void;
  onMoveSelection: (dx: number, dy: number) => void;
  onAlignSelection: (mode: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;
  onRotateSelection: (degrees: number) => void;
  onMirrorSelection: (axis: "horizontal" | "vertical") => void;
  potentialList: { number: number; name: string; diameter: number | null; pageId: string; bounds: Bounds }[];
  onRenumberPotentials: () => void;
  onNavigateToPotential: (pageId: string, bounds: Bounds) => void;
  activeLayer: Layer | undefined;
  layers: Layer[];
  activeLayerId: string;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  pdfSettings: PdfSettings;
  onPdfSettingsChange: (settings: PdfSettings) => void;
  gridSize: number;
  onGridSizeChange: (value: number) => void;
  gridColor: string;
  onGridColorChange: (value: string) => void;
  snapEnabled: boolean;
  onSnapEnabledChange: (value: boolean) => void;
  showPinConnection: boolean;
  onShowPinConnectionChange: (value: boolean) => void;
};

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type PotentialSharedChanges = {
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  potentialName?: string;
  potentialDiameter?: number | null;
  layerId?: string;
};

type TabId = "properties" | "potentials" | "layers" | "settings";

const tabs: { id: TabId; label: string }[] = [
  { id: "properties", label: "Properties" },
  { id: "potentials", label: "Potentials" },
  { id: "layers", label: "Layers" },
  { id: "settings", label: "Settings" }
];

export default function RightPanel({
  selectedShape,
  selectionCount,
  onUpdateShape,
  onUpdatePotentialShared,
  onUpdatePotentialNumber,
  onDeleteSelection,
  onMoveSelection,
  onAlignSelection,
  onRotateSelection,
  onMirrorSelection,
  potentialList,
  onRenumberPotentials,
  onNavigateToPotential,
  activeLayer,
  layers,
  activeLayerId,
  onAddLayer,
  onDeleteLayer,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onRenameLayer,
  pdfSettings,
  onPdfSettingsChange,
  gridSize,
  onGridSizeChange,
  gridColor,
  onGridColorChange,
  snapEnabled,
  onSnapEnabledChange,
  showPinConnection,
  onShowPinConnectionChange
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("properties");

  return (
    <aside className="right-panel">
      <div className="tab-bar" role="tablist" aria-label="Inspector tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {activeTab === "properties" && (
          <PropertiesPanel
            selectedShape={selectedShape}
            selectionCount={selectionCount}
            layers={layers}
            onUpdateShape={onUpdateShape}
            onUpdatePotentialShared={onUpdatePotentialShared}
            onUpdatePotentialNumber={onUpdatePotentialNumber}
            onDeleteSelection={onDeleteSelection}
            onMoveSelection={onMoveSelection}
            onAlignSelection={onAlignSelection}
            onRotateSelection={onRotateSelection}
            onMirrorSelection={onMirrorSelection}
            activeLayer={activeLayer}
          />
        )}
        {activeTab === "potentials" && (
          <PotentialsPanel
            potentials={potentialList}
            onNavigateToPotential={onNavigateToPotential}
            onRenumberPotentials={onRenumberPotentials}
          />
        )}
        {activeTab === "layers" && (
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onAddLayer={onAddLayer}
            onDeleteLayer={onDeleteLayer}
            onSelectLayer={onSelectLayer}
            onToggleLayerVisibility={onToggleLayerVisibility}
            onToggleLayerLock={onToggleLayerLock}
            onRenameLayer={onRenameLayer}
          />
        )}
        {activeTab === "settings" && (
          <SettingsPanel
            pdfSettings={pdfSettings}
            onPdfSettingsChange={onPdfSettingsChange}
            gridSize={gridSize}
            onGridSizeChange={onGridSizeChange}
            gridColor={gridColor}
            onGridColorChange={onGridColorChange}
            snapEnabled={snapEnabled}
            onSnapEnabledChange={onSnapEnabledChange}
            showPinConnection={showPinConnection}
            onShowPinConnectionChange={onShowPinConnectionChange}
          />
        )}
      </div>
    </aside>
  );
}
