import type { PdfSettings } from "../models";

type SettingsPanelProps = {
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

export default function SettingsPanel({
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
}: SettingsPanelProps) {
  return (
    <div className="settings-stack">
      <section className="panel">
        <header className="panel-header">
          <h3>PDF Settings</h3>
        </header>
        <div className="panel-body settings-grid">
          <label>
            Project
            <input
              type="text"
              value={pdfSettings.project}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, project: event.target.value })
              }
            />
          </label>
          <label>
            Drawing
            <input
              type="text"
              value={pdfSettings.drawing}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, drawing: event.target.value })
              }
            />
          </label>
          <label>
            Author
            <input
              type="text"
              value={pdfSettings.author}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, author: event.target.value })
              }
            />
          </label>
          <label>
            Sheet
            <select
              value={pdfSettings.size}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, size: event.target.value as PdfSettings["size"] })
              }
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </label>
          <label>
            Orientation
            <select
              value={pdfSettings.orientation}
              onChange={(event) =>
                onPdfSettingsChange({
                  ...pdfSettings,
                  orientation: event.target.value as PdfSettings["orientation"]
                })
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>
            Margin Left
            <input
              type="number"
              min={0}
              step={1}
              value={pdfSettings.marginLeftMm}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, marginLeftMm: Number(event.target.value) || 0 })
              }
            />
          </label>
          <label>
            Margin Right
            <input
              type="number"
              min={0}
              step={1}
              value={pdfSettings.marginRightMm}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, marginRightMm: Number(event.target.value) || 0 })
              }
            />
          </label>
          <label>
            Margin Top
            <input
              type="number"
              min={0}
              step={1}
              value={pdfSettings.marginTopMm}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, marginTopMm: Number(event.target.value) || 0 })
              }
            />
          </label>
          <label>
            Margin Bottom
            <input
              type="number"
              min={0}
              step={1}
              value={pdfSettings.marginBottomMm}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, marginBottomMm: Number(event.target.value) || 0 })
              }
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <h3>Grid</h3>
        </header>
        <div className="panel-body grid-panel">
          <label className="row">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(event) => onSnapEnabledChange(event.target.checked)}
            />
            Snap
          </label>
          <label className="row">
            Size
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={gridSize}
              onChange={(event) => onGridSizeChange(Number(event.target.value) || 0.1)}
            />
          </label>
          <label className="row">
            Color
            <input
              type="color"
              value={gridColor}
              onChange={(event) => onGridColorChange(event.target.value)}
            />
          </label>
        </div>
      </section>
      <section className="panel">
        <header className="panel-header">
          <h3>Pins</h3>
        </header>
        <div className="panel-body grid-panel">
          <label className="row">
            <input
              type="checkbox"
              checked={showPinConnection}
              onChange={(event) => onShowPinConnectionChange(event.target.checked)}
            />
            Show connection X
          </label>
        </div>
      </section>
    </div>
  );
}
