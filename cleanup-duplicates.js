/**
 * Simple cleanup script to remove duplicate seenBy data from Firebase
 * 
 * This script removes message IDs that exist at the root level with only seenBy data
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove } = require('firebase/database');

// Your Firebase config - replace with your actual config
const firebaseConfig = {
  // Add your Firebase config here
  // You can get this from your Firebase console
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function cleanupDuplicates() {
  try {
    console.log('🔍 Scanning for duplicate seenBy data at root level...');
    
    const rootRef = ref(database);
    const snapshot = await get(rootRef);
    
    if (!snapshot.exists()) {
      console.log('❌ No data found');
      return;
    }
    
    const data = snapshot.val();
    const duplicatesToRemove = [];
    
    // Check each key at root level
    for (const [key, value] of Object.entries(data)) {
      // Skip known top-level nodes
      if (['messages', 'chatThreads', 'users', 'appointments', 'activity-logs', 'agreement'].includes(key)) {
        continue;
      }
      
      // Check if this looks like a message ID with only seenBy data
      if (value && typeof value === 'object' && value.seenBy && Object.keys(value).length === 1) {
        console.log(`🚨 Found duplicate: ${key}`);
        console.log(`   Data:`, value);
        duplicatesToRemove.push(key);
      }
    }
    
    if (duplicatesToRemove.length === 0) {
      console.log('✅ No duplicates found');
      return;
    }
    
    console.log(`\n🗑️  Removing ${duplicatesToRemove.length} duplicates...`);
    
    for (const key of duplicatesToRemove) {
      const duplicateRef = ref(database, key);
      await remove(duplicateRef);
      console.log(`   ✅ Removed: ${key}`);
    }
    
    console.log('\n🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run cleanup
cleanupDuplicates();
