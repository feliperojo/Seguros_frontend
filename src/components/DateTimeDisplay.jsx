import React, { useState, useEffect } from "react";
import "../styles/DateTimeDisplay.css";

const DateTimeDisplay = () => {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    // Actualizar cada segundo
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Formatear fecha en español
  const formatDate = (date) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString("es-ES", options);
  };

  // Formatear hora
  const formatTime = (date) => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="datetime-display">
      <div className="datetime-time">{formatTime(dateTime)}</div>
      <div className="datetime-date">{formatDate(dateTime)}</div>
    </div>
  );
};

export default DateTimeDisplay;

