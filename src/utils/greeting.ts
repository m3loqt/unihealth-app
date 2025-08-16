/**
 * Get the appropriate greeting based on the current time of day
 * @returns {string} The greeting (Good Morning, Good Afternoon, Good Evening, or Good Night)
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  
  // Morning: 5 AM to 11:59 AM
  if (hour >= 5 && hour < 12) {
    return 'Good morning,';
  } 
  // Afternoon: 12 PM to 4:59 PM
  else if (hour >= 12 && hour < 17) {
    return 'Good afternoon,';
  } 
  // Evening: 5 PM to 8:59 PM
  else if (hour >= 17 && hour < 21) {
    return 'Good evening,';
  } 
  // Night: 9 PM to 4:59 AM
  else {
    return 'Good night,';
  }
} 