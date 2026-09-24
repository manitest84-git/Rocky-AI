/**
 * Dynamic greeting utility for Rocky AI.
 * Calculates time-of-day greeting (morning, afternoon, evening, night)
 * and formats a personalized, conversational message.
 */

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else if (hour >= 17 && hour < 22) {
    return 'Good evening';
  } else {
    return 'Greetings';
  }
}

export function getDynamicGreeting(username?: string): string {
  const timeGreeting = getTimeGreeting();
  const name = username ? (username.charAt(0).toUpperCase() + username.slice(1)) : 'there';
  return `${timeGreeting}, ${name}! I am Rocky. How can I assist you today?`;
}
