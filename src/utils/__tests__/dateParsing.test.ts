/**
 * Test date parsing logic to ensure day of week calculation is correct
 */

describe('Date Parsing Logic', () => {
  it('should correctly parse date strings and calculate day of week', () => {
    // Test cases for different dates
    const testCases = [
      { dateString: '2025-09-21', expectedDay: 0, expectedDayName: 'Sunday' },
      { dateString: '2025-09-22', expectedDay: 1, expectedDayName: 'Monday' },
      { dateString: '2025-09-23', expectedDay: 2, expectedDayName: 'Tuesday' },
      { dateString: '2025-09-24', expectedDay: 3, expectedDayName: 'Wednesday' },
      { dateString: '2025-09-25', expectedDay: 4, expectedDayName: 'Thursday' },
      { dateString: '2025-09-26', expectedDay: 5, expectedDayName: 'Friday' },
      { dateString: '2025-09-27', expectedDay: 6, expectedDayName: 'Saturday' },
    ];

    testCases.forEach(({ dateString, expectedDay, expectedDayName }) => {
      // Parse date string the same way as in the component
      const [year, month, day] = dateString.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day); // month is 0-indexed
      dateObj.setHours(0, 0, 0, 0);
      const dayOfWeek = dateObj.getDay();
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      expect(dayOfWeek).toBe(expectedDay);
      expect(dayNames[dayOfWeek]).toBe(expectedDayName);
    });
  });

  it('should generate consistent date strings', () => {
    // Test the date generation logic
    const testDate = new Date(2025, 8, 22); // September 22, 2025 (Monday)
    testDate.setHours(0, 0, 0, 0);
    
    const year = testDate.getFullYear();
    const month = String(testDate.getMonth() + 1).padStart(2, '0');
    const day = String(testDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    expect(dateString).toBe('2025-09-22');
    expect(testDate.getDay()).toBe(1); // Monday
  });

  it('should handle date parsing consistently', () => {
    // Test that parsing a generated date string gives the same result
    const originalDate = new Date(2025, 8, 22); // September 22, 2025
    originalDate.setHours(0, 0, 0, 0);
    
    // Generate date string
    const year = originalDate.getFullYear();
    const month = String(originalDate.getMonth() + 1).padStart(2, '0');
    const day = String(originalDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    // Parse it back
    const [parsedYear, parsedMonth, parsedDay] = dateString.split('-').map(Number);
    const parsedDate = new Date(parsedYear, parsedMonth - 1, parsedDay);
    parsedDate.setHours(0, 0, 0, 0);
    
    expect(parsedDate.getDay()).toBe(originalDate.getDay());
    expect(parsedDate.getTime()).toBe(originalDate.getTime());
  });
});
