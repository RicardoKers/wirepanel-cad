import { useTranslation } from "react-i18next";
import type { PdfSettings } from "../models";
import { supportedLanguages, type SupportedLanguage } from "../i18n/resources";

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
  const { t, i18n } = useTranslation();
  const currentLanguage: SupportedLanguage = i18n.resolvedLanguage === "pt-BR" ? "pt-BR" : "en";

  return (
    <div className="settings-stack">
      <section className="panel">
        <header className="panel-header">
          <h3>{t("settings.sections.language")}</h3>
        </header>
        <div className="panel-body settings-grid">
          <label>
            {t("language.label")}
            <select
              value={currentLanguage}
              onChange={(event) => {
                void i18n.changeLanguage(event.target.value as SupportedLanguage);
              }}
            >
              {supportedLanguages.map((language) => (
                <option key={language} value={language}>
                  {language === "en" ? t("language.english") : t("language.portugueseBrazil")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="panel">
        <header className="panel-header">
          <h3>{t("settings.sections.pdf")}</h3>
        </header>
        <div className="panel-body settings-grid">
          <label>
            {t("settings.fields.project")}
            <input
              type="text"
              value={pdfSettings.project}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, project: event.target.value })
              }
            />
          </label>
          <label>
            {t("settings.fields.drawing")}
            <input
              type="text"
              value={pdfSettings.drawing}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, drawing: event.target.value })
              }
            />
          </label>
          <label>
            {t("settings.fields.author")}
            <input
              type="text"
              value={pdfSettings.author}
              onChange={(event) =>
                onPdfSettingsChange({ ...pdfSettings, author: event.target.value })
              }
            />
          </label>
          <label>
            {t("settings.fields.sheet")}
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
            {t("settings.fields.orientation")}
            <select
              value={pdfSettings.orientation}
              onChange={(event) =>
                onPdfSettingsChange({
                  ...pdfSettings,
                  orientation: event.target.value as PdfSettings["orientation"]
                })
              }
            >
              <option value="portrait">{t("settings.fields.portrait")}</option>
              <option value="landscape">{t("settings.fields.landscape")}</option>
            </select>
          </label>
          <label>
            {t("settings.fields.marginLeft")}
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
            {t("settings.fields.marginRight")}
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
            {t("settings.fields.marginTop")}
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
            {t("settings.fields.marginBottom")}
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
          <h3>{t("settings.sections.grid")}</h3>
        </header>
        <div className="panel-body grid-panel">
          <label className="row">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(event) => onSnapEnabledChange(event.target.checked)}
            />
            {t("settings.fields.snap")}
          </label>
          <label className="row">
            {t("settings.fields.size")}
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={gridSize}
              onChange={(event) => onGridSizeChange(Number(event.target.value) || 0.1)}
            />
          </label>
          <label className="row">
            {t("settings.fields.color")}
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
          <h3>{t("settings.sections.pins")}</h3>
        </header>
        <div className="panel-body grid-panel">
          <label className="row">
            <input
              type="checkbox"
              checked={showPinConnection}
              onChange={(event) => onShowPinConnectionChange(event.target.checked)}
            />
            {t("settings.fields.showConnectionX")}
          </label>
        </div>
      </section>
    </div>
  );
}
