import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Modal, Button } from "react-bootstrap";
import {
  SUGGESTED_TAGS,
  AVAILABLE_COLORS,
  generateTagKey,
  validateTag,
  GROUP_TAGS_CONFIG_KEY,
  GROUP_TAGS_DELETED_CONFIG_KEY,
} from "../utils/tagsCatalog";
import systemConfigService from "../services/SystemConfigService";
import useToast from "../hooks/useToast";

/**
 * Componente reutilizable para gestionar etiquetas tipo "chips" con color (estilo Trello)
 * 
 * @param {Array} value - Array de etiquetas activas [{ key, label, color }]
 * @param {Function} onChange - Callback que se ejecuta cuando cambian las etiquetas (recibe el array de etiquetas activas)
 * @param {Boolean} readOnly - Si es true, deshabilita la edición
 * @param {String} className - Clases CSS adicionales
 */
const GroupTags = ({ value = [], onChange, readOnly = false, className = "" }) => {
  const toast = useToast();
  const CONFIG_KEY = GROUP_TAGS_CONFIG_KEY;
  const DELETED_KEY = GROUP_TAGS_DELETED_CONFIG_KEY;
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMoreTags, setShowMoreTags] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(AVAILABLE_COLORS[0]);
  const [customTags, setCustomTags] = useState([]);
  const [deletedTagKeys, setDeletedTagKeys] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const userModifiedCatalogRef = useRef(false);
  const lastSavedCatalogRef = useRef(null);

  const mergeTagCatalog = (primary = [], secondary = []) => {
    const byKey = new Map();
    [...primary, ...secondary].forEach((tag) => {
      if (validateTag(tag)) {
        byKey.set(tag.key, tag);
      }
    });
    return Array.from(byKey.values());
  };

  const extractConfigArray = (response) => {
    if (Array.isArray(response?.value)) return response.value;
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return null;
  };

  const persistCatalog = useCallback(async (nextCustomTags, nextDeletedKeys, { showErrors = true } = {}) => {
    let customSaveFailed = false;
    let deletedSaveFailed = false;

    try {
      await systemConfigService.put(CONFIG_KEY, nextCustomTags, "json");
    } catch (error) {
      customSaveFailed = true;
      console.error("Error al guardar etiquetas personalizadas globales:", error);
    }

    try {
      await systemConfigService.put(DELETED_KEY, nextDeletedKeys, "json");
    } catch (error) {
      deletedSaveFailed = true;
      console.error("Error al guardar etiquetas eliminadas globales:", error);
    }

    try {
      localStorage.setItem("groupTags_custom", JSON.stringify(nextCustomTags));
      localStorage.setItem("groupTags_deleted", JSON.stringify(nextDeletedKeys));
      lastSavedCatalogRef.current = JSON.stringify({
        customTags: nextCustomTags,
        deletedTagKeys: nextDeletedKeys,
      });
    } catch (error) {
      console.error("Error al guardar etiquetas de grupos familiares en localStorage:", error);
    }

    if (showErrors) {
      if (customSaveFailed) {
        toast.showError("No se pudieron guardar las etiquetas globales de grupos familiares.");
      }
      if (deletedSaveFailed) {
        toast.showError("No se pudo guardar el historial de etiquetas eliminadas.");
      }
    }

    return !customSaveFailed && !deletedSaveFailed;
  }, [CONFIG_KEY, DELETED_KEY, toast]);

  const loadCatalogFromServer = useCallback(async ({ mergeWithLocal = false } = {}) => {
    let loadedCustom = false;
    let loadedDeleted = false;

    try {
      const response = await systemConfigService.get(CONFIG_KEY);
      const data = extractConfigArray(response);

      if (Array.isArray(data)) {
        const valid = data.filter(validateTag);
        setCustomTags((prev) => (mergeWithLocal ? mergeTagCatalog(valid, prev) : valid));
        loadedCustom = true;
        try {
          localStorage.setItem("groupTags_custom", JSON.stringify(valid));
        } catch {
          // Ignorar errores de localStorage
        }
      }
    } catch (error) {
      const status = error?.response?.status ?? error?.status;
      if (status && status !== 404) {
        console.error("Error al cargar etiquetas personalizadas globales:", error);
      }
    }

    try {
      const deletedResponse = await systemConfigService.get(DELETED_KEY);
      const rawDeleted = extractConfigArray(deletedResponse);

      if (Array.isArray(rawDeleted)) {
        const normalizedDeleted = rawDeleted
          .map((k) => (typeof k === "string" ? k : String(k || "").trim()))
          .filter((k) => k);
        setDeletedTagKeys(normalizedDeleted);
        loadedDeleted = true;
        try {
          localStorage.setItem("groupTags_deleted", JSON.stringify(normalizedDeleted));
        } catch {
          // Ignorar errores de localStorage
        }
      }
    } catch (error) {
      const status = error?.response?.status ?? error?.status;
      if (status && status !== 404) {
        console.error("Error al cargar etiquetas eliminadas globales:", error);
      }
    }

    if (!loadedCustom) {
      try {
        const saved = localStorage.getItem("groupTags_custom");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(validateTag);
            setCustomTags((prev) => mergeTagCatalog(valid, prev));
          }
        }
      } catch (error) {
        console.error("Error al cargar etiquetas personalizadas desde localStorage:", error);
      }
    }

    if (!loadedDeleted) {
      try {
        const deletedSaved = localStorage.getItem("groupTags_deleted");
        if (deletedSaved) {
          const parsedDeleted = JSON.parse(deletedSaved);
          if (Array.isArray(parsedDeleted)) {
            setDeletedTagKeys(
              parsedDeleted
                .map((k) => (typeof k === "string" ? k : String(k || "").trim()))
                .filter((k) => k)
            );
          }
        }
      } catch (error) {
        console.error("Error al cargar etiquetas eliminadas desde localStorage:", error);
      }
    }

    setCatalogReady(true);
  }, []);

  // Normalizar y validar el valor recibido desde el padre
  const normalizedValue = useMemo(() => {
    if (!value || !Array.isArray(value)) return [];
    
    // Validar que cada etiqueta tenga el formato correcto
    return value.filter(tag => {
      return (
        tag &&
        typeof tag === "object" &&
        tag.key &&
        tag.label &&
        tag.color &&
        typeof tag.key === "string" &&
        typeof tag.label === "string" &&
        typeof tag.color === "string"
      );
    });
  }, [value]);

  // Carga inicial del banco global (compartido entre usuarios y grupos)
  useEffect(() => {
    loadCatalogFromServer({ mergeWithLocal: true });
  }, [loadCatalogFromServer]);

  // Al abrir el modal, refrescar desde el servidor para ver etiquetas de otros usuarios
  useEffect(() => {
    if (!showModal) return;
    loadCatalogFromServer({ mergeWithLocal: false });
  }, [showModal, loadCatalogFromServer]);

  // Guardar catálogo global solo tras cambios explícitos del usuario (no al cargar ni en solo lectura)
  useEffect(() => {
    if (readOnly || !catalogReady || !userModifiedCatalogRef.current) return;

    const catalogSnapshot = JSON.stringify({ customTags, deletedTagKeys });
    if (lastSavedCatalogRef.current === catalogSnapshot) return;

    persistCatalog(customTags, deletedTagKeys);
  }, [customTags, deletedTagKeys, readOnly, catalogReady, persistCatalog]);

  // Combinar sugeridas, personalizadas y las ya usadas en el grupo actual
  const allAvailableTags = useMemo(() => {
    const deletedSet = new Set(deletedTagKeys || []);
    const base = mergeTagCatalog(SUGGESTED_TAGS, mergeTagCatalog(customTags, normalizedValue));
    if (!deletedSet.size) return base;
    return base.filter((tag) => !deletedSet.has(tag.key));
  }, [customTags, deletedTagKeys, normalizedValue]);

  // Filtrar etiquetas según búsqueda
  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return allAvailableTags;
    const term = searchTerm.toLowerCase();
    return allAvailableTags.filter(
      (tag) => tag.label.toLowerCase().includes(term) || tag.key.toLowerCase().includes(term)
    );
  }, [allAvailableTags, searchTerm]);

  // Etiquetas sugeridas: priorizar las que ya están seleccionadas en el grupo actual.
  const suggestedTags = useMemo(() => {
    const activeSet = new Set(normalizedValue.map((t) => t.key));
    const activeFromCatalog = filteredTags.filter((tag) => activeSet.has(tag.key));

    // Si el grupo ya tiene etiquetas asignadas, mostrarlas primero como sugerencias
    if (activeFromCatalog.length > 0) {
      return activeFromCatalog;
    }

    // Si no hay etiquetas activas, usar las primeras del filtro como antes
    return filteredTags.slice(0, 3);
  }, [filteredTags, normalizedValue]);

  // Etiquetas a mostrar (todas o limitadas), ordenando primero las seleccionadas
  const tagsToShow = useMemo(() => {
    const activeSet = new Set(normalizedValue.map((t) => t.key));
    const sorted = [...filteredTags].sort((a, b) => {
      const aActive = activeSet.has(a.key);
      const bActive = activeSet.has(b.key);
      if (aActive === bActive) return 0;
      return aActive ? -1 : 1;
    });

    return showMoreTags ? sorted : sorted.slice(0, 8);
  }, [filteredTags, showMoreTags, normalizedValue]);

  // Verificar si una etiqueta está activa
  const isTagActive = (tagKey) => {
    return normalizedValue.some((tag) => tag.key === tagKey);
  };

  // Toggle etiqueta (agregar/quitar)
  const toggleTag = (tag) => {
    if (readOnly) return;
    
    const isActive = isTagActive(tag.key);
    let newValue;
    
    if (isActive) {
      // Quitar etiqueta
      newValue = normalizedValue.filter((t) => t.key !== tag.key);
    } else {
      // Agregar etiqueta - asegurar formato correcto
      const newTag = {
        key: tag.key,
        label: tag.label,
        color: tag.color
      };
      
      // Validar antes de agregar
      if (validateTag(newTag)) {
        newValue = [...normalizedValue, newTag];
      } else {
        console.error("Etiqueta inválida:", newTag);
        return;
      }
    }
    
    // Emitir onChange con el nuevo array
    onChange?.(newValue);
  };

  // Crear nueva etiqueta
  const handleCreateTag = async () => {
    if (!newTagLabel.trim()) return;
    
    const key = generateTagKey(newTagLabel);
    
    // Verificar que no exista ya
    if (allAvailableTags.some((t) => t.key === key)) {
      toast.showError("Ya existe una etiqueta con ese nombre");
      return;
    }
    
    const newTag = {
      key,
      label: newTagLabel.trim().toUpperCase(),
      color: newTagColor
    };
    
    if (!validateTag(newTag)) {
      toast.showError("Error al crear la etiqueta. Verifique los datos.");
      return;
    }
    
    const nextCustomTags = mergeTagCatalog(customTags, [newTag]);
    userModifiedCatalogRef.current = true;
    setCustomTags(nextCustomTags);
    
    // Agregar a activas en el grupo
    const newValue = [...normalizedValue, newTag];
    onChange?.(newValue);

    // Persistir de inmediato en el banco global (compartido entre usuarios)
    await persistCatalog(nextCustomTags, deletedTagKeys);
    
    // Limpiar formulario y búsqueda para que la nueva etiqueta sea visible en el listado
    setNewTagLabel("");
    setNewTagColor(AVAILABLE_COLORS[0]);
    setSearchTerm("");
    setShowMoreTags(true);
  };

  // Editar etiqueta (cualquier etiqueta, sugerida o personalizada)
  const handleEditTag = (tag) => {
    if (readOnly) return;
    setEditingTag(tag);
    setNewTagLabel(tag.label);
    setNewTagColor(tag.color);
  };

  // Guardar edición de etiqueta
  const handleSaveEdit = async () => {
    if (!editingTag || !newTagLabel.trim()) return;
    
    const updatedTag = {
      ...editingTag,
      label: newTagLabel.trim().toUpperCase(),
      color: newTagColor
    };
    
    userModifiedCatalogRef.current = true;
    const isCustom = customTags.some((t) => t.key === editingTag.key);
    let nextCustomTags = customTags;

    if (isCustom) {
      nextCustomTags = customTags.map((t) => (t.key === editingTag.key ? updatedTag : t));
    } else {
      const existingCustom = customTags.find((t) => t.key === editingTag.key);
      nextCustomTags = existingCustom
        ? customTags.map((t) => (t.key === editingTag.key ? updatedTag : t))
        : [...customTags, updatedTag];
    }

    setCustomTags(nextCustomTags);
    
    const newValue = normalizedValue.map((t) =>
      t.key === editingTag.key ? updatedTag : t
    );
    onChange?.(newValue);

    await persistCatalog(nextCustomTags, deletedTagKeys);
    
    setEditingTag(null);
    setNewTagLabel("");
    setNewTagColor(AVAILABLE_COLORS[0]);
  };

  // Eliminar etiqueta (sugerida o personalizada) del catálogo global
  const handleDeleteTag = async (tag) => {
    if (readOnly || !tag?.key) return;

    const confirmDelete = window.confirm(
      `¿Eliminar la etiqueta "${tag.label}" para todos los usuarios?`
    );
    if (!confirmDelete) return;

    userModifiedCatalogRef.current = true;

    const isCustom = customTags.some((t) => t.key === tag.key);
    const nextCustomTags = isCustom
      ? customTags.filter((t) => t.key !== tag.key)
      : customTags;
    const nextDeletedKeys = deletedTagKeys.includes(tag.key)
      ? deletedTagKeys
      : [...deletedTagKeys, tag.key];

    setCustomTags(nextCustomTags);
    setDeletedTagKeys(nextDeletedKeys);

    if (isTagActive(tag.key)) {
      const newValue = normalizedValue.filter((t) => t.key !== tag.key);
      onChange?.(newValue);
    }

    await persistCatalog(nextCustomTags, nextDeletedKeys);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setEditingTag(null);
    setNewTagLabel("");
    setNewTagColor(AVAILABLE_COLORS[0]);
  };

  // Obtener estilo de texto (siempre blanco para mejor contraste)
  const getTextColor = (bgColor) => {
    return "#FFFFFF"; // Texto blanco por defecto
  };

  return (
    <>
      {/* Vista de etiquetas activas (chips) */}
      <div className={`flex flex-wrap gap-2 items-center ${className}`}>
        <span className="text-sm font-medium text-gray-700 mr-2">Etiquetas:</span>
        {normalizedValue.length > 0 ? (
          normalizedValue.map((tag) => (
            <span
              key={tag.key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white shadow-sm"
              style={{
                backgroundColor: tag.color,
                color: getTextColor(tag.color)
              }}
            >
              {tag.label}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-400 italic">Sin etiquetas</span>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
            title="Gestionar etiquetas"
          >
            <i className="fas fa-plus text-xs"></i>
          </button>
        )}
      </div>

      {/* Modal de gestión de etiquetas */}
      <Modal
        show={showModal}
        onHide={() => {
            setShowModal(false);
          setSearchTerm("");
          setShowMoreTags(false);
          setEditingTag(null);
          setNewTagLabel("");
          setNewTagColor(AVAILABLE_COLORS[0]);
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="flex items-center gap-2">
            <i className="fas fa-tags"></i>
            Etiquetas
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Barra de búsqueda */}
          <div className="mb-4">
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Buscar etiquetas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Crear nueva etiqueta */}
          {!editingTag && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nombre de la etiqueta..."
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleCreateTag();
                    }
                  }}
                />
                <input
                  type="color"
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  title="Seleccionar color"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={!newTagLabel.trim()}
                >
                  Crear
                </Button>
              </div>
            </div>
          )}

          {/* Editar etiqueta */}
          {editingTag && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-blue-700">Editando:</span>
                <span
                  className="px-2 py-1 rounded text-xs text-white"
                  style={{ backgroundColor: editingTag.color }}
                >
                  {editingTag.label}
                </span>
              </div>
              <p className="text-xs text-blue-800 mb-2">
                Cambiar el nombre o el color afecta cómo se verán esta etiqueta en los grupos y reportes donde ya fue usada.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                />
                <input
                  type="color"
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                />
                <Button variant="success" size="sm" onClick={handleSaveEdit}>
                  Guardar
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Sugerencias */}
          {suggestedTags.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="fas fa-star text-yellow-500"></i>
                <h6 className="font-semibold text-gray-700 mb-0">Sugerencias</h6>
              </div>
              <div className="space-y-2">
                {suggestedTags.map((tag) => {
                  const isActive = isTagActive(tag.key);
                  const isCustom = customTags.some((t) => t.key === tag.key);
                  return (
                    <div
                      key={tag.key}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleTag(tag)}
                        className="cursor-pointer"
                        disabled={readOnly}
                      />
                      <span
                        className="flex-1 px-3 py-1.5 rounded text-sm font-medium text-white"
                        style={{
                          backgroundColor: tag.color,
                          color: getTextColor(tag.color)
                        }}
                      >
                        {tag.label}
                      </span>
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditTag(tag)}
                            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                            title="Editar etiqueta"
                          >
                            <i className="fas fa-pencil-alt text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(tag)}
                            className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                            title="Eliminar etiqueta"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista de etiquetas */}
          <div className="mb-4">
            <h6 className="font-semibold text-gray-700 mb-2">Etiquetas</h6>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tagsToShow.length > 0 ? (
                tagsToShow.map((tag) => {
                  const isActive = isTagActive(tag.key);
                  const isCustom = customTags.some((t) => t.key === tag.key);
                  return (
                    <div
                      key={tag.key}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleTag(tag)}
                        className="cursor-pointer"
                        disabled={readOnly}
                      />
                      <span
                        className="flex-1 px-3 py-1.5 rounded text-sm font-medium text-white"
                        style={{
                          backgroundColor: tag.color,
                          color: getTextColor(tag.color)
                        }}
                      >
                        {tag.label}
                      </span>
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditTag(tag)}
                            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                            title="Editar etiqueta"
                          >
                            <i className="fas fa-pencil-alt text-xs"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(tag)}
                            className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                            title="Eliminar etiqueta"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No se encontraron etiquetas
                </p>
              )}
            </div>
            {!readOnly && (
              <p className="mt-2 text-xs text-gray-500">
                Al eliminar una etiqueta dejará de estar disponible para nuevos grupos y puede cambiar cómo se ve el historial en algunas vistas.
              </p>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
            {filteredTags.length > 8 && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowMoreTags(!showMoreTags)}
              >
                {showMoreTags ? "Mostrar menos etiquetas" : "Mostrar más etiquetas"}
              </Button>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default GroupTags;

