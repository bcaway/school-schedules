import fs from 'fs';
import path from 'path';

export interface SchedulePeriod {
  period: string;
  start: string; // "HH:MM:SS"
  end: string;   // "HH:MM:SS"
}

export interface DayScheduleResolution {
  hasSchool: boolean;
  scheduleType: string | null;
  periods: SchedulePeriod[];
}

export interface CurrentPeriodResult {
  hasSchool: boolean;
  status: 'no_school' | 'not_started' | 'in_session' | 'ended';
  scheduleType: string | null;
  period: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  nextPeriod: string | null;
  message: string;
  date: string;
  time: string;
  timezone: string;
}

const DATA_DIR = fs.existsSync(path.resolve(__dirname, '../data'))
  ? path.resolve(__dirname, '../data')
  : fs.existsSync(path.resolve(__dirname, '../../src/data'))
  ? path.resolve(__dirname, '../../src/data')
  : path.resolve(process.cwd(), 'src/data');

function parseMonthDayCsv(filePath: string): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  if (!fs.existsSync(filePath)) return map;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('month')) continue;

    // Handle CSV line e.g. 9,"[7, 8, 9]" or 9,"1,2,3" or 9,7
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex === -1) continue;

    const monthStr = trimmed.substring(0, commaIndex).trim();
    const month = parseInt(monthStr, 10);
    if (isNaN(month)) continue;

    let dayStr = trimmed.substring(commaIndex + 1).trim();
    if (dayStr.startsWith('"') && dayStr.endsWith('"')) {
      dayStr = dayStr.slice(1, -1).trim();
    }
    if (dayStr.startsWith('[') && dayStr.endsWith(']')) {
      dayStr = dayStr.slice(1, -1).trim();
    }

    const days = dayStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (!map.has(month)) {
      map.set(month, new Set<number>());
    }
    const set = map.get(month)!;
    days.forEach(d => set.add(d));
  }

  return map;
}

function parseSpecialDaysCsv(filePath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(filePath)) return map;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('date')) continue;

    const parts = trimmed.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      // date in MM-DD-YYYY format
      map.set(parts[0], parts[1]);
    }
  }

  return map;
}

export function loadScheduleJson(scheduleType: string): SchedulePeriod[] {
  const jsonPath = path.join(DATA_DIR, 'schedules', `${scheduleType}.json`);
  if (!fs.existsSync(jsonPath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content) as SchedulePeriod[];
  } catch (err) {
    console.error(`Failed to load schedule JSON for ${scheduleType}:`, err);
    return [];
  }
}

export function getScheduleForDate(targetDate: Date, timezone: string = 'America/New_York'): DayScheduleResolution {
  // Format date in target timezone
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  });

  const parts = dtf.formatToParts(targetDate);
  let month = 0;
  let day = 0;
  let year = 0;
  let weekday = '';

  for (const p of parts) {
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'weekday') weekday = p.value;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const formattedDate = `${mm}-${dd}-${year}`;

  // 1. Check special days
  const specialDaysMap = parseSpecialDaysCsv(path.join(DATA_DIR, 'csv/specialDays.csv'));
  if (specialDaysMap.has(formattedDate)) {
    const scheduleType = specialDaysMap.get(formattedDate)!;
    return {
      hasSchool: true,
      scheduleType,
      periods: loadScheduleJson(scheduleType)
    };
  }

  // 2. Check abbreviated days
  const abbreviatedMap = parseMonthDayCsv(path.join(DATA_DIR, 'csv/abbreviatedDays.csv'));
  if (abbreviatedMap.get(month)?.has(day)) {
    return {
      hasSchool: true,
      scheduleType: 'abbreviatedDays',
      periods: loadScheduleJson('abbreviatedDays')
    };
  }

  // 3. Check delayed opening days
  const delayedMap = parseMonthDayCsv(path.join(DATA_DIR, 'csv/delayedOpeningDays.csv'));
  if (delayedMap.get(month)?.has(day)) {
    return {
      hasSchool: true,
      scheduleType: 'delayedOpeningDays',
      periods: loadScheduleJson('delayedOpeningDays')
    };
  }

  // 4. Check full days
  const fullDaysMap = parseMonthDayCsv(path.join(DATA_DIR, 'csv/fullDays.csv'));
  if (fullDaysMap.get(month)?.has(day)) {
    return {
      hasSchool: true,
      scheduleType: 'fullDays',
      periods: loadScheduleJson('fullDays')
    };
  }

  // If not listed or is weekend and not specifically in fullDays
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  if (isWeekend) {
    return {
      hasSchool: false,
      scheduleType: null,
      periods: []
    };
  }

  // Default weekday fallback if not explicitly in CSV (school session)
  return {
    hasSchool: true,
    scheduleType: 'fullDays',
    periods: loadScheduleJson('fullDays')
  };
}

