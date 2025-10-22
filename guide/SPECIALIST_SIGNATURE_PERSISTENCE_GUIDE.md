# Specialist Signature Persistence Implementation Guide

## Overview

This implementation adds persistent signature management specifically for **specialists only**. Specialists can choose to save their signature to Firebase, which will then be automatically used for all future certificates and prescriptions, eliminating the need to sign every document.

## Key Features

### ✅ **For Specialists Only**
- Only specialist accounts get the signature save prompt
- Patient signatures remain temporary (session-based via AsyncStorage)

### ✅ **Save Prompt After Signing**
When a specialist signs a certificate, they see:
```
"Would you like to save this signature for future certificates and prescriptions?"
[Not Now]  [Save]
```

### ✅ **Persistent Storage in Firebase**
Saved signatures are stored in:
- `doctors/{doctorId}/signature` - Base64 signature data
- `doctors/{doctorId}/isSignatureSaved` - Boolean flag (true/false)

### ✅ **Automatic Signature Application**
- If `isSignatureSaved === true`, skip signature page entirely
- Automatically apply saved signature to new certificates
- Specialists never need to sign again once saved

### ✅ **Signature Always Inserted**
- Whether saved or not, signature is ALWAYS inserted into the document
- "Save" choice only affects future automatic use

## Implementation Details

### 1. **Database Schema Updates**

#### Doctor Interface (firebase.ts & auth.ts)
```typescript
export interface Doctor {
  // ... existing fields
  signature?: string; // Base64 signature data
  isSignatureSaved?: boolean; // Whether signature is saved for future use
}

export interface DoctorNode {
  // ... existing fields  
  signature?: string; // Base64 signature data
  isSignatureSaved?: boolean; // Whether signature is saved for future use
}
```

### 2. **Database Functions**

#### Save Doctor Signature
```typescript
async saveDoctorSignature(doctorId: string, signature: string): Promise<void>
```
- Saves signature to `doctors/{doctorId}/signature`
- Sets `isSignatureSaved = true`

#### Get Doctor Signature
```typescript
async getDoctorSignature(doctorId: string): Promise<{ signature: string | null; isSignatureSaved: boolean }>
```
- Retrieves signature and save status
- Returns `{ signature: null, isSignatureSaved: false }` if not saved

#### Clear Doctor Signature
```typescript
async clearDoctorSignature(doctorId: string): Promise<void>
```
- Clears signature
- Sets `isSignatureSaved = false`

### 3. **Signature Page Updates**

#### Save Prompt for Specialists (`app/(patient)/signature-page.tsx`)

**Session-based Signature Tracking:**
- Uses local state (`hasDrawnSignature` and `currentSessionSignature`) to track signatures drawn in current session
- Clears any previous signature on mount for fresh start
- No visual status indicator to avoid interrupting multi-stroke signatures
- Validation occurs when user clicks "Done" button

When specialist clicks "Done" on signature page:
1. **Validate signature exists**:
   - Checks `hasDrawnSignature` flag (must be drawn in current session)
   - If no signature: Show alert "Please provide your signature before continuing"
   - If signature exists: Continue to step 2
2. Show dialog: "Would you like to save this signature for future certificates and prescriptions?"
3. **If "Cancel"**: 
   - Stay on signature page
   - Can modify signature and try again
4. **If "Not Now"**:
   - Only save to AsyncStorage for immediate use
   - Insert signature into current document
   - Next time, specialist will be asked to sign again
5. **If "Save"**: 
   - Save to Firebase: `databaseService.saveDoctorSignature(doctorId, signature)`
   - Save to AsyncStorage for immediate use
   - Insert signature into current document

#### Code Flow
```typescript
const showSavePromptForSpecialist = (currentSignature: string) => {
  Alert.alert(
    'Save Signature',
    'Would you like to save this signature for future certificates and prescriptions?',
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          // Stay on signature page, do nothing
        }
      },
      {
        text: 'Not Now',
        onPress: () => proceedWithSignature(currentSignature, false)
      },
      {
        text: 'Save',
        onPress: () => proceedWithSignature(currentSignature, true)
      }
    ],
    { cancelable: true }
  );
};
```

