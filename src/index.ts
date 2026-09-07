import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getScheduleForDate, getCurrentPeriodStatus } from './services/scheduleService';
import { getActiveCafeCode, verifyCafeCode, setManualCodeOverride } from './services/codeService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'BCA Upper Cafe Schedule & Period API',
    domain: 'schedule.bcaupper.cafe',
    version: '1.0.0',
    endpoints: [
      'GET /api/schedule/date/:date - Check if school exists on a given date (YYYY-MM-DD or MM-DD-YYYY)',
      'GET /api/schedule/current - Check current period and school status for now',
      'GET /api/schedule/period?date=...&time=...&tz=... - Check period at specific date/time',
      'GET /api/code/current - Get active 6-character Cafe Code',
      'POST /api/code/verify - Verify a student-entered Cafe Code'
    ]
  });
});

// 1. Check if school exists on a given date
// e.g., /api/schedule/date/2026-09-07 or /api/schedule/date/09-07-2026
app.get('/api/schedule/date/:date', (req, res) => {
  try {
    const rawDate = req.params.date;
    let targetDate: Date;

    if (rawDate.includes('-')) {
      const parts = rawDate.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        targetDate = new Date(`${rawDate}T12:00:00Z`);
      } else {
        // MM-DD-YYYY
        targetDate = new Date(`${parts[2]}-${parts[0]}-${parts[1]}T12:00:00Z`);
      }
    } else {
      targetDate = new Date(rawDate);
    }

    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD or MM-DD-YYYY' });
    }

    const tz = (req.query.timezone as string) || 'America/New_York';
    const schedule = getScheduleForDate(targetDate, tz);

    res.json({
      date: rawDate,
      hasSchool: schedule.hasSchool,
      scheduleType: schedule.scheduleType,
      periods: schedule.periods
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Check current period and school status for right now
app.get('/api/schedule/current', (req, res) => {
  try {
    const tz = (req.query.timezone as string) || 'America/New_York';
    // Allow simulation via query param for testing: ?simTime=09:30:00&simDate=2026-09-08
    let now = new Date();
    if (req.query.simTime) {
      const datePart = (req.query.simDate as string) || now.toISOString().split('T')[0];
      now = new Date(`${datePart}T${req.query.simTime}`);
    }

    const status = getCurrentPeriodStatus(now, tz);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Check which period exists at a given date, time, and timezone
app.get('/api/schedule/period', (req, res) => {
  try {
    const dateStr = (req.query.date as string);
    const timeStr = (req.query.time as string);
    const tz = (req.query.timezone as string) || 'America/New_York';

    if (!dateStr || !timeStr) {
      return res.status(400).json({ error: 'Missing required query parameters: date and time' });
    }

    const combined = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(combined.getTime())) {
      return res.status(400).json({ error: 'Invalid date or time' });
    }

    const status = getCurrentPeriodStatus(combined, tz);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Cafe Code Endpoints
app.get('/api/code/current', (req, res) => {
  try {
    const tz = (req.query.timezone as string) || 'America/New_York';
    let now = new Date();
    if (req.query.simTime) {
      const datePart = (req.query.simDate as string) || now.toISOString().split('T')[0];
      now = new Date(`${datePart}T${req.query.simTime}`);
    }

    const codeInfo = getActiveCafeCode(now, tz);
    res.json(codeInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/code/verify', (req, res) => {
  try {
    const { code, timezone } = req.body;
    const tz = timezone || 'America/New_York';
    const result = verifyCafeCode(code, new Date(), tz);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin override endpoint
app.post('/api/code/override', (req, res) => {
  try {
    const { code, period, durationMinutes } = req.body;
    if (!code || !period) {
      return res.status(400).json({ error: 'Missing code or period' });
    }
    setManualCodeOverride(code, period, durationMinutes || 45);
    res.json({ success: true, message: `Code manually set to ${code} for period ${period}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[school-schedules] API server running on port ${PORT} (schedule.bcaupper.cafe)`);
});
