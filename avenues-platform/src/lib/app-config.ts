export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME || 'MIL Analytics Dashboard';

export const DEFAULT_FACILITY_NAME =
  process.env.NEXT_PUBLIC_DEFAULT_FACILITY_NAME || 'Unknown Facility';


/**
 * Theatre availability used as the denominator for theatre utilisation %.
 * Default: 13,640 min/month (the previous hardcoded value). Override with
 * NEXT_PUBLIC_THEATRE_AVAILABLE_MINUTES to match theatre count / month length.
 */
export const THEATRE_AVAILABLE_MINUTES_PER_MONTH = Number(
  process.env.NEXT_PUBLIC_THEATRE_AVAILABLE_MINUTES || 13640
);
