/**
 * Helper function to extract chief complaint from appointment or referral data
 * Checks both additionalNotes field and chiefComplaint array field
 */
export function getChiefComplaint(data: any): string | null {
  // First, check if additionalNotes exists and contains data
  if (data?.additionalNotes && typeof data.additionalNotes === 'string' && data.additionalNotes.trim() !== '') {
    return data.additionalNotes;
  }
  
  // If additionalNotes is null/undefined/empty, check for chiefComplaint array
  if (data?.chiefComplaint && Array.isArray(data.chiefComplaint) && data.chiefComplaint.length > 0) {
    // Join array items with commas if there are multiple complaints
    return `Chief Complaint: ${data.chiefComplaint.join(', ')}`;
  }
  
  return null;
}

/**
 * Helper function to get display text for chief complaint with fallback
 */
export function getChiefComplaintDisplay(data: any, fallbackText: string = 'No additional notes'): string {
  const chiefComplaint = getChiefComplaint(data);
  return chiefComplaint || fallbackText;
}

