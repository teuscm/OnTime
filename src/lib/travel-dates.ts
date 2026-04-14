// Build flight search date scenarios based on user preferences

interface DateScenario {
  label: string;
  dep: string;   // YYYY-MM-DD
  ret: string;   // YYYY-MM-DD
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function buildScenarioDates(
  eventStart: string,
  eventEnd: string,
  prefs: {
    itineraryStyle: string;
    bufferArriveDayBefore: boolean;
    bufferDepartDayAfter: boolean;
    bleisureEnabled: boolean;
  }
): DateScenario[] {
  const start = new Date(eventStart);
  const end = new Date(eventEnd);

  const eventDepDate = toDateStr(start);
  const eventRetDate = toDateStr(end);

  const dayBefore = toDateStr(new Date(start.getTime() - 86400000));
  const dayAfter = toDateStr(new Date(end.getTime() + 86400000));

  const scenarios: DateScenario[] = [
    { label: "Bate-volta", dep: eventDepDate, ret: eventRetDate },
  ];

  // Buffer scenario
  const bufferDep = prefs.bufferArriveDayBefore ? dayBefore : eventDepDate;
  const bufferRet = prefs.bufferDepartDayAfter ? dayAfter : eventRetDate;
  if (bufferDep !== eventDepDate || bufferRet !== eventRetDate) {
    scenarios.push({ label: "Com buffer", dep: bufferDep, ret: bufferRet });
  }

  // Bleisure: return on next Sunday
  if (prefs.bleisureEnabled) {
    const dayOfWeek = end.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const sunday = new Date(end.getTime() + daysUntilSunday * 86400000);
    scenarios.push({
      label: "Bleisure (volta domingo)",
      dep: bufferDep,
      ret: toDateStr(sunday),
    });
  }

  return scenarios;
}
