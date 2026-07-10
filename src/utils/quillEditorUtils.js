/**
 * Obtiene la instancia Quill desde el 4º argumento de onChange de ReactQuill o desde un ref.
 * ReactQuill puede exponer el wrapper (con getEditor) o, según versión, ya el Quill.
 */
export function getQuillInstance(editorOrWrapper) {
  if (editorOrWrapper == null) return null;
  if (typeof editorOrWrapper.getEditor === "function") {
    try {
      return editorOrWrapper.getEditor();
    } catch {
      return null;
    }
  }
  if (
    typeof editorOrWrapper.getSelection === "function" &&
    typeof editorOrWrapper.insertText === "function"
  ) {
    return editorOrWrapper;
  }
  return null;
}
