/**
 * Utilidades para manejar menciones de usuarios (@username)
 * Compatible con ReactQuill y texto plano
 */

/**
 * Extrae menciones del texto HTML de ReactQuill
 * @param {string} html - HTML del editor
 * @returns {Array} Array de objetos { userId, username, position }
 */
export const extractMentions = (html) => {
  if (!html) return [];
  
  const mentions = [];
  // Buscar patrones <span data-user-id="123" class="mention">@username</span>
  const mentionRegex = /<span[^>]*data-user-id="(\d+)"[^>]*class="mention"[^>]*>@([^<]+)<\/span>/g;
  
  let match;
  while ((match = mentionRegex.exec(html)) !== null) {
    mentions.push({
      userId: parseInt(match[1], 10),
      username: match[2],
      position: match.index,
    });
  }
  
  return mentions;
};

/**
 * Extrae menciones de texto plano
 * @param {string} text - Texto plano
 * @returns {Array} Array de objetos { username, position }
 */
export const extractMentionsFromPlainText = (text) => {
  if (!text) return [];
  
  const mentions = [];
  // Buscar patrones @username o @nombre completo
  const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
  
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      username: match[1],
      position: match.index,
    });
  }
  
  return mentions;
};

/**
 * Crea HTML de mención para ReactQuill
 * @param {Object} user - Objeto usuario { id, name }
 * @returns {string} HTML span con la mención
 */
export const createMentionHTML = (user) => {
  const username = user.name || user.username || `Usuario ${user.id}`;
  return `<span data-user-id="${user.id}" class="mention" style="background-color: #e3f2fd; color: #1976d2; padding: 2px 4px; border-radius: 3px; font-weight: 500;">@${username}</span>`;
};

/**
 * Reemplaza texto plano @username con HTML de mención si encuentra el usuario
 * @param {string} text - Texto con @username
 * @param {Array} users - Lista de usuarios disponibles
 * @returns {string} HTML con menciones formateadas
 */
export const processMentionsInText = (text, users = []) => {
  if (!text || !users.length) return text;
  
  let processed = text;
  const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
  
  mentionRegex.lastIndex = 0;
  let match;
  const replacements = [];
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionedName = match[1];
    // Buscar usuario por nombre (case insensitive, parcial)
    const user = users.find(u => {
      const name = (u.name || u.username || '').toLowerCase();
      const searchName = mentionedName.toLowerCase();
      return name.includes(searchName) || searchName.includes(name);
    });
    
    if (user) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement: createMentionHTML(user),
      });
    }
  }
  
  // Aplicar reemplazos de atrás hacia adelante para mantener índices
  replacements.reverse().forEach(({ start, end, replacement }) => {
    processed = processed.substring(0, start) + replacement + processed.substring(end);
  });
  
  return processed;
};

/**
 * Extrae IDs únicos de usuarios mencionados
 * @param {string} html - HTML con menciones
 * @returns {Array<number>} Array de IDs únicos
 */
export const getMentionedUserIds = (html) => {
  const mentions = extractMentions(html);
  const userIds = mentions.map(m => m.userId);
  return [...new Set(userIds)]; // Eliminar duplicados
};

/**
 * Verifica si un usuario está mencionado en el texto
 * @param {string} html - HTML con menciones
 * @param {number} userId - ID del usuario a verificar
 * @returns {boolean}
 */
export const isUserMentioned = (html, userId) => {
  const mentionedIds = getMentionedUserIds(html);
  return mentionedIds.includes(userId);
};

