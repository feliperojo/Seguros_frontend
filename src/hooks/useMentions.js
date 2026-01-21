import { useMemo } from 'react';
import { isUserMentioned, extractMentionedUserIds } from '../utils/mentions';

/**
 * Hook para detectar si el usuario actual fue mencionado en tareas/comentarios
 * @param {Object} currentUser - Usuario actual { id, name }
 * @param {Array} tasks - Array de tareas
 * @param {Array} comments - Array de comentarios (opcional)
 * @returns {Object} { isMentioned, mentionedInTasks, mentionedInComments, checkMention }
 */
export const useMentions = (currentUser, tasks = [], comments = []) => {
  const currentUserId = currentUser?.id || null;

  // Verificar si el usuario fue mencionado en tareas
  const mentionedInTasks = useMemo(() => {
    if (!currentUserId || !tasks || tasks.length === 0) return [];

    return tasks.filter(task => {
      // Verificar en la descripción de la tarea
      const taskNote = task.note || task.log?.note || '';
      if (taskNote && isUserMentioned(taskNote, currentUserId)) {
        return true;
      }

      // Verificar en comentarios de la tarea
      const taskComments = task.comments || [];
      const hasMentionInComments = taskComments.some(comment => {
        const commentText = comment.comment || comment.response_note || '';
        return commentText && isUserMentioned(commentText, currentUserId);
      });

      return hasMentionInComments;
    }).map(task => task.id);
  }, [currentUserId, tasks]);

  // Verificar si el usuario fue mencionado en comentarios específicos
  const mentionedInComments = useMemo(() => {
    if (!currentUserId || !comments || comments.length === 0) return [];

    return comments.filter(comment => {
      const commentText = comment.comment || comment.response_note || '';
      return commentText && isUserMentioned(commentText, currentUserId);
    }).map(comment => comment.id);
  }, [currentUserId, comments]);

  // Función helper para verificar si una tarea específica tiene menciones
  const isTaskMentioned = (task) => {
    if (!currentUserId || !task) return false;
    
    const taskNote = task.note || task.log?.note || '';
    if (taskNote && isUserMentioned(taskNote, currentUserId)) {
      return true;
    }

    const taskComments = task.comments || [];
    return taskComments.some(comment => {
      const commentText = comment.comment || comment.response_note || '';
      return commentText && isUserMentioned(commentText, currentUserId);
    });
  };

  // Función helper para verificar si un comentario específico tiene menciones
  const isCommentMentioned = (comment) => {
    if (!currentUserId || !comment) return false;
    const commentText = comment.comment || comment.response_note || '';
    return commentText && isUserMentioned(commentText, currentUserId);
  };

  return {
    isMentioned: mentionedInTasks.length > 0 || mentionedInComments.length > 0,
    mentionedInTasks,
    mentionedInComments,
    isTaskMentioned,
    isCommentMentioned,
  };
};

export default useMentions;
