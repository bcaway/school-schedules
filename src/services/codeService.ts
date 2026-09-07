import crypto from 'crypto';
import { getCurrentPeriodStatus } from './scheduleService';

// Custom override support (e.g. for testing or admin manual override)
let manualCodeOverride: { code: string; period: string; expiresAt: Date } | null = null;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars (0, O, 1, I)

export function getActiveCafeCode(now: Date = new Date(), timezone: string = 'America/New_York'): {
  code: string | null;
  period: string | null;
  validUntil: string | null;
  isValid: boolean;
  reason?: string;
} {
  const periodStatus = getCurrentPeriodStatus(now, timezone);

  // If school is not in session (weekend, before school, after school, break), no code is valid
  if (periodStatus.status !== 'in_session' || !periodStatus.period) {
    return {
      code: null,
      period: null,
      validUntil: null,
      isValid: false,
      reason: periodStatus.message
    };
  }

  // Check manual override
  if (manualCodeOverride && manualCodeOverride.expiresAt > now && manualCodeOverride.period === periodStatus.period) {
    return {
      code: manualCodeOverride.code,
      period: periodStatus.period,
      validUntil: periodStatus.periodEnd,
      isValid: true
    };
  }

  // Generate 6-character deterministic code based on date and period
  // Generated at the start of every period and valid until the next period
  const seed = `BCA-UPPER-CAFE-${periodStatus.date}-${periodStatus.period}-${periodStatus.periodStart}`;
  const hash = crypto.createHash('sha256').update(seed).digest();

  let code = '';
  for (let i = 0; i < 6; i++) {
    const byte = hash[i];
    code += CODE_CHARS[byte % CODE_CHARS.length];
  }

  return {
    code,
    period: periodStatus.period,
    validUntil: periodStatus.periodEnd,
    isValid: true
  };
}

export function verifyCafeCode(inputCode: string, now: Date = new Date(), timezone: string = 'America/New_York'): {
  valid: boolean;
  period: string | null;
  message: string;
} {
  if (!inputCode) {
    return { valid: false, period: null, message: 'Please enter a code' };
  }

  const normalized = inputCode.trim().toUpperCase();
  const current = getActiveCafeCode(now, timezone);

  if (!current.isValid || !current.code) {
    return {
      valid: false,
      period: null,
      message: current.reason || 'No active Cafe Code at this time'
    };
  }

  if (normalized === current.code) {
    return {
      valid: true,
      period: current.period,
      message: `Code verified for Period ${current.period}`
    };
  }

  return {
    valid: false,
    period: current.period,
    message: 'Incorrect Cafe Code. Please check the code in Upper Cafe.'
  };
}

export function setManualCodeOverride(code: string, period: string, durationMinutes: number = 45): void {
  manualCodeOverride = {
    code: code.trim().toUpperCase(),
    period,
    expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000)
  };
}