### 4. **Auto-Sign Flow**

#### Certificate Creation (`app/(specialist)/tabs/certificates.tsx`)

Before navigating to signature page:
1. Check if doctor has saved signature: `getDoctorSignature(doctorId)`
2. **If `isSignatureSaved === true`**:
   - Skip signature page
   - Auto-apply saved signature to certificate
   - Save certificate directly to database
   - Show success message
   - Refresh certificates list
3. **If `isSignatureSaved === false`**:
   - Navigate to signature page as normal
   - Specialist will be prompted to sign

#### Code Flow
```typescript
const handleContinueToSignature = async () => {
  // ... build certificateData
  
  try {
    const { signature: savedSignature, isSignatureSaved } = 
      await databaseService.getDoctorSignature(user.uid);
    
    if (isSignatureSaved && savedSignature) {
      // Auto-sign and save certificate
      const updatedCertificateData = {
        ...certificateData,
        digitalSignature: savedSignature,
        signatureKey: `signature_${Date.now()}`,
        signedAt: new Date().toISOString(),
      };
      
      await databaseService.createCertificateInNewStructure(
        updatedCertificateData,
        selectedPatient.id,
        user.uid
      );
      
      // Success!
      Alert.alert('Certificate Issued Successfully', 
        'Your certificate has been created and signed automatically using your saved signature.');
      await loadCertificates();
      return;
    }
    
    // No saved signature, show signature page
    router.push({ pathname: '/(patient)/signature-page', ... });
  } catch (error) {
    // On error, default to showing signature page
    router.push({ pathname: '/(patient)/signature-page', ... });
  }
};
```

## User Experience Flow

### First Time Signing (Specialist)

1. Specialist creates a certificate
2. Fills in all certificate details
3. Clicks "Continue to Signature"
4. Navigates to signature page (landscape mode)
5. Draws signature
6. Clicks "Done" button
7. **VALIDATION**: System checks if signature was drawn
   - If NO signature: Alert "Please provide your signature before continuing"
   - If YES signature: Continue to step 8
8. **PROMPT APPEARS**: "Would you like to save this signature for future certificates and prescriptions?"
9. **Choice 1: "Cancel"**
   - Returns to signature page
   - Can modify signature or click "Done" again
10. **Choice 2: "Not Now"**
    - Signature applied to current certificate only
    - Next certificate will require signing again
    - Process repeats until they choose "Save"
11. **Choice 3: "Save"**
    - Signature saved to Firebase
    - Signature applied to current certificate
    - All future certificates auto-signed

### Subsequent Certificates (After Saving)

1. Specialist creates a certificate
2. Fills in all certificate details
3. Clicks "Continue to Signature"
4. **No signature page shown!**
5. Certificate automatically signed with saved signature
6. Certificate saved to database
7. Success message: "Your certificate has been created and signed automatically using your saved signature."

### Subsequent Certificates (If Not Saved)

1. Specialist creates a certificate
2. Fills in all certificate details
3. Clicks "Continue to Signature"
4. Navigates to signature page
5. Draws signature
6. Clicks "Done" button
7. **PROMPT APPEARS AGAIN**: "Would you like to save this signature for future certificates and prescriptions?"
8. Process repeats until they choose "Save" in the prompt

## Important Notes

### Prescriptions Don't Require Signatures
- Prescriptions are auto-saved during consultations
- Only certificates require signatures
- This is by design (see `patient-consultation.tsx` line 1664)

### Patients Don't Get This Feature
- Patient signatures remain temporary (AsyncStorage only)
- No Firebase persistence for patients
- No save prompt for patients

### Error Handling
- If Firebase check fails, default to showing signature page
- Fail-safe approach prevents blocking legitimate certificate creation
- Errors logged to console for debugging

### Storage Locations

#### For Specialists (Firebase):
- `doctors/{doctorId}/signature` - Persistent signature
- `doctors/{doctorId}/isSignatureSaved` - Save flag

#### For Immediate Use (AsyncStorage):
- `current_signature` - Active signature for current session
- `latest_signature` - Most recent signature
- `signature_history` - Last 10 signatures

## Testing Checklist

