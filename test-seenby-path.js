/**
 * Test script to verify seenBy data is being written to the correct path
 * 
 * This script will:
 * 1. Create a test message
 * 2. Mark it as read
 * 3. Check where the seenBy data is written
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, push } = require('firebase/database');

// Your Firebase config
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function testSeenByPath() {
  try {
    console.log('🧪 Testing seenBy path...');
    
    const testThreadId = 'test-thread-' + Date.now();
    const testUserId = 'test-user-' + Date.now();
    
    // Create a test message
    console.log('📝 Creating test message...');
    const messageRef = ref(database, `messages/${testThreadId}`);
    const newMessageRef = push(messageRef);
    const messageId = newMessageRef.key;
    
    const testMessage = {
      id: messageId,
      senderId: testUserId,
      text: 'Test message for seenBy path verification',
      at: Date.now(),
      seenBy: {
        [testUserId]: true,
      },
    };
    
    await set(newMessageRef, testMessage);
    console.log(` Test message created: ${messageId}`);
    
    // Now test the markThreadAsRead function logic
    console.log('👀 Testing markThreadAsRead logic...');
    
    const messagesRef = ref(database, `messages/${testThreadId}`);
    const snapshot = await get(messagesRef);
    
    if (snapshot.exists()) {
      const updatePromises = [];
      
      snapshot.forEach((childSnapshot) => {
        const messageData = childSnapshot.val();
        if (messageData && messageData.seenBy && !messageData.seenBy[testUserId]) {
          const seenByRef = ref(database, `messages/${testThreadId}/${childSnapshot.key}/seenBy/${testUserId}`);
          updatePromises.push(set(seenByRef, true));
        }
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        console.log(' seenBy data updated using new logic');
      }
    }
    
    // Check where the seenBy data ended up
    console.log(' Checking database structure...');
    
    // Check root level
    const rootRef = ref(database);
    const rootSnapshot = await get(rootRef);
    const rootData = rootSnapshot.val();
    
    let foundAtRoot = false;
    for (const [key, value] of Object.entries(rootData)) {
      if (key === messageId && value && value.seenBy) {
        console.log(' ERROR: seenBy data found at root level!');
        console.log(`   Path: /${key}/seenBy/`);
        foundAtRoot = true;
      }
    }
    
    if (!foundAtRoot) {
      console.log(' No seenBy data found at root level');
    }
    
    // Check correct path
    const correctPathRef = ref(database, `messages/${testThreadId}/${messageId}/seenBy`);
    const correctPathSnapshot = await get(correctPathRef);
    
    if (correctPathSnapshot.exists()) {
      console.log(' seenBy data found at correct path!');
      console.log(`   Path: /messages/${testThreadId}/${messageId}/seenBy/`);
      console.log('   Data:', correctPathSnapshot.val());
    } else {
      console.log(' ERROR: seenBy data not found at correct path!');
    }
    
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await set(ref(database, `messages/${testThreadId}`), null);
    console.log(' Test data cleaned up');
    
  } catch (error) {
    console.error(' Test failed:', error);
  }
}

// Run the test
testSeenByPath();
