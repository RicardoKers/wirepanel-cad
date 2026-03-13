import { useTranslation } from "react-i18next";
import type { Layer } from "../models";

type LayersPanelProps = {
  layers: Layer[];
  activeLayerId: string;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onSelectLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
};

export default function LayersPanel({
  layers,
  activeLayerId,
  onAddLayer,
  onDeleteLayer,
  onSelectLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onRenameLayer
}: LayersPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>{t("layers.title")}</h3>
        <button className="icon-button" onClick={onAddLayer}>+</button>
      </header>
      <div className="panel-body">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={layer.id === activeLayerId ? "layer-row active" : "layer-row"}
          >
            <input
              className="layer-name-input"
              type="text"
              value={layer.name}
              onFocus={() => onSelectLayer(layer.id)}
              onClick={() => onSelectLayer(layer.id)}
              onChange={(event) => onRenameLayer(layer.id, event.target.value)}
            />
            <div className="layer-actions">
              <button
                className={layer.visible ? "chip" : "chip muted"}
                onClick={() => onToggleLayerVisibility(layer.id)}
              >
                {layer.visible ? t("layers.show") : t("layers.hide")}
              </button>
              <button
                className={layer.locked ? "chip muted" : "chip"}
                onClick={() => onToggleLayerLock(layer.id)}
              >
                {layer.locked ? t("layers.lock") : t("layers.edit")}
              </button>
              <button
                className={layers.length <= 1 ? "chip muted" : "chip danger"}
                onClick={() => onDeleteLayer(layer.id)}
                disabled={layers.length <= 1}
              >
                {t("layers.deleteShort")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
