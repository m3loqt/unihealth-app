// Simple test script for Resend email service
// Run with: node test-email.js

// Load environment variables
require('dotenv').config();

const { Resend } = require('resend');

// Get API key from environment
const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY || '';
const FROM_EMAIL = process.env.EXPO_PUBLIC_FROM_EMAIL || 'noreply@unihealth.com';

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not found in environment variables');
  console.log('Please set EXPO_PUBLIC_RESEND_API_KEY in your .env file');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

async function testEmail() {
  try {
    console.log('📧 Testing Resend email service...');
    console.log('From:', FROM_EMAIL);
    console.log('API Key:', RESEND_API_KEY.substring(0, 10) + '...');
    
    // Test email - REPLACE WITH YOUR EMAIL FOR TESTING
    const testEmail = 'your-email@gmail.com'; // ⚠️ Replace this with your email
    
    if (testEmail === 'your-email@gmail.com') {
      console.log('\n⚠️  Please update the test email address in test-email.js');
      console.log('   Change "your-email@gmail.com" to your actual email address');
      return;
    }
    
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [testEmail],
      subject: 'UniHEALTH Email Service Test',
      html: `
        <h1>✅ Email Service Test Successful!</h1>
        <p>Your Resend email service is working correctly.</p>
        <p>Time: ${new Date().toISOString()}</p>
        <p>From: ${FROM_EMAIL}</p>
        <p>API Key: ${RESEND_API_KEY.substring(0, 10)}...</p>
      `,
      text: 'Email service test successful!'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Result:', result);
    console.log('\n📧 Check your email inbox (and spam folder) for the test email');
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 Make sure your API key is correct and starts with "re_"');
    } else if (error.message.includes('from')) {
      console.log('\n💡 Make sure your FROM_EMAIL is set correctly');
    } else if (error.message.includes('domain')) {
      console.log('\n💡 Try using your personal email as FROM_EMAIL for testing');
      console.log('   Example: EXPO_PUBLIC_FROM_EMAIL=your-email@gmail.com');
    }
  }
}

// Run the test
testEmail(); 