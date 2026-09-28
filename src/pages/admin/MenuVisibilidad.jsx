import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import systemConfigService from "../../services/SystemConfigService";
import useMenuVisibility from "../../hooks/useMenuVisibility";
import {
  MENU_SECTIONS,
  isMenuItemEnabled,
  toggleableItems,
} from "../../constants/menuVisibility";
import "../../styles/MenuVisibilidad.css";

function draftFromMap(map) {
  const draft = {};
  MENU_SECTIONS.forEach((section) => {
    toggleableItems(section).forEach((item) => {
      draft[item.key] = isMenuItemEnabled(map, item.key);
    });
  });
  return draft;
}

const MenuVisibilidad = () => {
  const { hasRole, hasAnyPermission } = useAuth();
  const { publishVisibility } = useMenuVisibility();
  const canSave =
    hasRole("admin") || hasAnyPermission(["settings.edit", "settings.update"]);

  const [draft, setDraft] = useState(() => draftFromMap({}));
  const [saved, setSaved] = useState(() => draftFromMap({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    systemConfigService
      .getRuntime()
      .then((runtime) => {
        if (cancelled) return;
        const incoming = runtime?.menu_visibility;
        const next = draftFromMap(
          incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {}
        );
        setDraft(next);
        setSaved(next);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.message || "No se pudo cargar la visibilidad del menú");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved]
  );

  const hiddenCount = useMemo(
    () => Object.values(draft).filter((enabled) => enabled === false).length,
    [draft]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const setItem = (key, enabled) => {
    setDraft((prev) => ({ ...prev, [key]: enabled }));
  };

  const setKeys = (keys, enabled) => {
    setDraft((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        next[key] = enabled;
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("No tienes permiso para cambiar la visibilidad del menú");
      return;
    }
    setSaving(true);
    try {
      await systemConfigService.put("menu_visibility", draft, "json");
      setSaved(draft);
      publishVisibility(draft);
      toast.success("Visibilidad actualizada. Los módulos apagados dejan de mostrarse en el menú.");
    } catch (err) {
      toast.error(err?.message || "No se pudo guardar la visibilidad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="menu-vis">
      <div className="menu-vis__header">
        <div>
          <h1>Visibilidad del menú</h1>
          <p>
            Apaga lo que no se necesita ahora. La pantalla y su código se conservan:
            al volver a activarlo, reaparece en el menú. Nada se borra.
          </p>
        </div>
        <div className="menu-vis__actions">
          <span className="menu-vis__count">
            {hiddenCount === 0 ? "Todo visible" : `${hiddenCount} oculto${hiddenCount === 1 ? "" : "s"}`}
          </span>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!dirty || saving || loading || !canSave}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {!canSave && (
        <Alert variant="warning">
          Puedes revisar el estado, pero tu usuario no tiene permiso para guardarlo.
        </Alert>
      )}

      <Form.Control
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar un informe o módulo"
        className="menu-vis__search"
        aria-label="Buscar un informe o módulo"
      />

      {loading ? (
        <div className="menu-vis__loading">
          <Spinner animation="border" size="sm" /> Cargando módulos
        </div>
      ) : (
        MENU_SECTIONS.map((section) => {
          const items = section.items.filter((item) => {
            if (!normalizedQuery) return true;
            return (
              item.label.toLowerCase().includes(normalizedQuery) ||
              section.title.toLowerCase().includes(normalizedQuery)
            );
          });
          if (items.length === 0) return null;

          const editable = toggleableItems(section).filter((item) =>
            items.some((visible) => visible.key === item.key)
          );
          const allOn = editable.length > 0 && editable.every((item) => draft[item.key] !== false);

          return (
            <section key={section.id} className="menu-vis__section">
              <div className="menu-vis__section-head">
                <h2>{section.title}</h2>
                {editable.length > 0 && (
                  <Form.Check
                    type="switch"
                    id={`section-${section.id}`}
                    label={allOn ? "Todos visibles" : "Activar todos"}
                    checked={allOn}
                    onChange={(event) =>
                      setKeys(
                        editable.map((item) => item.key),
                        event.target.checked
                      )
                    }
                    disabled={!canSave}
                  />
                )}
              </div>
              <ul className="menu-vis__list">
                {items.map((item) => {
                  const enabled = item.locked || draft[item.key] !== false;
                  return (
                    <li key={item.key} className={enabled ? "" : "is-off"}>
                      <div>
                        <strong>{item.label}</strong>
                        {item.locked && <span className="menu-vis__locked">{item.lockedReason}</span>}
                        {!item.locked && !enabled && (
                          <span className="menu-vis__hint">Oculto en el menú. La pantalla sigue disponible.</span>
                        )}
                      </div>
                      <div className="menu-vis__row-actions">
                        {!item.locked && (
                          <Link to={item.path} className="menu-vis__open">
                            Abrir
                          </Link>
                        )}
                        <Form.Check
                          type="switch"
                          id={`item-${item.key}`}
                          label={enabled ? "Visible" : "Oculto"}
                          checked={enabled}
                          disabled={item.locked || !canSave}
                          onChange={(event) => setItem(item.key, event.target.checked)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
};

export default MenuVisibilidad;
