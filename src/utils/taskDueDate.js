const parseToLocalDateStart = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

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
