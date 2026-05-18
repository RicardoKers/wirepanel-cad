import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ComponentInstance, Layer, PdfSettings, Shape } from "../models";
import LayersPanel from "./LayersPanel";
import PropertiesPanel from "./PropertiesPanel";
import SettingsPanel from "./SettingsPanel";
import PotentialsPanel from "./PotentialsPanel";
import ComponentInstancesPanel from "./ComponentInstancesPanel";

type RightPanelProps = {
  selectedShape: Shape | null;
  selectionCount: number;
  selectedComponentInstance: ComponentInstance | null;
  componentParentOptions: ComponentParentOption[];
  onUpdateComponentInstance: (componentId: string, updater: (instance: ComponentInstance) => ComponentInstance) => void;
  onUpdateShape: (id: string, updater: (shape: Shape) => Shape) => void;
  onUpdatePotentialShared: (id: string, changes: PotentialSharedChanges) => void;
  onUpdatePotentialNumber: (id: string, nextNumber: number) => void;
  onDeleteSelection: () => void;
  onMoveSelection: (dx: number, dy: number) => void;
  onAlignSelection: (mode: "left" | "right" | "top" | "bottom" | "centerX" | "centerY") => void;
  onRotateSelection: (degrees: number) => void;
  onMirrorSelection: (axis: "horizontal" | "vertical") => void;
  componentInstanceItems: ComponentInstanceListItem[];
  onNavigateToComponent: (pageId: string, bounds: Bounds) => void;
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
type ComponentInstanceListItem = {
  instance: ComponentInstance;
  pageName: string;
  bounds: Bounds | null;
};
type ComponentParentOption = {
  componentId: string;
  tag: string;
  type: string;
};
type PotentialSharedChanges = {
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  potentialName?: string;
  potentialDiameter?: number | null;
  layerId?: string;
};

type TabId = "properties" | "components" | "potentials" | "layers" | "settings";

type TabItem = {
  id: TabId;
  icon: ReactNode;
};

const tabItems: TabItem[] = [
  {
    id: "properties",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="1.5" />
        <circle cx="8" cy="8" r="2" />
      </svg>
    )
  },
  {
    id: "components",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2.5" y="3" width="6" height="4" rx="1" />
        <rect x="7.5" y="9" width="6" height="4" rx="1" />
        <path d="M8.5 5h2v4" />
      </svg>
    )
  },
  {
    id: "potentials",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M9 1.8 4.2 8.3h3.4L6.9 14.2l4.9-6.8H8.4L9 1.8Z" />
      </svg>
    )
  },
  {
    id: "layers",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.4 13.2 5 8 7.6 2.8 5 8 2.4Z" />
        <path d="m13.2 8-5.2 2.6L2.8 8" />
        <path d="m13.2 11-5.2 2.6L2.8 11" />
      </svg>
    )
  },
  {
    id: "settings",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="2.4" />
        <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6 5 5M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4" />
      </svg>
    )
  }
];

export default function RightPanel({
  selectedShape,
  selectionCount,
  selectedComponentInstance,
  componentParentOptions,
  onUpdateComponentInstance,
  onUpdateShape,
  onUpdatePotentialShared,
  onUpdatePotentialNumber,
  onDeleteSelection,
  onMoveSelection,
  onAlignSelection,
  onRotateSelection,
  onMirrorSelection,
  componentInstanceItems,
  onNavigateToComponent,
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("properties");

  return (
    <aside className="right-panel">
      <nav className="right-panel-nav" role="tablist" aria-label={t("rightPanel.tabsAriaLabel")}>
        {tabItems.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "right-panel-nav-button active" : "right-panel-nav-button"}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="right-panel-nav-icon">{tab.icon}</span>
            <span>{t(`rightPanel.tabs.${tab.id}`)}</span>
          </button>
        ))}
      </nav>
      <div className="tab-content">
        {activeTab === "properties" && (
          <PropertiesPanel
            selectedShape={selectedShape}
            selectionCount={selectionCount}
            selectedComponentInstance={selectedComponentInstance}
            componentParentOptions={componentParentOptions}
            onUpdateComponentInstance={onUpdateComponentInstance}
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
        {activeTab === "components" && (
          <ComponentInstancesPanel
            items={componentInstanceItems}
            onNavigateToComponent={onNavigateToComponent}
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
