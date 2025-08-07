# 📧 Email Service Setup Guide

## ⚠️ This guide has been updated!

We've switched to **Resend** for a much simpler email setup experience.

## 🚀 New Simple Setup Guide

**Please use the new setup guide: [SIMPLE_EMAIL_SETUP.md](./SIMPLE_EMAIL_SETUP.md)**

## Why the change?

- ✅ **5-minute setup** instead of 30+ minutes
- ✅ **No domain verification** required
- ✅ **3,000 emails/month free** instead of 100/day
- ✅ **Simpler API** with better documentation
- ✅ **Works immediately** without complex configuration

## Quick Migration

If you were using SendGrid, simply:

1. **Uninstall SendGrid**: `npm uninstall @sendgrid/mail`
2. **Install Resend**: `npm install resend`
3. **Update environment variables**:
   ```env
   # Old (SendGrid)
   # EXPO_PUBLIC_SENDGRID_API_KEY=SG.your_key_here
   
   # New (Resend)
   EXPO_PUBLIC_RESEND_API_KEY=re_your_key_here
   EXPO_PUBLIC_FROM_EMAIL=noreply@yourdomain.com
   ```

4. **Follow the new guide**: [SIMPLE_EMAIL_SETUP.md](./SIMPLE_EMAIL_SETUP.md)

---

**The new Resend setup is much simpler and more reliable!** 