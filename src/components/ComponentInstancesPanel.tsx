import { useTranslation } from "react-i18next";
import type { ComponentInstance } from "../models";

type ComponentInstanceListItem = {
  instance: ComponentInstance;
  pageName: string;
  bounds: Bounds | null;
  address: string | null;
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type ComponentInstancesPanelProps = {
  items: ComponentInstanceListItem[];
  onNavigateToComponent: (pageId: string, bounds: Bounds) => void;
};

export default function ComponentInstancesPanel({
  items,
  onNavigateToComponent
}: ComponentInstancesPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>{t("componentInstances.title")}</h3>
      </header>
      <div className="panel-body component-instance-list">
        {items.length === 0 && <p className="muted">{t("componentInstances.empty")}</p>}
        {items.map(({ instance, pageName, bounds, address }) => {
          const tag = `${instance.tagPrefix}${instance.tagNumber}`;
          return (
            <button
              key={instance.componentId}
              type="button"
              className="component-instance-row"
              disabled={!bounds}
              onClick={() => {
                if (!bounds) return;
                onNavigateToComponent(instance.pageId, bounds);
              }}
            >
              <span className="component-instance-tag">{tag}</span>
              <span className="component-instance-meta">
                <span>{instance.type || t("componentInstances.unknownType")}</span>
                <span>{address ? t("componentInstances.address", { address }) : pageName}</span>
                {instance.partOfTag && <span>{t("componentInstances.partOf", { tag: instance.partOfTag })}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
