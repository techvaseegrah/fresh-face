// A helper function to format dates for `<input type="date">`
export function formatDateForInput(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      // Return a default or empty string if the date is invalid
      return '';
    }
    // The toISOString() format is 'YYYY-MM-DDTHH:mm:ss.sssZ'
    // We just need the 'YYYY-MM-DD' part.
    return date.toISOString().split('T')[0];
  }

  export const formatDuration = (minutes?: number | null): string => {
  if (minutes === null || minutes === undefined || minutes < 0) {
    return 'N/A';
  }
  if (minutes === 0) {
    return '0m';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  const hoursPart = hours > 0 ? `${hours}h` : '';
  const minutesPart = remainingMinutes > 0 ? `${remainingMinutes}m` : '';

  return `${hoursPart} ${minutesPart}`.trim();
};