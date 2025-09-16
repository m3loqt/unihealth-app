/**
 * Test date comparison logic used in specialist schedule matching
 */

describe('Date Comparison Logic', () => {
  it('should handle date comparisons consistently', () => {
    // Test case 1: Schedule valid from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const scheduleValidFrom = new Date();
    scheduleValidFrom.setHours(0, 0, 0, 0);
    
    expect(scheduleValidFrom <= today).toBe(true);
    expect(scheduleValidFrom > today).toBe(false);
    
    // Test case 2: Schedule valid from yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    expect(yesterday <= today).toBe(true);
    expect(yesterday > today).toBe(false);
    
    // Test case 3: Schedule valid from tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    expect(tomorrow <= today).toBe(false);
    expect(tomorrow > today).toBe(true);
  });

  it('should handle time component correctly', () => {
    // Test that time component doesn't affect date comparison
    const date1 = new Date('2024-01-15T10:30:00');
    const date2 = new Date('2024-01-15T14:45:00');
    
    // Reset time to start of day
    date1.setHours(0, 0, 0, 0);
    date2.setHours(0, 0, 0, 0);
    
    expect(date1.getTime()).toBe(date2.getTime());
    expect(date1 <= date2).toBe(true);
    expect(date1 >= date2).toBe(true);
  });

  it('should handle day of week calculation correctly', () => {
    // Test day of week calculation for different dates
    const testCases = [
      { date: '2024-01-07', expectedDay: 0 }, // Sunday
      { date: '2024-01-08', expectedDay: 1 }, // Monday
      { date: '2024-01-09', expectedDay: 2 }, // Tuesday
      { date: '2024-01-10', expectedDay: 3 }, // Wednesday
      { date: '2024-01-11', expectedDay: 4 }, // Thursday
      { date: '2024-01-12', expectedDay: 5 }, // Friday
      { date: '2024-01-13', expectedDay: 6 }, // Saturday
    ];

    testCases.forEach(({ date, expectedDay }) => {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      expect(dateObj.getDay()).toBe(expectedDay);
    });
  });
});
