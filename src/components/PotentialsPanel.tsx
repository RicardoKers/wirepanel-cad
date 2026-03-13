import { useTranslation } from "react-i18next";
import type { Bounds } from "../utils/markers";

type PotentialListItem = {
  number: number;
  name: string;
  diameter: number | null;
  pageId: string;
  bounds: Bounds;
};

type PotentialsPanelProps = {
  potentials: PotentialListItem[];
  onNavigateToPotential: (pageId: string, bounds: Bounds) => void;
  onRenumberPotentials: () => void;
};

export default function PotentialsPanel({
  potentials,
  onNavigateToPotential,
  onRenumberPotentials
}: PotentialsPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>{t("potentials.title")}</h3>
        <button className="chip" type="button" onClick={onRenumberPotentials}>
          {t("potentials.renumber")}
        </button>
      </header>
      <div className="panel-body potential-list">
        {potentials.length === 0 && <p className="muted">{t("potentials.empty")}</p>}
        {potentials.map((item) => {
          const diameterValue = item.diameter;
          const diameterLabel =
            typeof diameterValue === "number" && Number.isFinite(diameterValue)
              ? t("potentials.sizeValue", { value: diameterValue })
              : t("potentials.noSize");
          const nameLabel = item.name.trim() ? item.name : t("potentials.unnamed");
          return (
            <button
              key={`potential-${item.number}`}
              type="button"
              className="potential-row"
              onClick={() => onNavigateToPotential(item.pageId, item.bounds)}
            >
              <div className="potential-number">{t("potentials.prefix", { number: item.number })}</div>
              <div className="potential-meta">
                <div className="potential-name">{nameLabel}</div>
                <div className="potential-diameter">{diameterLabel}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
