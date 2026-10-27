const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";

const brazilianDateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: OPERATIONAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

function zonedParts(timestamp: number): number[] {
  const parts = brazilianDateTime.formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return [
    Number(values.year), Number(values.month), Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second)
  ];
}

/** Parses Brazilian wall-clock dates in the operation's timezone, independent of the server timezone. */
export function parseAppointment(input: string): number {
  const normalized = input.trim();
  if (!normalized) return Number.NaN;

  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, dayText, monthText, yearText, hourText = "0", minuteText = "0", secondText = "0"] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);

    if (year < 1 || month < 1 || month > 12 || day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return Number.NaN;
    }
    const calendar = new Date(0);
    calendar.setUTCFullYear(year, month - 1, day);
    calendar.setUTCHours(hour, minute, second, 0);
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
      return Number.NaN;
    }

    const requestedWallTime = calendar.getTime();
    let timestamp = requestedWallTime;
    for (let attempt = 0; attempt < 3; attempt++) {
      const [localYear, localMonth, localDay, localHour, localMinute, localSecond] = zonedParts(timestamp);
      const representedWallTime = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMinute, localSecond);
      timestamp = requestedWallTime - (representedWallTime - timestamp);
    }

    const actualParts = zonedParts(timestamp);
    if (actualParts.some((part, index) => part !== [year, month, day, hour, minute, second][index])) return Number.NaN;
    return timestamp;
  }

  // ISO timestamps with explicit offsets and other supported native formats remain accepted.
  const native = Date.parse(normalized);
  return Number.isFinite(native) ? native : Number.NaN;
}

/** Alert only for valid scheduled times that are strictly in the past and not completed. */
export function shouldAlertAppointment(timestamp: number, completed: boolean, nowTimestamp: number): boolean {
  return !completed && Number.isFinite(timestamp) && timestamp < nowTimestamp;
}

function cellValue(data: unknown, key: string): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

/** Operational rule: collection is complete when AU or AV has a value. */
export function isCollectionCompleted(data: unknown): boolean {
  return Boolean(cellValue(data, "AU") || cellValue(data, "AV"));
}

/** Operational rule: only AW completes the first delivery; AS is not monitored. */
export function isDeliveryCompleted(data: unknown): boolean {
  return Boolean(cellValue(data, "AW"));
}
