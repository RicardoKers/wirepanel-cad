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
  onUndo: () => void;
  onRedo: () => void;
  onCopySelection: () => void;
  onCutSelection: () => void;
  onPasteSelection: () => void;
  onDeleteSelection: () => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  onCreateComponent: () => void;
  canEditSelection: boolean;
  canGroupSelection: boolean;
  canUngroupSelection: boolean;
  canCreateComponent: boolean;
};

type ToolbarTool = {
  id: Tool;
  icon: ReactNode;
};

type ToolbarAction = {
  id:
    | "fitToPage"
    | "downloadProject"
    | "uploadProject"
    | "help"
    | "exportPdf"
    | "undo"
    | "redo"
    | "copy"
    | "cut"
    | "paste"
    | "delete"
    | "group"
    | "ungroup"
    | "createComponent";
  icon: ReactNode;
  primary?: boolean;
};

const selectionTools: ToolbarTool[] = [
  {
    id: "select",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.5 12.5 8 8.8 9.1 7.1 13.5 4 2.5Z" />
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

const drawingTools: ToolbarTool[] = [
  {
    id: "line",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 13 13 3" />
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
  }
];

const electricalTools: ToolbarTool[] = [
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
    id: "pin",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 2.5v3.3M8 10.2v3.3M2.5 8h3.3M10.2 8h3.3" />
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

const historyActions: ToolbarAction[] = [
  {
    id: "undo",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.5 4 3 7.5 6.5 11" />
        <path d="M3.5 7.5h6a3 3 0 0 1 0 6H8" />
      </svg>
    )
  },
  {
    id: "redo",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M9.5 4 13 7.5 9.5 11" />
        <path d="M12.5 7.5h-6a3 3 0 0 0 0 6H8" />
      </svg>
    )
  }
];

const editActions: ToolbarAction[] = [
  {
    id: "copy",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5" y="5" width="7" height="8" rx="1" />
        <path d="M4 11H3.5A1.5 1.5 0 0 1 2 9.5v-6A1.5 1.5 0 0 1 3.5 2h5A1.5 1.5 0 0 1 10 3.5V4" />
      </svg>
    )
  },
  {
    id: "cut",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="4" cy="4" r="1.4" />
        <circle cx="4" cy="12" r="1.4" />
        <path d="M5.2 5.2 12 12" />
        <path d="M5.2 10.8 12 4" />
      </svg>
    )
  },
  {
    id: "paste",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3.5h4" />
        <rect x="5" y="2.5" width="6" height="3" rx="1" />
        <path d="M4 4.5H3.5A1.5 1.5 0 0 0 2 6v6.5A1.5 1.5 0 0 0 3.5 14h9A1.5 1.5 0 0 0 14 12.5V6a1.5 1.5 0 0 0-1.5-1.5H12" />
      </svg>
    )
  },
  {
    id: "delete",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 4.5h10" />
        <path d="M6.5 2.5h3" />
        <path d="M5 4.5v8A1.5 1.5 0 0 0 6.5 14h3A1.5 1.5 0 0 0 11 12.5v-8" />
        <path d="M7 7v4M9 7v4" />
      </svg>
    )
  },
  {
    id: "group",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="3" width="4" height="4" rx=".6" />
        <rect x="9" y="9" width="4" height="4" rx=".6" />
        <path d="M7 5h2M11 7v2" />
      </svg>
    )
  },
  {
    id: "ungroup",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2.5" y="2.5" width="4" height="4" rx=".6" />
        <rect x="9.5" y="9.5" width="4" height="4" rx=".6" />
        <path d="M7.5 5.5h1M10.5 7.5v1" />
      </svg>
    )
  },
  {
    id: "createComponent",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="4" width="10" height="8" rx="1" />
        <path d="M8 2.5v3M8 10.5v3M5 8h6" />
      </svg>
    )
  }
];

