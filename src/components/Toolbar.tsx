import { useRef } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Tool } from "../models";

type ToolbarProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onFitToPage: () => void;
  onSaveJson: () => void;
  onLoadJson: (file: File) => void;
  onExportPdf: () => void;
};

const tools: Tool[] = ["select", "line", "potential", "circle", "arc", "text", "pin", "pan"];

export default function Toolbar({
  tool,
  onToolChange,
  onFitToPage,
  onSaveJson,
  onLoadJson,
  onExportPdf
}: ToolbarProps) {
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualFileName = i18n.resolvedLanguage === "pt-BR" ? "manual.pt-BR.html" : "manual.en.html";
  const manualHref = `${import.meta.env.BASE_URL}help/${manualFileName}`;

  function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onLoadJson(file);
    event.target.value = "";
  }

  return (
    <header className="toolbar">
      <div className="toolbar-section">
        {tools.map((item) => (
          <button
            key={item}
            className={item === tool ? "tool-button active" : "tool-button"}
            onClick={() => onToolChange(item)}
          >
            {t(`toolbar.tools.${item}`)}
          </button>
        ))}
      </div>
      <div className="toolbar-section">
        <button className="tool-button" onClick={onFitToPage}>{t("toolbar.actions.fitToPage")}</button>
        <button className="tool-button" onClick={onSaveJson}>{t("toolbar.actions.downloadProject")}</button>
        <button className="tool-button" onClick={() => fileInputRef.current?.click()}>{t("toolbar.actions.uploadProject")}</button>
        <a className="tool-button" href={manualHref} target="_blank" rel="noreferrer">{t("toolbar.actions.help")}</a>
        <button className="tool-button primary" onClick={onExportPdf}>{t("toolbar.actions.exportPdf")}</button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFilePick} hidden />
      </div>
    </header>
  );
}
