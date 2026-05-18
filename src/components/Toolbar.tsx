import { useRef } from "react";
import type { ChangeEvent, ReactNode } from "react";
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

type ToolbarTool = {
  id: Tool;
  icon: ReactNode;
};

type ToolbarAction = {
  id: "fitToPage" | "downloadProject" | "uploadProject" | "help" | "exportPdf";
  icon: ReactNode;
  primary?: boolean;
};

const tools: ToolbarTool[] = [
  {
    id: "select",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.5 12.5 8 8.8 9.1 7.1 13.5 4 2.5Z" />
      </svg>
    )
  },
  {
    id: "line",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 13 13 3" />
      </svg>
    )
  },
  {
    id: "potential",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2v12" />
        <path d="M5.8 4.4 8 2.2l2.2 2.2" />
        <path d="M5.8 11.6 8 13.8l2.2-2.2" />
      </svg>
    )
  },
  {
    id: "circle",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="4.8" />
      </svg>
    )
  },
  {
    id: "arc",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 11.5a5 5 0 0 1 8-6" />
      </svg>
    )
  },
  {
    id: "text",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 4h10" />
        <path d="M8 4v8" />
        <path d="M6 12h4" />
      </svg>
    )
  },
  {
    id: "pin",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 2.5v3.3M8 10.2v3.3M2.5 8h3.3M10.2 8h3.3" />
      </svg>
    )
  },
  {
    id: "pan",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.5v11" />
        <path d="M2.5 8h11" />
        <path d="M5.8 4.7 8 2.5l2.2 2.2" />
        <path d="M5.8 11.3 8 13.5l2.2-2.2" />
        <path d="M4.7 5.8 2.5 8l2.2 2.2" />
        <path d="M11.3 5.8 13.5 8l-2.2 2.2" />
      </svg>
    )
  }
];

const viewActions: ToolbarAction[] = [
  {
    id: "fitToPage",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="1.2" />
        <path d="M5.2 7V5.2H7" />
        <path d="M10.8 9v1.8H9" />
      </svg>
    )
  }
];

const fileActions: ToolbarAction[] = [
  {
    id: "downloadProject",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.5v7" />
        <path d="M5.3 7.4 8 10.1l2.7-2.7" />
        <path d="M3.5 13h9" />
      </svg>
    )
  },
  {
    id: "uploadProject",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 13.5v-7" />
        <path d="M5.3 8.6 8 5.9l2.7 2.7" />
        <path d="M3.5 3h9" />
      </svg>
    )
  },
  {
    id: "help",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="5.2" />
        <path d="M6.4 6.3a1.8 1.8 0 1 1 2.3 1.8c-.5.2-.7.6-.7 1.2" />
        <path d="M8 11.8h.01" />
      </svg>
    )
  },
  {
    id: "exportPdf",
    primary: true,
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.5h5l3 3V13.5H4V2.5Z" />
        <path d="M9 2.5v3h3" />
        <path d="M5.8 10.8h4.4" />
        <path d="M5.8 8.6h4.4" />
      </svg>
    )
  }
];

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

  function renderAction(action: ToolbarAction) {
    const label = t(`toolbar.actions.${action.id}`);
    if (action.id === "uploadProject") {
      return (
        <button
          key={action.id}
          type="button"
          className="tool-button toolbar-icon-button"
          title={label}
          aria-label={label}
          onClick={() => fileInputRef.current?.click()}
      >
        <span className="toolbar-button-icon">{action.icon}</span>
      </button>
      );
    }
    if (action.id === "help") {
      return (
        <a
          key={action.id}
          className="tool-button toolbar-icon-button"
          href={manualHref}
          target="_blank"
          rel="noreferrer"
          title={label}
          aria-label={label}
        >
          <span className="toolbar-button-icon">{action.icon}</span>
        </a>
      );
    }
    const handler = action.id === "fitToPage" ? onFitToPage : action.id === "downloadProject" ? onSaveJson : onExportPdf;
    return (
      <button
        key={action.id}
        type="button"
        className={action.primary ? "tool-button primary toolbar-icon-button" : "tool-button toolbar-icon-button"}
        title={label}
        aria-label={label}
        onClick={handler}
      >
        <span className="toolbar-button-icon">{action.icon}</span>
      </button>
    );
  }

  return (
    <header className="toolbar">
      <div className="toolbar-section toolbar-section-tools" aria-label={t("toolbar.groups.tools")}>
        <div className="toolbar-button-group">
          {tools.map((item) => {
            const label = t(`toolbar.tools.${item.id}`);
            return (
              <button
                key={item.id}
                type="button"
                className={item.id === tool ? "tool-button active toolbar-icon-button" : "tool-button toolbar-icon-button"}
                title={label}
                aria-label={label}
                onClick={() => onToolChange(item.id)}
              >
                <span className="toolbar-button-icon">{item.icon}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="toolbar-section toolbar-section-actions">
        <div className="toolbar-group" aria-label={t("toolbar.groups.view")}>
          <div className="toolbar-button-group">{viewActions.map((action) => renderAction(action))}</div>
        </div>
        <div className="toolbar-group" aria-label={t("toolbar.groups.file")}>
          <div className="toolbar-button-group">{fileActions.map((action) => renderAction(action))}</div>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFilePick} hidden />
      </div>
    </header>
  );
}
