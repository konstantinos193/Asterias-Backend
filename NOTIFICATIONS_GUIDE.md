# 📧 Notification System Guide

Your apartment booking system now has a complete notification system that automatically sends emails based on the settings you configure in the admin panel.

## 🚀 What It Does

### **For Customers** 
- ✅ **Booking Confirmations** - Automatic email when booking is made
- ✅ **Arrival Reminders** - Email reminder 24 hours before check-in (configurable)

### **For You (Admin)**
- ✅ **New Booking Alerts** - Instant notification when someone books
- ✅ **Low Inventory Alerts** - Warning when availability is low
- ✅ **Real-time Dashboard** - All notifications controlled from admin settings

## 📋 Setup Guide

### **1. Gmail Setup (Recommended)**
You need a Gmail account to send emails:

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Enable **2-Factor Authentication** (required)
3. Go to **Security** → **App passwords**
4. Generate app password for "Mail"
5. Copy the 16-digit password

### **2. Environment Configuration**
Add these to your `.env` file:

```bash
# Your Gmail account
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-16-digit-app-password

# Where admin notifications go
ADMIN_EMAIL=admin@asteriashome.gr

# Your website URL (for email links)
FRONTEND_URL=https://asteriashome.gr
```

### **3. Install Dependencies**
```bash
cd backend
npm install node-cron nodemailer
```

### **4. Test the System**
```bash
cd backend
node test-notifications.js
```

## ⚙️ Admin Settings Control

Go to **Admin Panel → Settings → Notifications** to control:

### **📧 General Notifications**
- **Email notifications** - Master switch (turns off all emails)
- **New booking alerts** - Notify admin of new bookings  
- **Low inventory alerts** - Warn when rooms are almost full

### **👥 Customer Notifications**
- **Booking confirmations** - Send confirmation emails to customers
- **Arrival reminders** - Send reminder emails before check-in
- **Reminder timing** - How many hours before arrival (default: 24)

## 🔄 How It Works

### **When Someone Books an Apartment:**
1. Customer completes booking on website
2. System saves booking to database
3. **Immediately sends:**
   - Confirmation email to customer (if enabled)
   - New booking alert to admin (if enabled)

### **Before Customer Arrives:**
1. Scheduled task runs every hour
2. Checks for bookings arriving tomorrow (or configured time)
3. Sends reminder email to customers (if enabled)
4. Marks reminder as sent (won't send duplicates)

### **Low Inventory Monitoring:**
1. System checks availability twice daily (9 AM & 6 PM)
2. If less than 20% of apartments available for next 7 days
3. Sends alert to admin email

## 📨 Email Templates

The system includes professional Greek email templates:

### **Customer Booking Confirmation**
- Booking details (room, dates, price)
- Check-in/out information
- Contact details
- Arrival instructions

### **Customer Arrival Reminder**
- Reminder it's tomorrow
- Check-in time and location
- Contact phone number
- Key pickup instructions

### **Admin New Booking Alert**
- Customer details
- Booking information
- Link to view in admin panel
- Immediate notification

### **Admin Low Inventory Alert**
- Date with low availability
- Room-by-room breakdown
- Total availability percentage
- Link to bookings dashboard

## 🕐 Scheduled Tasks

The system runs these automatically:

| Task | Schedule | Purpose |
|------|----------|---------|
| Arrival Reminders | Every hour | Send reminders for tomorrow's arrivals |
| Inventory Check | 9 AM & 6 PM daily | Monitor low availability |
| Cleanup | Midnight daily | Remove old notification flags |

## 🧪 Testing

### **Test Individual Features:**
```bash
# Test basic email sending
node test-notifications.js

# Test reminder checking (manual trigger)
# In your backend code:
const { triggerReminderCheck } = require('./src/services/scheduledTasks');
await triggerReminderCheck();

# Test inventory monitoring
const { triggerInventoryCheck } = require('./src/services/scheduledTasks');
await triggerInventoryCheck();
```

### **Test Real Booking Flow:**
1. Make a test booking on your website
2. Check customer gets confirmation email
3. Check admin gets new booking alert
4. Set reminder to 1 hour before check-in
5. Wait and see if reminder is sent

## 🔧 Customization

### **Change Email Templates:**
Edit `backend/src/services/emailService.js` → `emailTemplates` object

### **Change Timing:**
Edit `backend/src/services/scheduledTasks.js` → cron schedules:
- `'0 * * * *'` = every hour
- `'0 9,18 * * *'` = 9 AM and 6 PM daily
- `'0 0 * * *'` = midnight daily

### **Change Low Inventory Threshold:**
In `emailService.js` → `checkLowInventory()` function:
```javascript
if (availabilityPercentage <= 20) { // Change 20 to your preferred %
```

## 🚨 Troubleshooting

### **"Email not configured" Error:**
- Check `.env` file has `EMAIL_USER` and `EMAIL_APP_PASSWORD`
- Verify Gmail app password is 16 digits (no spaces)
- Make sure 2FA is enabled on Gmail account

### **"Email notifications disabled" in logs:**
- Go to Admin → Settings → Notifications
- Turn on "Email notifications" master switch
- Turn on specific notification types you want

### **Emails not sending:**
- Check server logs for error details
- Verify Gmail account is not blocked
- Try the test script: `node test-notifications.js`

### **Reminders not sending:**
- Check "Reminder notifications" is enabled in settings
- Verify bookings have `bookingStatus: 'CONFIRMED'`
- Check reminder timing (default 24 hours before)

### **Admin alerts not working:**
- Verify `ADMIN_EMAIL` is set in `.env`
- Check "New booking alerts" is enabled
- Make sure booking creation includes admin notification call

## 📊 Monitoring

Check your server logs for notification activity:
```bash
# Look for these log messages:
✅ Email sent successfully
❌ Failed to send email
🔔 Checking for arrival reminders
📊 Checking upcoming inventory levels
📧 Sending notifications for booking...
```

## 🎯 Business Benefits

### **Customer Experience:**
- Professional automated confirmations
- Helpful arrival reminders
- No missed check-ins
- Clear booking details

### **Operations:**
- Instant notification of new bookings
- Advance warning of capacity issues
- Automated customer communication
- Reduced manual email work

### **Settings Control:**
- Turn notifications on/off without code changes
- Adjust reminder timing for your operation
- Control which notifications are sent
- Professional branded emails

---

## 🔥 Your Notification System is Live!

Every booking now automatically triggers the right notifications. Your customers get professional confirmations and reminders, while you get instant alerts about new business and potential capacity issues.

**No more manual emails. No more missed notifications. Just smooth, automated apartment rental operations.** 🏠✨ 