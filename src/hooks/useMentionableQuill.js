import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { extractMentionedUserIds } from '../utils/mentions';

/**
 * Hook personalizado para agregar funcionalidad de menciones (@usuario) a ReactQuill
 * @param {Array} users - Lista de usuarios disponibles
 * @param {Function} onMentionChange - Callback cuando cambian las menciones
 * @returns {Object} { quillRef, showMentionList, mentionList, selectedMentionIndex, handleQuillKeyDown }
 */
export const useMentionableQuill = (users = [], onMentionChange = null) => {
  const quillRef = useRef(null);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionList, setMentionList] = useState([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(null);
  const mentionSearchRef = useRef('');
  
  // Debug: log cuando cambian los usuarios (solo en desarrollo y una vez)
  const usuariosLogeadosRef = useRef(false);
  useEffect(() => {
    if (import.meta.env.DEV && !usuariosLogeadosRef.current && users && users.length > 0) {
      console.log(`📋 Hook: ${users.length} usuarios disponibles para menciones`);
      usuariosLogeadosRef.current = true;
    }
  }, [users?.length]); // Solo cuando cambia la cantidad de usuarios
  
  // Debug: log cuando cambia showMentionList (solo cuando se muestra, no cuando se oculta)
  const showMentionListLogRef = useRef(false);
  useEffect(() => {
    if (import.meta.env.DEV && showMentionList && !showMentionListLogRef.current) {
      console.log(`🔍 Dropdown de menciones visible con ${mentionList.length} usuarios`);
      showMentionListLogRef.current = true;
    } else if (!showMentionList) {
      showMentionListLogRef.current = false;
    }
  }, [showMentionList]);

  // Filtrar usuarios para el autocompletado
  const filterUsers = (searchText) => {
    if (!users || users.length === 0) return [];
    
    // Si no hay texto de búsqueda, mostrar primeros usuarios
    if (!searchText || searchText.trim() === '') {
      return users.slice(0, 20);
    }
    
    const searchLower = searchText.toLowerCase().trim();
    const filtered = users.filter(user => {
      const name = (user.name || user.nombre || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      // Buscar por coincidencia en nombre o email
      return name.includes(searchLower) || email.includes(searchLower);
    });
    
    // Ordenar: primero los que empiezan con el texto de búsqueda
    const sorted = filtered.sort((a, b) => {
      const aName = (a.name || a.nombre || '').toLowerCase();
      const bName = (b.name || b.nombre || '').toLowerCase();
      const aStarts = aName.startsWith(searchLower);
      const bStarts = bName.startsWith(searchLower);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });
    
    return sorted.slice(0, 20); // Limitar a 20 resultados
  };

  // Inserta una mención en el editor
  const insertMention = (user) => {
    if (!user) return;
    
    // Obtener el editor de Quill
    let quill = null;
    try {
      if (quillRef.current) {
        if (typeof quillRef.current.getEditor === 'function') {
          quill = quillRef.current.getEditor();
        } else if (quillRef.current.getSelection) {
          quill = quillRef.current;
        }
      }
    } catch (error) {
      console.error('Error obteniendo editor para insertar mención:', error);
      return;
    }
    
    if (!quill) {
      console.error('No se pudo obtener el editor de Quill');
      return;
    }

    const range = quill.getSelection(true);
    if (!range) return;

    // Si estamos en medio de una mención, eliminar el texto desde mentionStartPos
    if (mentionStartPos !== null && range.index > mentionStartPos) {
      quill.deleteText(mentionStartPos, range.index - mentionStartPos);
      range.index = mentionStartPos;
    }

    // ✅ Insertar la mención con formato limpio y profesional: solo @Nombre
    const userName = user.name || user.nombre || 'Usuario';
    const mentionText = `@${userName} `; // Espacio al final para separar del siguiente texto
    
    // Calcular posición de inserción
    let insertIndex = range.index;
    if (mentionStartPos !== null && range.index > mentionStartPos) {
      // Eliminar el texto desde @ hasta la posición actual
      const deleteLength = range.index - mentionStartPos;
      quill.deleteText(mentionStartPos, deleteLength, 'user');
      insertIndex = mentionStartPos;
    }
    
    // Insertar el texto de la mención
    quill.insertText(insertIndex, mentionText, 'user');
    
    // Aplicar formato visual profesional (color azul y negrita)
    quill.formatText(insertIndex, mentionText.length - 1, 'color', '#1976d2', 'user'); // -1 para no incluir el espacio
    quill.formatText(insertIndex, mentionText.length - 1, 'bold', true, 'user');
    
    // Mover el cursor después de la mención (después del espacio)
    quill.setSelection(insertIndex + mentionText.length);

    // Cerrar el dropdown de menciones
    setShowMentionList(false);
    setMentionStartPos(null);
    mentionSearchRef.current = '';
  };

  // Maneja el evento de cambio en Quill para detectar menciones
  const handleQuillChange = (content, delta, source, editorParam) => {
    if (source !== 'user') return; // Solo procesar cambios del usuario, no programáticos
    
    // ✅ Notificar cambios de menciones cuando el usuario escribe
    if (content && typeof content === 'string') {
      notifyMentionChange(content);
    }
    
    // Obtener el editor de Quill correctamente
    // En ReactQuill, el parámetro 'editor' del onChange puede ser el componente o el editor
    let quill = null;
    try {
      // Primero intentar desde el ref (más confiable)
      if (quillRef.current) {
        if (typeof quillRef.current.getEditor === 'function') {
          quill = quillRef.current.getEditor();
        } else if (quillRef.current.getSelection) {
          quill = quillRef.current;
        }
      }
      
      // Si no funciona, intentar desde el parámetro editor
      if (!quill && editorParam) {
        if (typeof editorParam.getEditor === 'function') {
          quill = editorParam.getEditor();
        } else if (editorParam.getSelection) {
          quill = editorParam;
        }
      }
    } catch (error) {
      console.error('Error obteniendo editor de Quill:', error);
      return;
    }
    
    if (!quill) {
      console.log('⚠️ No se pudo obtener el editor de Quill');
      return;
    }

    // Usar setTimeout para asegurar que el cursor esté en la posición correcta
    setTimeout(() => {
      try {
        const range = quill.getSelection(true);
        if (!range) {
          setShowMentionList(false);
          return;
        }

        // Obtener texto desde el inicio hasta la posición del cursor
        const textBeforeCursor = quill.getText(0, range.index);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        // Debug logging (solo en desarrollo y cuando realmente hay un @)
        if (import.meta.env.DEV && lastAtIndex !== -1) {
          const debugInfo = {
            textBeforeCursor: textBeforeCursor.substring(Math.max(0, textBeforeCursor.length - 30)),
            lastAtIndex,
            cursorIndex: range.index,
            distance: range.index - lastAtIndex,
            usersAvailable: users?.length || 0,
          };
          console.log('🔍 Detección de @:', debugInfo);
        }

        // Si encontramos @ y estamos cerca de él, mostrar lista de menciones
        if (lastAtIndex !== -1 && range.index - lastAtIndex <= 50 && range.index - lastAtIndex >= 0) {
          // Verificar que no haya espacios o saltos de línea entre @ y la posición actual
          const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
          
          // Validar que no haya espacios, saltos de línea o ya tenga formato de mención
          const hasInvalidChar = textAfterAt.includes(' ') || 
                                 textAfterAt.includes('\n') || 
                                 textAfterAt.includes('@[') ||
                                 textAfterAt.match(/\]\(/);
          
          if (!hasInvalidChar) {
            const searchText = textAfterAt.trim();
            
            // ✅ Si no hay texto después de @, mostrar todos los usuarios (limitados)
            // Si hay texto, filtrar
            let filtered = [];
            if (!searchText || searchText === '') {
              // Mostrar primeros 20 usuarios cuando solo se escribe @
              filtered = users && users.length > 0 ? users.slice(0, 20) : [];
            } else {
              filtered = filterUsers(searchText);
            }
            
            // Mostrar lista si hay usuarios disponibles
            if (filtered.length > 0) {
              setMentionStartPos(lastAtIndex);
              setMentionList(filtered);
              setShowMentionList(true);
              setSelectedMentionIndex(0);
              mentionSearchRef.current = searchText;
              return;
            } else if (users && users.length > 0 && (!searchText || searchText === '')) {
              // Si escribió solo @ y hay usuarios, mostrar lista
              const defaultList = users.slice(0, 20);
              setMentionStartPos(lastAtIndex);
              setMentionList(defaultList);
              setShowMentionList(true);
              setSelectedMentionIndex(0);
              mentionSearchRef.current = '';
              return;
            }
          } else {
            // Si tiene caracteres inválidos, ocultar
            setShowMentionList(false);
          }
        } else {
          // Si no hay @ cerca, ocultar
          setShowMentionList(false);
          mentionSearchRef.current = '';
        }
      } catch (error) {
        console.error('Error procesando menciones:', error);
        setShowMentionList(false);
      }
    }, 10); // Pequeño delay para asegurar que el cursor está actualizado
  };

  // Maneja las teclas en Quill para navegar las menciones
  const handleQuillKeyDown = (e) => {
    if (!showMentionList || mentionList.length === 0) {
      // Si se presiona @, activar detección manualmente
      if (e.key === '@' || (e.key === 'Shift' && e.keyCode === 50)) {
        // Dar tiempo para que el @ se inserte primero
        setTimeout(() => {
          if (quillRef.current) {
            try {
              const quill = typeof quillRef.current.getEditor === 'function' 
                ? quillRef.current.getEditor() 
                : quillRef.current;
              
              if (quill) {
                const range = quill.getSelection(true);
                if (range) {
                  const text = quill.getText(0, range.index);
                  if (text.endsWith('@')) {
                    // Mostrar usuarios al escribir @
                    if (users && users.length > 0) {
                      setMentionStartPos(range.index - 1);
                      setMentionList(users.slice(0, 20));
                      setShowMentionList(true);
                      setSelectedMentionIndex(0);
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error activando mención:', error);
            }
          }
        }, 50);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev < mentionList.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (mentionList[selectedMentionIndex]) {
        insertMention(mentionList[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionList(false);
      setMentionStartPos(null);
    }
  };

  // Función helper para extraer y notificar menciones del contenido actual
  // Usar useMemo para evitar recrear la función en cada render
  const notifyMentionChange = useCallback((content) => {
    if (onMentionChange && content) {
      try {
        // Pasar la lista de usuarios para hacer match por nombre
        const mentionedIds = extractMentionedUserIds(content, users);
        onMentionChange(mentionedIds);
      } catch (error) {
        // Solo log en desarrollo
        if (import.meta.env.DEV) {
          console.debug('Error extrayendo menciones:', error);
        }
      }
    }
  }, [onMentionChange, users?.length]); // Solo cuando cambia la cantidad de usuarios, no el array completo

  // Llamar al callback cuando cambian las menciones (solo cuando realmente cambia, no en cada render)
  const lastContentRef = useRef('');
  useEffect(() => {
    if (quillRef.current && showMentionList) {
      try {
        const quill = quillRef.current.getEditor();
        if (quill && quill.root) {
          const content = quill.root.innerHTML;
          // Solo notificar si el contenido realmente cambió
          if (content !== lastContentRef.current) {
            lastContentRef.current = content;
            notifyMentionChange(content);
          }
        }
      } catch (error) {
        // Ignorar errores si el editor aún no está listo
      }
    }
  }, [showMentionList]); // Solo cuando se muestra/oculta la lista, removido notifyMentionChange para evitar loops

  // Función para actualizar índice seleccionado desde fuera
  const updateSelectedIndex = (index) => {
    setSelectedMentionIndex(index);
  };

  return {
    quillRef,
    showMentionList,
    mentionList,
    selectedMentionIndex,
    mentionStartPos,
    insertMention,
    handleQuillChange,
    handleQuillKeyDown,
    updateSelectedIndex,
  };
};

