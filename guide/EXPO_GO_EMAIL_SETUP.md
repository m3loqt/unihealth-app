# 📧 Expo Go Email Setup Guide

## Overview

Since you're using Expo Go, we need to use web-based email services that are compatible with React Native. The previous Resend setup used Node.js libraries that don't work in Expo Go.

## Current Setup

The email service has been updated to work with Expo Go:

1. **Removed Node.js dependencies**: `resend`, `@google-cloud/speech`, `dotenv`, `install`, `npm`
2. **Updated email service**: Now uses a mock implementation that logs emails to console
3. **Ready for real API integration**: The service is structured to easily integrate with web-based email APIs

## Email Service Options for Expo Go

### Option 1: EmailJS (Recommended for Expo Go)

EmailJS is a client-side email service that works perfectly with Expo Go:

```bash
npm install @emailjs/browser
```

**Setup:**
1. Go to [emailjs.com](https://emailjs.com)
2. Create a free account
3. Set up an email service (Gmail, Outlook, etc.)
4. Create an email template
5. Get your public key and service ID

**Integration:**
```typescript
import emailjs from '@emailjs/browser';

// In your email service
const response = await emailjs.send(
  'YOUR_SERVICE_ID',
  'YOUR_TEMPLATE_ID',
  {
    to_email: email,
    verification_code: code,
    user_name: userName
  },
  'YOUR_PUBLIC_KEY'
);
```

### Option 2: Web-based Email API

Use any email service that provides a REST API:

```typescript
const response = await fetch('https://api.emailservice.com/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    from: 'noreply@unihealth.com',
    to: email,
    subject: 'Password Reset',
    html: emailHtml,
    text: emailText
  })
});
```

### Option 3: Backend Service

Create a simple backend service (Node.js/Express) that handles email sending:

```typescript
// Frontend (Expo Go)
const response = await fetch('https://your-backend.com/api/send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: email,
    code: code,
    type: 'password-reset'
  })
});
```

## Environment Variables

Update your environment variables:

```env
# Remove old Resend variables
# EXPO_PUBLIC_RESEND_API_KEY=re_your_key_here

# Add new email service variables
EXPO_PUBLIC_EMAIL_API_KEY=your_email_api_key_here
EXPO_PUBLIC_FROM_EMAIL=noreply@unihealth.com
```

## Current Mock Implementation

The current email service logs emails to the console for development:

```typescript
// This logs to console in development
console.log(`📧 Mock email sent to ${email}:`);
console.log(`Subject: UniHEALTH Password Reset Verification Code`);
console.log(`Code: ${code}`);
```

## Testing

1. **Start the app**: `npm start`
2. **Test password reset**: Go to forgot password screen
3. **Check console**: You'll see mock email logs
4. **Integrate real service**: Replace mock implementation with real API calls

## Benefits of This Approach

 **Expo Go Compatible**: No Node.js dependencies  
 **Web-based**: Uses standard fetch API  
 **Flexible**: Easy to switch between email services  
 **Development Friendly**: Mock implementation for testing  
 **Production Ready**: Easy to integrate real email services  

## Next Steps

1. Choose an email service (EmailJS recommended)
2. Update the email service implementation
3. Test with Expo Go
4. Deploy to production

## Troubleshooting

**Bundling Error Fixed**: The original error was caused by Node.js dependencies that don't work in Expo Go. Removing `resend`, `@google-cloud/speech`, `dotenv`, `install`, and `npm` packages resolved the issue.

**If you still see errors**: Make sure all Node.js-specific packages are removed from `package.json`.
