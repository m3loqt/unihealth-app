// Example of how the earnings calculation works with fee history

export interface FeeHistoryEntry {
  fee: number;
  effectiveDate: string;
  status: 'active' | 'inactive';
}

export interface Consultation {
  id: string;
  completionDate: string;
  type: 'appointment' | 'referral';
}

// Example data
const feeHistory: FeeHistoryEntry[] = [
  {
    fee: 500,
    effectiveDate: '2024-01-01T00:00:00.000Z',
    status: 'inactive'
  },
  {
    fee: 800,
    effectiveDate: '2024-02-15T00:00:00.000Z',
    status: 'inactive'
  },
  {
    fee: 1000,
    effectiveDate: '2024-03-01T00:00:00.000Z',
    status: 'active'
  }
];

const consultations: Consultation[] = [
  {
    id: '1',
    completionDate: '2024-01-20T00:00:00.000Z',
    type: 'appointment'
  },
  {
    id: '2',
    completionDate: '2024-02-20T00:00:00.000Z',
    type: 'referral'
  },
  {
    id: '3',
    completionDate: '2024-03-10T00:00:00.000Z',
    type: 'appointment'
  }
];

// Function to get active fee at a specific date
function getActiveFeeAtDate(feeHistory: FeeHistoryEntry[], targetDate: string): number {
  const sortedHistory = [...feeHistory].sort((a, b) => 
    new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
  );
  
  const targetDateTime = new Date(targetDate).getTime();
  
  for (const entry of sortedHistory) {
    const entryDateTime = new Date(entry.effectiveDate).getTime();
    if (entryDateTime <= targetDateTime && entry.status === 'active') {
      return entry.fee;
    }
  }
  
  return sortedHistory[sortedHistory.length - 1]?.fee || 0;
}

// Calculate earnings
function calculateEarnings() {
  let totalEarnings = 0;
  
  for (const consultation of consultations) {
    const feeAtTime = getActiveFeeAtDate(feeHistory, consultation.completionDate);
    totalEarnings += feeAtTime;
    
    console.log(`Consultation ${consultation.id} (${consultation.type}):`, {
      completionDate: consultation.completionDate,
      feeAtTime,
      earnings: feeAtTime
    });
  }
  
  return totalEarnings;
}

// Example usage
const totalEarnings = calculateEarnings();
console.log('Total Earnings:', totalEarnings); // Should be 500 + 800 + 1000 = 2300

export { calculateEarnings, getActiveFeeAtDate };

