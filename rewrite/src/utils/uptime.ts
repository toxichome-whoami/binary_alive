export function parseUptimeToSeconds(str: string | null | undefined): number {
  if (!str || str === '---') return 0;
  let s = str.trim();
  let days = 0;
  let hours = 0;
  let mins = 0;
  let secs = 0;

  if (s.includes('-')) {
    const parts = s.split('-');
    days = parseInt(parts[0], 10) || 0;
    s = parts[1] || '';
  }

  const timeParts = s.split(':');
  if (timeParts.length === 3) {
    hours = parseInt(timeParts[0], 10) || 0;
    mins = parseInt(timeParts[1], 10) || 0;
    secs = parseInt(timeParts[2], 10) || 0;
  } else if (timeParts.length === 2) {
    mins = parseInt(timeParts[0], 10) || 0;
    secs = parseInt(timeParts[1], 10) || 0;
  }

  return days * 86400 + hours * 3600 + mins * 60 + secs;
}

export function formatSecondsToUptime(totalSecs: number): string {
  if (isNaN(totalSecs) || totalSecs <= 0) return '00:00:00';
  let secs = Math.floor(totalSecs);
  const days = Math.floor(secs / 86400);
  secs %= 86400;
  const hours = Math.floor(secs / 3600);
  secs %= 3600;
  const mins = Math.floor(secs / 60);
  secs %= 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = mins.toString().padStart(2, '0');
  const sStr = secs.toString().padStart(2, '0');

  if (days > 0) {
    return `${days}d ${hStr}:${mStr}:${sStr}`;
  }
  return `${hStr}:${mStr}:${sStr}`;
}
