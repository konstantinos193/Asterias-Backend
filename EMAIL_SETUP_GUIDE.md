# Email Setup Guide for Asterias Homes

## 🔧 Gmail Configuration

### Option 1: App Password (RECOMMENDED - More Secure)

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com/
   - Use account: `asterias.apartmentskoronisia@gmail.com`

2. **Enable 2-Factor Authentication**
   - Click "Security" → "2-Step Verification"
   - Follow setup process (phone verification)

3. **Generate App Password**
   - Security → "App passwords"
   - Select "Mail" → "Other (custom name)" → "Asterias Backend"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Option 2: Regular Password (Simpler but Less Secure)

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com/
   - Use account: `asterias.apartmentskoronisia@gmail.com`

2. **Enable Less Secure App Access**
   - Security → "Less secure app access" → Turn ON
   - ⚠️ Note: Google may disable this periodically

3. **Use Regular Gmail Password**
   - No special setup needed
   - Use your normal Gmail login password

---

## ⚙️ Environment Variables Setup

### For Render Deployment

**Go to Render Dashboard → Your Backend Service → Environment**

#### Option 1: App Password
```
EMAIL_USER = asterias.apartmentskoronisia@gmail.com
EMAIL_APP_PASSWORD = [your-16-character-app-password]
```

#### Option 2: Regular Password  
```
EMAIL_USER = asterias.apartmentskoronisia@gmail.com
EMAIL_PASSWORD = [your-gmail-password]
```

#### Optional Fallback
```
ADMIN_EMAIL = asterias.apartmentskoronisia@gmail.com
```

### For Local Development

**Add to `backend/.env` file:**

#### Option 1: App Password
```bash
EMAIL_USER=asterias.apartmentskoronisia@gmail.com
EMAIL_APP_PASSWORD=abcd efgh ijkl mnop
ADMIN_EMAIL=asterias.apartmentskoronisia@gmail.com
```

#### Option 2: Regular Password
```bash
EMAIL_USER=asterias.apartmentskoronisia@gmail.com
EMAIL_PASSWORD=your-gmail-password
ADMIN_EMAIL=asterias.apartmentskoronisia@gmail.com
```

---

## 👥 Admin Email System Explained

### How It Works

1. **Primary**: System sends to ALL users in database with:
   - `role: "ADMIN"`
   - `preferences.notifications.email: true`

2. **Fallback**: If database fails or no admin users exist:
   - Uses `ADMIN_EMAIL` environment variable
   - Ensures you still get critical notifications

### Why ADMIN_EMAIL is Still Useful

✅ **Emergency Backup**: Database connection issues  
✅ **Initial Setup**: Before admin users are created  
✅ **Testing**: Verify email system works  
✅ **Redundancy**: Always have at least one notification path  

### Adding Admin Users

```bash
# MongoDB shell or admin interface
db.users.insertOne({
  name: "John Admin",
  email: "john@example.com",
  password: "hashed_password", // Use bcrypt
  role: "ADMIN",
  preferences: {
    notifications: {
      email: true,
      sms: false
    }
  }
});
```

---

## 🧪 Testing Your Setup

### Test 1: Basic Connection
```bash
cd backend
node -e "
const { initializeEmailTransporter } = require('./src/services/emailService');
initializeEmailTransporter();
console.log('✅ Email configured successfully!');
"
```

### Test 2: Admin Email Discovery
```bash
node test-admin-emails.js
```

### Test 3: Live Email Sending
1. Create a test booking
2. Check admin notifications toggle in settings
3. Verify emails are received

---

## 🔍 Troubleshooting

### Common Issues

#### "Invalid login: 535-5.7.8"
- ❌ Wrong password or app password
- ❌ 2FA not enabled (for app password)
- ❌ Less secure access disabled (for regular password)

#### No Admin Emails Received
- Check admin users in database: `db.users.find({role: "ADMIN"})`
- Verify email preferences: `preferences.notifications.email: true`
- Check fallback: `ADMIN_EMAIL` environment variable

#### Emails Send But Not Received
- Check spam/junk folder
- Verify email address spelling
- Test with different email address

### Support Commands

```bash
# Check admin users
db.users.find({ role: "ADMIN" }).pretty()

# Check email settings  
db.settings.findOne()

# Test email system
node test-admin-emails.js
```

---

## 🎯 Quick Setup Summary

**For most users (Render deployment):**

1. **Gmail**: Enable "Less secure app access"
2. **Render Environment**:
   ```
   EMAIL_USER = asterias.apartmentskoronisia@gmail.com
   EMAIL_PASSWORD = [your-gmail-password]
   ADMIN_EMAIL = asterias.apartmentskoronisia@gmail.com
   ```
3. **Test**: Create booking → Check email
4. **Done!** 🎉

The system will automatically send emails to all admin users, with ADMIN_EMAIL as a reliable fallback. 