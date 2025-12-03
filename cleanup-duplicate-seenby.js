/**
 * Script to clean up duplicate seenBy data from Firebase Realtime Database
 * 
 * This script removes the incorrectly placed seenBy data at the root level
 * and keeps only the properly nested seenBy data under messages/{threadId}/{messageId}/
 * 
 * Usage:
 * 1. Run this script in your Firebase project
 * 2. It will identify and remove duplicate seenBy entries at the root level
 * 3. The correct seenBy data under messages/ will be preserved
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove, child } = require('firebase/database');

// Your Firebase config
const firebaseConfig = {
  // Add your Firebase config here
  // You can get this from your Firebase console
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function cleanupDuplicateSeenBy() {
  try {
    console.log(' Scanning for duplicate seenBy data...');
    
    // Get the root reference
    const rootRef = ref(database);
    const snapshot = await get(rootRef);
    
    if (!snapshot.exists()) {
      console.log(' No data found in database');
      return;
    }
    
    const data = snapshot.val();
    const duplicatesToRemove = [];
    
    // Check each key at the root level
    for (const [key, value] of Object.entries(data)) {
      // Skip known top-level nodes
      if (['messages', 'chatThreads', 'users', 'appointments', 'activity-logs', 'agreement'].includes(key)) {
        continue;
      }
      
      // Check if this looks like a message ID with seenBy
      if (value && typeof value === 'object' && value.seenBy) {
        console.log(`🚨 Found duplicate seenBy at root level: ${key}`);
        console.log(`   seenBy data:`, value.seenBy);
        
        // Verify this is actually a duplicate by checking if it exists in messages
        const messageExists = await checkIfMessageExistsInMessages(key, data.messages);
        
        if (messageExists) {
          console.log(`    Confirmed duplicate - exists in messages/`);
          duplicatesToRemove.push(key);
        } else {
          console.log(`     Not found in messages/ - might be orphaned data`);
          duplicatesToRemove.push(key);
        }
      }
    }
    
    if (duplicatesToRemove.length === 0) {
      console.log(' No duplicate seenBy data found');
      return;
    }
    
    console.log(`\n🗑️  Found ${duplicatesToRemove.length} duplicate entries to remove:`);
    duplicatesToRemove.forEach(key => console.log(`   - ${key}`));
    
    // Remove the duplicates
    console.log('\n🧹 Removing duplicate entries...');
    for (const key of duplicatesToRemove) {
      const duplicateRef = child(rootRef, key);
      await remove(duplicateRef);
      console.log(`    Removed: ${key}`);
    }
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log(' All duplicate seenBy data has been removed');
    console.log(' Proper seenBy data under messages/ has been preserved');
    
  } catch (error) {
    console.error(' Error during cleanup:', error);
  }
}

async function checkIfMessageExistsInMessages(messageId, messagesData) {
  if (!messagesData) return false;
  
  // Search through all thread messages
  for (const [threadId, threadMessages] of Object.entries(messagesData)) {
    if (threadMessages && threadMessages[messageId]) {
      return true;
    }
  }
  
  return false;
}

// Run the cleanup
cleanupDuplicateSeenBy();