function timeToSeconds(timeStr: string): number {
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

export function getCurrentPeriodStatus(now: Date = new Date(), timezone: string = 'America/New_York'): CurrentPeriodResult {
  const scheduleRes = getScheduleForDate(now, timezone);

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const currentTimeStr = timeFormatter.format(now);
  const currentDateStr = dateFormatter.format(now);
  const currentSecs = timeToSeconds(currentTimeStr);

  if (!scheduleRes.hasSchool || scheduleRes.periods.length === 0) {
    return {
      hasSchool: false,
      status: 'no_school',
      scheduleType: null,
      period: null,
      periodStart: null,
      periodEnd: null,
      nextPeriod: null,
      message: 'No school today!',
      date: currentDateStr,
      time: currentTimeStr,
      timezone
    };
  }

  const periods = scheduleRes.periods;
  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];

  const schoolStartSecs = timeToSeconds(firstPeriod.start);
  const schoolEndSecs = timeToSeconds(lastPeriod.end);

  if (currentSecs < schoolStartSecs) {
    return {
      hasSchool: true,
      status: 'not_started',
      scheduleType: scheduleRes.scheduleType,
      period: null,
      periodStart: null,
      periodEnd: null,
      nextPeriod: firstPeriod.period,
      message: "School hasn't started yet!",
      date: currentDateStr,
      time: currentTimeStr,
      timezone
    };
  }

  if (currentSecs > schoolEndSecs) {
    return {
      hasSchool: true,
      status: 'ended',
      scheduleType: scheduleRes.scheduleType,
      period: null,
      periodStart: null,
      periodEnd: null,
      nextPeriod: null,
      message: 'No school for the rest of the day!',
      date: currentDateStr,
      time: currentTimeStr,
      timezone
    };
  }

  // Inside school hours: check each period
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const pStartSecs = timeToSeconds(p.start);
    const pEndSecs = timeToSeconds(p.end);

    // If directly inside period
    if (currentSecs >= pStartSecs && currentSecs <= pEndSecs) {
      const nextP = i < periods.length - 1 ? periods[i + 1].period : null;
      return {
        hasSchool: true,
        status: 'in_session',
        scheduleType: scheduleRes.scheduleType,
        period: p.period,
        periodStart: p.start,
        periodEnd: p.end,
        nextPeriod: nextP,
        message: `Current: Period ${p.period}`,
        date: currentDateStr,
        time: currentTimeStr,
        timezone
      };
    }

    // If in passing period between p and p+1
    if (i < periods.length - 1) {
      const nextP = periods[i + 1];
      const nextPStartSecs = timeToSeconds(nextP.start);
      if (currentSecs > pEndSecs && currentSecs < nextPStartSecs) {
        // Cafe code is generated at the start of every period and valid until the next period
        // During passing period, current code for the period that just ended remains valid until the next period starts
        return {
          hasSchool: true,
          status: 'in_session',
          scheduleType: scheduleRes.scheduleType,
          period: p.period,
          periodStart: p.start,
          periodEnd: nextP.start,
          nextPeriod: nextP.period,
          message: `Passing period to Period ${nextP.period}`,
          date: currentDateStr,
          time: currentTimeStr,
          timezone
        };
      }
    }
  }

  return {
    hasSchool: true,
    status: 'in_session',
    scheduleType: scheduleRes.scheduleType,
    period: firstPeriod.period,
    periodStart: firstPeriod.start,
    periodEnd: firstPeriod.end,
    nextPeriod: null,
    message: `Current: Period ${firstPeriod.period}`,
    date: currentDateStr,
    time: currentTimeStr,
    timezone
  };
}