const helpActions: ToolbarAction[] = [
  {
    id: "help",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="5.2" />
        <path d="M6.4 6.3a1.8 1.8 0 1 1 2.3 1.8c-.5.2-.7.6-.7 1.2" />
        <path d="M8 11.8h.01" />
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
  onExportPdf,
  onUndo,
  onRedo,
  onCopySelection,
  onCutSelection,
  onPasteSelection,
  onDeleteSelection,
  onGroupSelection,
  onUngroupSelection,
  onCreateComponent,
  canEditSelection,
  canGroupSelection,
  canUngroupSelection,
  canCreateComponent
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

  function getActionHandler(action: ToolbarAction) {
    if (action.id === "fitToPage") return onFitToPage;
    if (action.id === "downloadProject") return onSaveJson;
    if (action.id === "exportPdf") return onExportPdf;
    if (action.id === "undo") return onUndo;
    if (action.id === "redo") return onRedo;
    if (action.id === "copy") return onCopySelection;
    if (action.id === "cut") return onCutSelection;
    if (action.id === "paste") return onPasteSelection;
    if (action.id === "delete") return onDeleteSelection;
    if (action.id === "group") return onGroupSelection;
    if (action.id === "ungroup") return onUngroupSelection;
    if (action.id === "createComponent") return onCreateComponent;
    return onFitToPage;
  }

  function isActionDisabled(action: ToolbarAction) {
    if (action.id === "copy" || action.id === "cut" || action.id === "delete") return !canEditSelection;
    if (action.id === "group") return !canGroupSelection;
    if (action.id === "ungroup") return !canUngroupSelection;
    if (action.id === "createComponent") return !canCreateComponent;
    return false;
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
    const handler = getActionHandler(action);
    return (
      <button
        key={action.id}
        type="button"
        className={action.primary ? "tool-button primary toolbar-icon-button" : "tool-button toolbar-icon-button"}
        title={label}
        aria-label={label}
        onClick={handler}
        disabled={isActionDisabled(action)}
      >
        <span className="toolbar-button-icon">{action.icon}</span>
      </button>
    );
  }

  function renderToolGroup(items: ToolbarTool[]) {
    return items.map((item) => {
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
    });
  }

  return (
    <header className="toolbar">
      <div className="toolbar-section toolbar-section-actions">
        <div className="toolbar-group" aria-label={t("toolbar.groups.file")}>
          <div className="toolbar-button-group">{fileActions.map((action) => renderAction(action))}</div>
        </div>
        <div className="toolbar-group" aria-label={t("toolbar.groups.view")}>
          <div className="toolbar-button-group">
            {viewActions.map((action) => renderAction(action))}
            {renderToolGroup(selectionTools.filter((item) => item.id === "pan"))}
          </div>
        </div>
        <div className="toolbar-group" aria-label={t("toolbar.groups.history")}>
          <div className="toolbar-button-group">{historyActions.map((action) => renderAction(action))}</div>
        </div>
        <div className="toolbar-group" aria-label={t("toolbar.groups.edit")}>
          <div className="toolbar-button-group">
            {renderToolGroup(selectionTools.filter((item) => item.id === "select"))}
            {editActions.map((action) => renderAction(action))}
          </div>
        </div>
        <div className="toolbar-group" aria-label={t("toolbar.groups.drawing")}>
          <div className="toolbar-button-group">{renderToolGroup(drawingTools)}</div>
        </div>
        <div className="toolbar-group" aria-label={t("toolbar.groups.electrical")}>
          <div className="toolbar-button-group">{renderToolGroup(electricalTools)}</div>
        </div>
        <div className="toolbar-group" aria-label={t("toolbar.groups.help")}>
          <div className="toolbar-button-group">{helpActions.map((action) => renderAction(action))}</div>
        </div>
        <input ref={fileInputRef} type="file" accept=".wpp" onChange={handleFilePick} hidden />
      </div>
    </header>
  );
}
