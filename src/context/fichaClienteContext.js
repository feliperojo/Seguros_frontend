import { createContext, useContext } from "react";

export const FichaClienteContext = createContext(null);

// Hook que usarán los hijos (tabs)
export const useFichaCliente = () => useContext(FichaClienteContext);
