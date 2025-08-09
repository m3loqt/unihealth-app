import { database } from '../../config/firebase';
import { ref, set, get, remove, push } from 'firebase/database';

export interface ResetCode {
  id: string;
  email: string;
  code: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
  type: 'email' | 'sms';
}

export class PasswordResetService {
  private readonly RESET_CODES_REF = 'passwordResetCodes';

  /**
   * Generate a random 6-digit code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create a new password reset code
   */
  async createResetCode(email: string, type: 'email' | 'sms' = 'email'): Promise<string> {
    const code = this.generateCode();
    const now = Date.now();
    const expiresAt = now + (5 * 60 * 1000); // 5 minutes from now

    const resetCode: Omit<ResetCode, 'id'> = {
      email,
      code,
      expiresAt,
      used: false,
      createdAt: now,
      type
    };

    console.log('Creating reset code:', {
      email,
      code,
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
      timeUntilExpiry: Math.round((expiresAt - now) / 1000) + ' seconds',
      databasePath: this.RESET_CODES_REF
    });

    const newRef = push(ref(database, this.RESET_CODES_REF));
    console.log('Database reference path:', newRef.toString());
    await set(newRef, resetCode);

    return code;
  }

  /**
   * Verify a password reset code
   */
  async verifyResetCode(email: string, code: string): Promise<boolean> {
    // Debug: Show all codes first
    await this.debugAllCodes();
    
    const codesRef = ref(database, this.RESET_CODES_REF);
    console.log('Querying database path:', codesRef.toString());
    
    // Fetch all codes and filter in memory to avoid index requirement
    const snapshot = await get(codesRef);
    
    if (!snapshot.exists()) {
      console.log('No reset codes found in database');
      return false;
    }

    const codes: ResetCode[] = [];
    snapshot.forEach((childSnapshot) => {
      const codeData = childSnapshot.val();
      // Only process codes for the specific email
      if (codeData.email === email) {
        codes.push({
          id: childSnapshot.key!,
          ...codeData
        });
      }
    });

    console.log(`Found ${codes.length} codes for email: ${email}`);
    console.log('Available codes:', codes.map(c => ({ code: c.code, used: c.used, expiresAt: new Date(c.expiresAt), now: new Date() })));

    // Show current time for debugging
    const now = Date.now();
    console.log('Current timestamp:', now);
    console.log('Current time (ISO):', new Date(now).toISOString());

    // Find the matching code
    const matchingCode = codes.find(c => 
      c.code === code && 
      !c.used && 
      c.expiresAt > now
    );

    if (matchingCode) {
      console.log('Found matching code:', { 
        code: matchingCode.code, 
        expiresAt: new Date(matchingCode.expiresAt),
        timeUntilExpiry: Math.round((matchingCode.expiresAt - now) / 1000) + ' seconds'
      });
    } else {
      console.log('No matching code found. Looking for:', code);
      const expiredCodes = codes.filter(c => c.code === code && c.expiresAt <= now);
      const usedCodes = codes.filter(c => c.code === code && c.used);
      const wrongCodeCodes = codes.filter(c => c.code !== code);
      
      if (expiredCodes.length > 0) {
        console.log('Code found but expired:', {
          code: expiredCodes[0].code,
          expiresAt: new Date(expiredCodes[0].expiresAt),
          timeSinceExpiry: Math.round((now - expiredCodes[0].expiresAt) / 1000) + ' seconds'
        });
      }
      if (usedCodes.length > 0) {
        console.log('Code found but already used:', usedCodes[0]);
      }
      if (wrongCodeCodes.length > 0) {
        console.log('Other codes found for this email:', wrongCodeCodes.map(c => c.code));
      }
    }

    // Don't mark as used here - just verify it's valid
    // The code will be marked as used when resetPassword is called
    return !!matchingCode;
  }

  /**
   * Mark a reset code as used
   */
  async markCodeAsUsed(email: string, code: string): Promise<boolean> {
    const codesRef = ref(database, this.RESET_CODES_REF);
    
    // Fetch all codes and find the matching one
    const snapshot = await get(codesRef);
    
    if (!snapshot.exists()) {
      console.log('No codes found when trying to mark as used');
      return false;
    }

    let found = false;
    snapshot.forEach((childSnapshot) => {
      const codeData = childSnapshot.val();
      if (codeData.email === email && codeData.code === code && !codeData.used) {
        console.log('Marking code as used:', { email, code, id: childSnapshot.key });
        // Mark code as used - await the operation
        set(ref(database, `${this.RESET_CODES_REF}/${childSnapshot.key}/used`), true);
        found = true;
        return; // Exit forEach when found
      }
    });

    if (!found) {
      console.log('No matching unused code found to mark as used:', { email, code });
    }

    return found;
  }

  /**
   * Debug method to check all reset codes
   */
  async debugAllCodes(): Promise<void> {
    const codesRef = ref(database, this.RESET_CODES_REF);
    const snapshot = await get(codesRef);
    
    if (!snapshot.exists()) {
      console.log('No reset codes in database');
      return;
    }

    console.log('=== DEBUG: All Reset Codes ===');
    const now = Date.now();
    snapshot.forEach((childSnapshot) => {
      const codeData = childSnapshot.val();
      const expiresAt = new Date(codeData.expiresAt);
      const createdAt = new Date(codeData.createdAt);
      const isExpired = codeData.expiresAt < now;
      const timeUntilExpiry = Math.round((codeData.expiresAt - now) / 1000);
      
      console.log(`Code ${codeData.code} for ${codeData.email}:`, {
        id: childSnapshot.key,
        used: codeData.used,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isExpired,
        timeUntilExpiry: isExpired ? 'EXPIRED' : `${timeUntilExpiry}s`,
        type: codeData.type
      });
    });
    console.log('=== END DEBUG ===');
  }

  /**
   * Clean up expired codes
   */
  async cleanupExpiredCodes(): Promise<void> {
    const codesRef = ref(database, this.RESET_CODES_REF);
    const snapshot = await get(codesRef);
    
    if (!snapshot.exists()) {
      return;
    }

    const now = Date.now();
    const expiredCodes: string[] = [];

    snapshot.forEach((childSnapshot) => {
      const code = childSnapshot.val();
      if (code.expiresAt < now) {
        expiredCodes.push(childSnapshot.key!);
      }
    });

    // Remove expired codes
    for (const codeId of expiredCodes) {
      await remove(ref(database, `${this.RESET_CODES_REF}/${codeId}`));
    }
  }

  /**
   * Get active reset codes for an email
   */
  async getActiveCodes(email: string): Promise<ResetCode[]> {
    const codesRef = ref(database, this.RESET_CODES_REF);
    
    // Fetch all codes and filter in memory to avoid index requirement
    const snapshot = await get(codesRef);
    
    if (!snapshot.exists()) {
      return [];
    }

    const codes: ResetCode[] = [];
    const now = Date.now();

    snapshot.forEach((childSnapshot) => {
      const codeData = childSnapshot.val();
      // Only process codes for the specific email
      if (codeData.email === email && !codeData.used && codeData.expiresAt > now) {
        codes.push({
          id: childSnapshot.key!,
          ...codeData
        });
      }
    });

    return codes;
  }
}

export const passwordResetService = new PasswordResetService();
