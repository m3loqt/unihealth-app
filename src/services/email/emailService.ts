// Web-based email service for Expo Go compatibility
// Uses EmailJS REST API (works in React Native/Expo without browser SDK)

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface PasswordResetEmailData {
  email: string;
  code: string;
  userName?: string;
}

export interface WelcomeEmailData {
  email: string;
  userName: string;
}

class EmailService {
  private isConfigured: boolean;
  private apiKey: string; // generic API key (unused unless you wire a REST API)
  private fromEmail: string;

  // EmailJS configuration
  private emailJsServiceId: string;
  private emailJsTemplateId: string;
  private emailJsPublicKey: string;
  private proxyUrl?: string;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_EMAIL_API_KEY || '';
    this.fromEmail = process.env.EXPO_PUBLIC_FROM_EMAIL || 'noreply@unihealth.com';

    // EmailJS envs (Expo public) with safe production defaults provided by the user
    // Note: NEVER expose private keys in client apps. EmailJS only needs the public key on client.
    this.emailJsServiceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID || 'service_reset_password';
    this.emailJsTemplateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_nud0cea';
    this.emailJsPublicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY || 'MySmvhvtXYc3cMagj';
    this.proxyUrl = process.env.EXPO_PUBLIC_EMAIL_PROXY_URL;

    // Configured only if proxy is set OR EmailJS is fully wired
    this.isConfigured = Boolean(
      this.proxyUrl || (this.emailJsServiceId && this.emailJsTemplateId && this.emailJsPublicKey)
    );
    
    if (!this.isConfigured) {
      console.warn('⚠️ Email service is not fully configured. Set EXPO_PUBLIC_EMAILJS_* env vars.');
    }
  }

  async sendPasswordResetCode(email: string, code: string, userName?: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email service not configured');
    }

    // Prefer proxy (required for React Native/Expo)
    if (this.proxyUrl) {
      const res = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('Email proxy error:', res.status, t);
        throw new Error('Failed to send verification code');
      }
      return;
    }

    // Direct EmailJS REST call (works in React Native/Expo via fetch)
    // Ensure your EmailJS template expects these template_params keys
    const endpoint = 'https://api.emailjs.com/api/v1.0/email/send';
    const payload = {
      service_id: this.emailJsServiceId,
      template_id: this.emailJsTemplateId,
      user_id: this.emailJsPublicKey,
      template_params: {
        to_email: email,
        verification_code: code,
        user_name: userName || 'User',
        // Optional extras if your template uses them
        subject: 'UniHEALTH Password Reset Verification Code',
        app_name: 'UniHEALTH',
        from_email: this.fromEmail,
      },
    } as const;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('EmailJS error:', res.status, body);
      throw new Error('Failed to send verification code');
    }
    return;
  }

  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email service not configured');
    }

    // Prefer proxy (required for React Native/Expo)
    if (this.proxyUrl) {
      const res = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userName, type: 'welcome' })
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('Email proxy error:', res.status, t);
        throw new Error('Failed to send welcome email');
      }
      return;
    }

    // Direct EmailJS REST call for welcome email
    const endpoint = 'https://api.emailjs.com/api/v1.0/email/send';
    const payload = {
      service_id: this.emailJsServiceId,
      template_id: 'template_eund8ap', // Welcome email template ID
      user_id: this.emailJsPublicKey,
      template_params: {
        to_email: email,
        user_name: userName,
        email: email, // Include both to_email and email as the template might expect both
        subject: 'Welcome to UniHEALTH!',
        app_name: 'UniHEALTH',
        from_email: this.fromEmail,
      },
    } as const;

    console.log('📧 Welcome email payload:', JSON.stringify(payload, null, 2));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('EmailJS error:', res.status, body);
      console.error('EmailJS response body:', body);
      throw new Error(`Failed to send welcome email: ${res.status} - ${body}`);
    }
    
    console.log('✅ Welcome email sent successfully via EmailJS');
    return;
  }

  /**
   * Send a password reset verification code email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email service not configured. Please set EXPO_PUBLIC_EMAIL_API_KEY.');
    }

    const { email, code, userName } = data;
    
    try {
      // For now, we'll use a mock implementation that logs the email
      // In production, you would integrate with a real email service API
      console.log(`📧 Mock email sent to ${email}:`);
      console.log(`Subject: UniHEALTH Password Reset Verification Code`);
      console.log(`Code: ${code}`);
      console.log(`User: ${userName || 'Unknown'}`);
      
      // TODO: Replace with actual email service API call
      // Example with a hypothetical email service:
      /*
      const response = await fetch('https://api.emailservice.com/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: email,
          subject: 'UniHEALTH Password Reset Verification Code',
          html: this.generatePasswordResetEmailHTML(code, userName),
          text: this.generatePasswordResetEmailText(code, userName)
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      */
      
      console.log(`✅ Password reset email sent to ${email}`);
    } catch (error: any) {
      console.error('❌ Failed to send password reset email:', error);
      throw new Error('Failed to send verification code email. Please try again.');
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email service not configured');
    }
    // Implement REST email API here if needed in the future
    throw new Error('Direct email sending is not implemented. Use sendPasswordResetCode with EmailJS.');
  }

  /**
   * Generate HTML email template for password reset
   */
  private generatePasswordResetEmailHTML(code: string, userName?: string): string {
    const greeting = userName ? `Hello ${userName},` : 'Hello,';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Verification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 28px;
            font-weight: bold;
            color: #1E40AF;
            margin-bottom: 10px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #1F2937;
            margin-bottom: 20px;
          }
          .code-container {
            background-color: #F3F4F6;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .verification-code {
            font-size: 32px;
            font-weight: bold;
            color: #1E40AF;
            letter-spacing: 4px;
            font-family: 'Courier New', monospace;
          }
          .warning {
            background-color: #FEF3C7;
            border: 1px solid #F59E0B;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            color: #92400E;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #E5E7EB;
            color: #6B7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">UniHEALTH</div>
            <div class="title">Password Reset Verification</div>
          </div>
          
          <p>${greeting}</p>
          
          <p>We received a request to reset your password for your UniHEALTH account. To proceed with the password reset, please use the verification code below:</p>
          
          <div class="code-container">
            <div class="verification-code">${code}</div>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> This verification code will expire in 5 minutes for security reasons.
          </div>
          
          <p>If you did not request this password reset, please ignore this email. Your account security is important to us.</p>
          
          <p>If you're having trouble with the verification code, you can request a new one from the UniHEALTH app.</p>
          
          <div class="footer">
            <p>This is an automated message from UniHEALTH. Please do not reply to this email.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email for password reset
   */
  private generatePasswordResetEmailText(code: string, userName?: string): string {
    const greeting = userName ? `Hello ${userName},` : 'Hello,';
    
    return `
${greeting}

We received a request to reset your password for your UniHEALTH account. To proceed with the password reset, please use the verification code below:

VERIFICATION CODE: ${code}

IMPORTANT: This verification code will expire in 5 minutes for security reasons.

If you did not request this password reset, please ignore this email. Your account security is important to us.

If you're having trouble with the verification code, you can request a new one from the UniHEALTH app.

---
This is an automated message from UniHEALTH. Please do not reply to this email.
If you have any questions, please contact our support team.
    `.trim();
  }

  /**
   * Strip HTML tags from HTML content for plain text fallback
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Check if email service is properly configured
   */
  isEmailServiceReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export for testing
export { EmailService }; 