import { useRef } from "react";
import type { ChangeEvent } from "react";
import type { Tool } from "../models";

type ToolbarProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onSaveJson: () => void;
  onLoadJson: (file: File) => void;
  onExportPdf: () => void;
};

const tools: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "line", label: "Line" },
  { id: "potential", label: "Potential" },
  { id: "circle", label: "Circle" },
  { id: "arc", label: "Arc" },
  { id: "text", label: "Text" },
  { id: "pin", label: "Pin" },
  { id: "pan", label: "Pan" }
];

export default function Toolbar({
  tool,
  onToolChange,
  onSaveJson,
  onLoadJson,
  onExportPdf
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
            key={item.id}
            className={item.id === tool ? "tool-button active" : "tool-button"}
            onClick={() => onToolChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="toolbar-section">
        <button className="tool-button" onClick={onSaveJson}>Download Project</button>
        <button className="tool-button" onClick={() => fileInputRef.current?.click()}>Upload Project</button>
        <button className="tool-button primary" onClick={onExportPdf}>Export PDF</button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFilePick} hidden />
      </div>
    </header>
  );
}
