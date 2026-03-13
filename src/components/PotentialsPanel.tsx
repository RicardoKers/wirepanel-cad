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
  return (
    <section className="panel">
      <header className="panel-header">
        <h3>Potentials</h3>
        <button className="chip" type="button" onClick={onRenumberPotentials}>
          Renumber
        </button>
      </header>
      <div className="panel-body potential-list">
        {potentials.length === 0 && <p className="muted">No potentials yet.</p>}
        {potentials.map((item) => {
          const diameterValue = item.diameter;
          const diameterLabel =
            typeof diameterValue === "number" && Number.isFinite(diameterValue)
              ? `${diameterValue} mm2`
              : "No size";
          const nameLabel = item.name.trim() ? item.name : "Unnamed";
          return (
            <button
              key={`potential-${item.number}`}
              type="button"
              className="potential-row"
              onClick={() => onNavigateToPotential(item.pageId, item.bounds)}
            >
              <div className="potential-number">P{item.number}</div>
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
