import { parseApiDateToLocalDate } from "./formatters";

const parseToLocalDateStart = (value) => parseApiDateToLocalDate(value);

export const isTaskOverdue = (dueDate, now = new Date()) => {
  const dueStart = parseToLocalDateStart(dueDate);
  if (!dueStart) return false;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return todayStart.getTime() > dueStart.getTime();
};

export const getTaskOverdueDays = (dueDate, now = new Date()) => {
  const dueStart = parseToLocalDateStart(dueDate);
  if (!dueStart) return 0;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = todayStart.getTime() - dueStart.getTime();
  if (diffMs <= 0) return 0;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};
