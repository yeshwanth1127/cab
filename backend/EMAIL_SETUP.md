# Email Configuration Guide

## Overview

The system sends automatic email confirmations when bookings are created. Email is now **mandatory** for all bookings.

## Email Setup

### Option 1: Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Cab Booking System"
   - Copy the 16-character password

3. **Add to `.env` file:**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM_NAME=Cab Booking System
FRONTEND_URL=http://localhost:3000
```

### Option 2: SMTP (Generic Email Provider)

Add to `.env` file:
```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=your-email@domain.com
EMAIL_PASSWORD=your-password
EMAIL_FROM_NAME=Cab Booking System
FRONTEND_URL=http://localhost:3000
```

### Option 3: No Email (Development Only)

If you don't configure email, the system will:
- Still require email in the booking form
- Still save the email to the database
- Skip sending the email (logs a message)
- Continue working normally

## Common Email Providers

### Gmail
- SMTP_HOST: smtp.gmail.com
- SMTP_PORT: 587
- SMTP_SECURE: false
- Use App Password (not regular password)

### Outlook/Hotmail
- SMTP_HOST: smtp-mail.outlook.com
- SMTP_PORT: 587
- SMTP_SECURE: false

### Yahoo
- SMTP_HOST: smtp.mail.yahoo.com
- SMTP_PORT: 587
- SMTP_SECURE: false

### SendGrid
- SMTP_HOST: smtp.sendgrid.net
- SMTP_PORT: 587
- SMTP_SECURE: false
- EMAIL_USER: apikey
- EMAIL_PASSWORD: your-sendgrid-api-key

## Testing Email

1. Make a booking with a valid email
2. Check the backend console for email sending status
3. Check the recipient's inbox (and spam folder)

## Troubleshooting

**Email not sending?**
- Check `.env` file has correct credentials
- For Gmail: Make sure you're using App Password, not regular password
- Check SMTP port (587 for TLS, 465 for SSL)
- Check firewall/network allows SMTP connections
- Check backend console for error messages

**"Email service not configured" message?**
- This is normal if email is not set up
- Bookings will still work, just no email sent
- Configure email settings to enable emails

## Security Notes

- Never commit `.env` file to git
- Use App Passwords for Gmail (more secure)
- Consider using a dedicated email service (SendGrid, Mailgun) for production
- Rate limit email sending to prevent abuse

