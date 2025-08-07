import { Resend } from 'resend';

// Initialize Resend with API key
const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY || '';
const FROM_EMAIL = process.env.EXPO_PUBLIC_FROM_EMAIL || 'noreply@unihealth.com';

const resend = new Resend(RESEND_API_KEY);

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

class EmailService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!RESEND_API_KEY;
    if (!this.isConfigured) {
      console.warn('⚠️ Resend API key not configured. Email service will not work.');
    }
  }

  /**
   * Send a password reset verification code email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email service not configured. Please set RESEND_API_KEY.');
    }

    const { email, code, userName } = data;
    
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: 'UniHEALTH Password Reset Verification Code',
        html: this.generatePasswordResetEmailHTML(code, userName),
        text: this.generatePasswordResetEmailText(code, userName)
      });
      
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

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html)
      });
    } catch (error: any) {
      console.error('Resend error:', error);
      throw new Error('Failed to send email. Please try again later.');
    }
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