### Specialist - Validation
- [ ] Create certificate as specialist
- [ ] Navigate to signature page
- [ ] Click "Done" button WITHOUT drawing signature
- [ ] Verify alert: "Please provide your signature before continuing"
- [ ] Click "OK" and remain on signature page

### Specialist - First Time with Cancel
- [ ] Create certificate as specialist
- [ ] Draw signature and click "Done" button
- [ ] Verify prompt appears with 3 options: "Cancel", "Not Now", "Save"
- [ ] Click "Cancel"
- [ ] Verify you stay on signature page (can modify signature)
- [ ] Click "Done" again
- [ ] Click "Not Now" this time
- [ ] Verify signature inserted in certificate
- [ ] Create another certificate
- [ ] Verify signature page shows again (because not saved)

### Specialist - Save Signature
- [ ] Create certificate as specialist
- [ ] Draw signature and click "Done" button
- [ ] Verify prompt appears with 3 options
- [ ] Click "Save" in the prompt
- [ ] Verify signature inserted in certificate
- [ ] Verify success message
- [ ] Create another certificate
- [ ] **Verify signature page does NOT show**
- [ ] Verify certificate created with signature automatically
- [ ] Verify success message: "...signed automatically using your saved signature"

### Specialist - Firebase Verification
- [ ] Check Firebase console: `doctors/{doctorId}/signature` exists
- [ ] Check Firebase console: `doctors/{doctorId}/isSignatureSaved === true`
- [ ] Verify signature is base64 encoded image data

### Patient - No Changes
- [ ] Create certificate as patient (via specialist)
- [ ] Verify normal flow (no save prompt)
- [ ] Verify signature only for current session

## Troubleshooting

### Issue: Signature not auto-applying
**Check:**
1. Is `isSignatureSaved === true` in Firebase?
2. Does `signature` field exist in Firebase doctors node?
3. Check console logs for signature retrieval errors

### Issue: Prompt not showing for specialists
**Check:**
1. Is `fromSpecialist === 'true'` in signature page params?
2. Check signature-page.tsx: prompt logic in `handleSaveSignature()` function
3. Verify "Done" button is triggering `handleSaveSignature()` correctly
4. Check console logs for `hasDrawnSignature` status

### Issue: "Signature captured" shows immediately on page load
**Fixed:** The signature page now clears any previous signature on mount and uses session-based tracking (`hasDrawnSignature` state) to only show the status after the user actually draws in the current session.

### Issue: Signature page still showing after save
**Check:**
1. Verify Firebase write succeeded
2. Check `isSignatureSaved` flag in Firebase
3. Check console logs in handleContinueToSignature

## Future Enhancements (On Hold)

These features are currently on hold as per requirements:

### Update Saved Signature
- Allow specialists to update their saved signature
- Add "Change Signature" option in profile settings
- Clear old signature and prompt for new one

### View Saved Signature
- Show preview of saved signature in profile
- Display last updated date

### Signature Analytics
- Track signature usage
- Monitor save vs not-save choices
- Usage statistics

## Files Modified

1. **src/services/database/firebase.ts**
   - Added `signature` and `isSignatureSaved` to Doctor interface
   - Added `saveDoctorSignature()` function
   - Added `getDoctorSignature()` function
   - Added `clearDoctorSignature()` function

2. **src/types/auth.ts**
   - Added `signature` and `isSignatureSaved` to DoctorNode interface

3. **app/(patient)/signature-page.tsx**
   - Added `showSavePromptForSpecialist()` function
   - Added `proceedWithSignature()` function
   - Modified `handleSaveSignature()` to show prompt for specialists

4. **app/(specialist)/tabs/certificates.tsx**
   - Modified `handleContinueToSignature()` to check for saved signature
   - Added auto-sign logic when signature is saved
   - Added success messages for auto-signed certificates

## Summary

This implementation provides a seamless signature experience for specialists:
- **First time**: Sign and choose whether to save
- **After saving**: Never sign again - automatic
- **If not saved**: Keep asking until they save

The implementation is fail-safe, specialist-only, and ensures signatures are ALWAYS inserted in documents regardless of the save choice.

