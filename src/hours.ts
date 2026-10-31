/** Opening hours rows, as published: one weekday and its times in the owner's own words. */

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
export type Weekday = (typeof WEEKDAYS)[number]

export interface HoursRow {
  day: Weekday
  /** Exactly as published, e.g. "8am to 6:30pm" or "Closed". */
  times: string
}
