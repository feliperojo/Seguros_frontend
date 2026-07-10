import React, { useState, useEffect, useRef } from "react";
import { ListGroup } from "react-bootstrap";

/**
 * Componente de autocompletado para menciones de usuarios
 * Se muestra cuando el usuario escribe @ en ReactQuill
 */
const MentionAutocomplete = ({
  users = [],
  searchTerm = "",
  onSelectUser,
  position = { top: 0, left: 0 },
  onClose,
}) => {
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users.slice(0, 10)); // Mostrar primeros 10 si no hay búsqueda
      return;
    }

    const search = searchTerm.toLowerCase();
    const filtered = users
      .filter((user) => {
        const name = (user.name || user.username || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return name.includes(search) || email.includes(search);
      })
      .slice(0, 10); // Limitar a 10 resultados

    setFilteredUsers(filtered);
    setSelectedIndex(0);
  }, [searchTerm, users]);

  useEffect(() => {
    // Scroll al elemento seleccionado
    if (listRef.current && filteredUsers.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, filteredUsers]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" && filteredUsers[selectedIndex]) {
        e.preventDefault();
        handleSelectUser(filteredUsers[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (onClose) onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredUsers, selectedIndex, onClose]);

  const handleSelectUser = (user) => {
    if (onSelectUser) {
      onSelectUser(user);
    }
  };

  if (filteredUsers.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
        backgroundColor: "white",
        border: "1px solid #dee2e6",
        borderRadius: "6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        maxWidth: "300px",
        maxHeight: "300px",
        overflowY: "auto",
      }}
      ref={listRef}
    >
      <ListGroup variant="flush">
        {filteredUsers.map((user, index) => (
          <ListGroup.Item
            key={user.id}
            action
            active={index === selectedIndex}
            onClick={() => handleSelectUser(user)}
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              border: "none",
              backgroundColor: index === selectedIndex ? "#e3f2fd" : "transparent",
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="d-flex align-items-center">
              <div
                className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2"
                style={{
                  width: "32px",
                  height: "32px",
                  fontSize: "14px",
                  fontWeight: "600",
                }}
              >
                {(user.name || user.username || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div className="flex-grow-1">
                <div className="fw-medium">
                  {user.name || user.username || `Usuario ${user.id}`}
                </div>
                {user.email && (
                  <div className="text-muted small">{user.email}</div>
                )}
              </div>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
};

export default MentionAutocomplete;

