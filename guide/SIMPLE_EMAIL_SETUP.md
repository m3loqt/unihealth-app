# 📧 Simple Email Setup with Resend

## Why Resend?

Resend is a modern email API that's much simpler to set up than SendGrid:

-  **Free Tier**: 3,000 emails/month free
-  **Simple Setup**: Just one API key
-  **No Domain Verification**: Works immediately
-  **Great Documentation**: Easy to understand
-  **Modern API**: Clean and simple

## 🚀 Quick Setup (5 minutes)

### 1. Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Click "Get Started"
3. Sign up with your email
4. Verify your email address

### 2. Get API Key

1. After signing in, you'll see your API key
2. Copy the API key (starts with `re_`)

### 3. Configure Environment

Add this to your `.env` file:

```env
# Resend Email Service (Simple Setup)
EXPO_PUBLIC_RESEND_API_KEY=re_your_api_key_here
EXPO_PUBLIC_FROM_EMAIL=noreply@yourdomain.com
```

### 4. Test It

That's it! Your email service is ready to use.

## 🧪 Testing

### Test with Real Email

1. Add your real email to the `.env` file:
```env
EXPO_PUBLIC_FROM_EMAIL=your-email@gmail.com
```

2. Test the password reset flow:
   - Go to forgot password
   - Enter your email
   - Check your inbox for the verification code

### Test in Development

```typescript
import { emailService } from '../src/services/email/emailService';

// Test the email service
const testEmail = async () => {
  try {
    await emailService.sendPasswordResetEmail({
      email: 'your-email@gmail.com',
      code: '123456',
      userName: 'Test User'
    });
    console.log(' Email sent successfully');
  } catch (error) {
    console.error(' Email failed:', error);
  }
};
```

## 🔧 Configuration Options

### Custom From Email

You can use any email address as the sender:

```env
EXPO_PUBLIC_FROM_EMAIL=noreply@yourdomain.com
# or
EXPO_PUBLIC_FROM_EMAIL=your-email@gmail.com
```

### Custom Email Template

Edit the email template in `src/services/email/emailService.ts`:

```typescript
private generatePasswordResetEmailHTML(code: string, userName?: string): string {
  // Customize the HTML template here
}
```

##  Resend Dashboard

Monitor your emails at [resend.com/dashboard](https://resend.com/dashboard):

- **Sent Emails**: Track delivery status
- **Analytics**: View open rates, click rates
- **Logs**: See detailed email logs
- **API Usage**: Monitor your usage

## 🚨 Troubleshooting

### Common Issues

**1. "Email service not configured"**
- Check if `EXPO_PUBLIC_RESEND_API_KEY` is set
- Verify the API key starts with `re_`

**2. "Failed to send email"**
- Check your internet connection
- Verify the API key is valid
- Check Resend dashboard for errors

**3. "Emails not received"**
- Check spam folder
- Verify the from email is correct
- Check Resend dashboard for delivery status

### Debug Mode

Enable debug logging:

```typescript
// In emailService.ts
console.log('Resend configuration:', {
  apiKey: RESEND_API_KEY ? 'Configured' : 'Missing',
  fromEmail: FROM_EMAIL
});
```

## 💰 Pricing

Resend has a generous free tier:

- **Free**: 3,000 emails/month
- **Pro**: $20/month for 50,000 emails
- **Enterprise**: Custom pricing

## 🔒 Security

### API Key Security

1. **Never commit API keys** to version control
2. Use environment variables
3. Rotate API keys if needed
4. Monitor usage in dashboard

### Email Security

1. **Use HTTPS** for all API calls
2. **Validate email addresses** before sending
3. **Monitor delivery rates** in dashboard
4. **Implement rate limiting** (already done in auth service)

## 📈 Production Deployment

### Environment Setup

1. **Production API Key**: Use the same API key (no separate production key needed)
2. **From Email**: Use your domain email (e.g., `noreply@yourdomain.com`)
3. **Monitoring**: Set up alerts in Resend dashboard

### Performance

- **Fast Delivery**: Resend has excellent delivery times
- **Global Infrastructure**: Emails sent from multiple regions
- **Automatic Retries**: Failed emails are retried automatically

## 🔄 Alternative Simple Options

If Resend doesn't work for you, here are other simple alternatives:

### 1. EmailJS (Client-side)
```bash
npm install @emailjs/browser
```
- **Pros**: No server setup needed
- **Cons**: API key exposed in client

### 2. Nodemailer with Gmail
```bash
npm install nodemailer
```
- **Pros**: Free with Gmail
- **Cons**: Requires app password setup

### 3. AWS SES (Simple)
```bash
npm install @aws-sdk/client-ses
```
- **Pros**: Very cheap ($0.10 per 1000 emails)
- **Cons**: Requires AWS account

## 📞 Support

- **Resend Support**: [resend.com/support](https://resend.com/support)
- **Documentation**: [resend.com/docs](https://resend.com/docs)
- **Community**: [resend.com/community](https://resend.com/community)

---

## 🎯 Why This is Better

Compared to SendGrid:

| Feature | SendGrid | Resend |
|---------|----------|--------|
| Setup Time | 30+ minutes | 5 minutes |
| Domain Verification | Required | Optional |
| Free Tier | 100 emails/day | 3,000 emails/month |
| API Complexity | Complex | Simple |
| Documentation | Good | Excellent |

**Resend is the perfect choice for simple, reliable email delivery!** 