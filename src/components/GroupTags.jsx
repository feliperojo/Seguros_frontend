import React, { useState, useEffect, useMemo } from "react";
import { Modal, Button } from "react-bootstrap";
import { SUGGESTED_TAGS, AVAILABLE_COLORS, generateTagKey, validateTag } from "../utils/tagsCatalog";
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
  const CONFIG_KEY = "group_tags_custom";
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMoreTags, setShowMoreTags] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(AVAILABLE_COLORS[0]);
  const [customTags, setCustomTags] = useState([]);

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

  // Cargar etiquetas personalizadas desde configuración global (system-config)
  // con fallback a localStorage para compatibilidad hacia atrás.
  useEffect(() => {
    let isMounted = true;

    const loadCustomTags = async () => {
      // 1. Intentar desde system-config (global para todas las personas usuarias)
      try {
        const response = await systemConfigService.get(CONFIG_KEY);
        const data = Array.isArray(response?.value)
          ? response.value
          : Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : null;

        if (isMounted && Array.isArray(data)) {
          const valid = data.filter(validateTag);
          if (valid.length > 0) {
            setCustomTags(valid);
            // Guardar también en localStorage como caché local
            try {
              localStorage.setItem("groupTags_custom", JSON.stringify(valid));
            } catch {
              // Ignorar errores de localStorage
            }
            return;
          }
        }
      } catch (error) {
        const status = error?.response?.status ?? error?.status;
        // Si es 404, la clave aún no existe: no mostrar error.
        if (status && status !== 404) {
          console.error("Error al cargar etiquetas personalizadas globales:", error);
        }
      }

      // 2. Fallback: intentar cargar desde localStorage (solo navegador actual)
      try {
        const saved = localStorage.getItem("groupTags_custom");
        if (isMounted && saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCustomTags(parsed.filter(validateTag));
          }
        }
      } catch (error) {
        console.error("Error al cargar etiquetas personalizadas desde localStorage:", error);
      }
    };

    loadCustomTags();

    return () => {
      isMounted = false;
    };
  }, []);

  // Guardar etiquetas personalizadas en configuración global cuando cambian
  useEffect(() => {
    if (!customTags || customTags.length === 0) return;

    // Guardar en segundo plano; no bloquea la UI
    const saveCustomTags = async () => {
      try {
        // Guardar en system-config como JSON para que se comparta entre usuarios
        await systemConfigService.put(CONFIG_KEY, customTags, "json");
      } catch (error) {
        console.error("Error al guardar etiquetas personalizadas globales:", error);
        if (toast && typeof toast.showError === "function") {
          toast.showError("No se pudieron guardar las etiquetas personalizadas globales.");
        }
      }

      // Siempre intentar mantener una copia local como respaldo
      try {
        localStorage.setItem("groupTags_custom", JSON.stringify(customTags));
      } catch (error) {
        console.error("Error al guardar etiquetas personalizadas en localStorage:", error);
      }
    };

    saveCustomTags();
  }, [customTags, toast, CONFIG_KEY]);

  // Combinar etiquetas sugeridas y personalizadas
  const allAvailableTags = useMemo(() => {
    return [...SUGGESTED_TAGS, ...customTags];
  }, [customTags]);

  // Filtrar etiquetas según búsqueda
  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return allAvailableTags;
    const term = searchTerm.toLowerCase();
    return allAvailableTags.filter(
      (tag) => tag.label.toLowerCase().includes(term) || tag.key.toLowerCase().includes(term)
    );
  }, [allAvailableTags, searchTerm]);

  // Etiquetas sugeridas (primeras 3-5)
  const suggestedTags = useMemo(() => {
    return filteredTags.slice(0, 3);
  }, [filteredTags]);

  // Etiquetas a mostrar (todas o limitadas)
  const tagsToShow = useMemo(() => {
    return showMoreTags ? filteredTags : filteredTags.slice(0, 8);
  }, [filteredTags, showMoreTags]);

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
  const handleCreateTag = () => {
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
    
    // Agregar a personalizadas
    setCustomTags((prev) => [...prev, newTag]);
    
    // Agregar a activas
    const newValue = [...normalizedValue, newTag];
    onChange?.(newValue);
    
    // Limpiar formulario
    setNewTagLabel("");
    setNewTagColor(AVAILABLE_COLORS[0]);
  };

  // Editar etiqueta (cualquier etiqueta, sugerida o personalizada)
  const handleEditTag = (tag) => {
    if (readOnly) return;
    setEditingTag(tag);
    setNewTagLabel(tag.label);
    setNewTagColor(tag.color);
  };

  // Guardar edición de etiqueta
  const handleSaveEdit = () => {
    if (!editingTag || !newTagLabel.trim()) return;
    
    const updatedTag = {
      ...editingTag,
      label: newTagLabel.trim().toUpperCase(),
      color: newTagColor
    };
    
    // Si es una etiqueta personalizada, actualizarla
    const isCustom = customTags.some((t) => t.key === editingTag.key);
    if (isCustom) {
      // Actualizar en personalizadas
      setCustomTags((prev) =>
        prev.map((t) => (t.key === editingTag.key ? updatedTag : t))
      );
    } else {
      // Si es una etiqueta sugerida, crear una copia personalizada con el mismo key
      // pero con el nuevo label/color
      const existingCustom = customTags.find((t) => t.key === editingTag.key);
      if (!existingCustom) {
        // Agregar como nueva personalizada (reemplaza la sugerida en uso)
        setCustomTags((prev) => [...prev, updatedTag]);
      } else {
        // Actualizar la personalizada existente
        setCustomTags((prev) =>
          prev.map((t) => (t.key === editingTag.key ? updatedTag : t))
        );
      }
    }
    
    // Actualizar en activas si está activa
    const newValue = normalizedValue.map((t) =>
      t.key === editingTag.key ? updatedTag : t
    );
    onChange?.(newValue);
    
    // Limpiar
    setEditingTag(null);
    setNewTagLabel("");
    setNewTagColor(AVAILABLE_COLORS[0]);
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
                        <button
                          type="button"
                          onClick={() => handleEditTag(tag)}
                          className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Editar etiqueta"
                        >
                          <i className="fas fa-pencil-alt text-xs"></i>
                        </button>
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
                        <button
                          type="button"
                          onClick={() => handleEditTag(tag)}
                          className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                          title="Editar etiqueta"
                        >
                          <i className="fas fa-pencil-alt text-xs"></i>
                        </button>
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

