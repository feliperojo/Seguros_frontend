// components/Pagination.jsx
import React from "react";
import { Pagination as BootstrapPagination } from "react-bootstrap";

/**
 * Componente de paginación reutilizable
 * @param {Object} props
 * @param {number} props.currentPage - Página actual
 * @param {number} props.totalPages - Total de páginas
 * @param {Function} props.onPageChange - Callback cuando cambia la página (page) => void
 * @param {boolean} props.disabled - Si está deshabilitado
 */
const Pagination = ({ currentPage, totalPages, onPageChange, disabled = false }) => {
  if (totalPages <= 1) return null;

  const handlePageChange = (page) => {
    if (disabled || page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  const items = [];
  const maxVisible = 5; // Máximo de números visibles
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  // Ajustar si estamos cerca del final
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  // Botón "Primera página"
  if (startPage > 1) {
    items.push(
      <BootstrapPagination.First
        key="first"
        onClick={() => handlePageChange(1)}
        disabled={disabled}
      />
    );
    items.push(
      <BootstrapPagination.Prev
        key="prev"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
      />
    );
  }

  // Números de página
  for (let i = startPage; i <= endPage; i++) {
    items.push(
      <BootstrapPagination.Item
        key={i}
        active={i === currentPage}
        onClick={() => handlePageChange(i)}
        disabled={disabled}
      >
        {i}
      </BootstrapPagination.Item>
    );
  }

  // Botón "Última página"
  if (endPage < totalPages) {
    items.push(
      <BootstrapPagination.Next
        key="next"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
      />
    );
    items.push(
      <BootstrapPagination.Last
        key="last"
        onClick={() => handlePageChange(totalPages)}
        disabled={disabled}
      />
    );
  }

  return (
    <BootstrapPagination className="justify-content-center">
      {items}
    </BootstrapPagination>
  );
};

export default Pagination;

