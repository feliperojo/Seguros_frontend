/**
 * Utilidades para manejo de menciones (@usuario) en tareas
 */

/**
 * Extrae menciones del formato @usuario o @[Usuario Name](id) de un texto HTML
 * @param {string} htmlText - Texto HTML que puede contener menciones
 * @param {Array} users - Lista de usuarios disponibles para resolver nombres a IDs
 * @returns {Array} Array de objetos { id, name, fullMatch }
 */
export const extractMentions = (htmlText, users = []) => {
  if (!htmlText) return [];
  
  const mentions = [];
  
  // Patrón para @[Nombre](id) (formato Quill mention legacy)
  const mentionPattern = /@\[([^\]]+)\]\((\d+)\)/g;
  let match;
  
  while ((match = mentionPattern.exec(htmlText)) !== null) {
    const mentionId = parseInt(match[2]);
    const mentionName = match[1];
    
    // Evitar duplicados por ID
    if (!mentions.some(m => m.id === mentionId)) {
      mentions.push({
        id: mentionId,
        name: mentionName,
        fullMatch: match[0],
      });
    }
  }
  
  // Buscar menciones simples @Nombre (formato actual usado por useMentionableQuill)
  // Pueden estar dentro de tags HTML como <strong>@Nombre</strong> o simplemente @Nombre
  // Extraer texto sin HTML para buscar menciones
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlText;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';
  
  // Buscar patrones @Nombre en el texto plano
  // El patrón busca @ seguido de letras, espacios y caracteres especiales comunes en nombres
  const simplePattern = /@([a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+?)(?:\s|$|<\/|&nbsp;)/g;
  while ((match = simplePattern.exec(plainText)) !== null) {
    const mentionedName = match[1].trim();
    
    // Buscar el usuario en la lista para obtener el ID
    const user = users.find(u => {
      const userName = (u.name || u.nombre || '').trim();
      // Comparación exacta (case insensitive)
      return userName.toLowerCase() === mentionedName.toLowerCase();
    });
    
    // Solo agregar si encontramos un usuario válido con ID y no está duplicado
    if (user && user.id) {
      const alreadyAdded = mentions.some(m => m.id === user.id);
      if (!alreadyAdded) {
        mentions.push({
          id: user.id,
          name: mentionedName,
          fullMatch: match[0],
        });
      }
    }
  }
  
  return mentions;
};

/**
 * Extrae solo los IDs de usuarios mencionados
 * @param {string} htmlText - Texto HTML
 * @param {Array} users - Lista de usuarios disponibles para hacer match por nombre (opcional)
 * @returns {Array<number>} Array de IDs de usuarios
 */
export const extractMentionedUserIds = (htmlText, users = []) => {
  if (!htmlText) return [];
  if (!users || users.length === 0) {
    // Si no hay usuarios, intentar extraer solo del formato legacy @[Nombre](id)
    const mentions = extractMentions(htmlText, []);
    return mentions
      .map(m => m.id)
      .filter(id => id !== null && id !== undefined && !isNaN(id));
  }
  
  const mentions = extractMentions(htmlText, users);
  // Filtrar solo IDs válidos (números)
  const mentionedIds = mentions
    .map(m => m.id)
    .filter(id => id !== null && id !== undefined && !isNaN(id) && typeof id === 'number');
  
  // Eliminar duplicados
  const uniqueIds = [...new Set(mentionedIds)];
  
  // 📝 Log de depuración: Menciones extraídas
  if (import.meta.env.DEV) {
    const mentionedUsers = users.filter(u => uniqueIds.includes(u.id)).map(u => ({ id: u.id, name: u.name || u.nombre }));
    console.log("🔍 [MENCIONES] Extraídas del texto:", {
      texto_preview: htmlText?.substring(0, 150) || "",
      texto_completo_length: htmlText?.length || 0,
      menciones_encontradas: mentions.map(m => ({ id: m.id, name: m.name, match: m.fullMatch })),
      ids_extraidos: uniqueIds,
      usuarios_resueltos: mentionedUsers,
      total_usuarios_disponibles: users.length,
      tiene_usuarios: users.length > 0
    });
  }
  
  return uniqueIds;
};

/**
 * Convierte texto plano con @nombre a formato Quill mention @[Nombre](id)
 * @param {string} text - Texto plano
 * @param {Array} users - Lista de usuarios disponibles [{ id, name }]
 * @returns {string} Texto con menciones en formato Quill
 */
export const convertSimpleMentionsToQuillFormat = (text, users = []) => {
  if (!text || !users.length) return text;
  
  let result = text;
  
  // Buscar patrones @nombre y reemplazar si encontramos el usuario
  users.forEach(user => {
    const userName = user.name || user.nombre || '';
    const userId = user.id;
    
    if (userName && userId) {
      // Buscar @nombre (case insensitive)
      const regex = new RegExp(`@${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\[)`, 'gi');
      result = result.replace(regex, `@[${userName}](${userId})`);
    }
  });
  
  return result;
};

/**
 * Resalta las menciones en el HTML renderizado
 * @param {string} htmlText - Texto HTML con menciones
 * @returns {string} HTML con estilos para menciones
 */
export const highlightMentions = (htmlText) => {
  if (!htmlText) return '';
  
  let result = htmlText;
  
  // 1. Reemplazar formato antiguo @[Nombre](id) con badge profesional
  result = result.replace(
    /@\[([^\]]+)\]\((\d+)\)/g,
    '<strong class="mention-badge" data-user-id="$2" style="color: #1976d2; font-weight: 600;" title="Mencionado: $1">@$1</strong>'
  );
  
  // 2. Mantener formato nuevo @Nombre que ya tiene estilo (si viene del editor con formato)
  // Las menciones nuevas ya tienen formato, así que solo necesitamos asegurar consistencia
  
  return result;
};

/**
 * Verifica si un texto contiene una mención a un usuario específico
 * @param {string} htmlText - Texto HTML
 * @param {number} userId - ID del usuario
 * @returns {boolean}
 */
export const isUserMentioned = (htmlText, userId) => {
  const mentionedIds = extractMentionedUserIds(htmlText);
  return mentionedIds.includes(userId);
};

/**
 * Busca menciones en un array de comentarios
 * @param {Array} comentarios - Array de comentarios
 * @param {number} userId - ID del usuario a buscar
 * @returns {Array} Comentarios que mencionan al usuario
 */
export const findMentionsInComments = (comentarios = [], userId) => {
  if (!comentarios || !Array.isArray(comentarios)) return [];
  
  return comentarios.filter(comentario => {
    const commentText = comentario.comment || comentario.response_note || comentario.note || '';
    return isUserMentioned(commentText, userId);
  });
};

