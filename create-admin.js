const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existingAdmin = await User.findOne({ 
      email: 'asterias.apartmentskoronisia@gmail.com'
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      return;
    }

    const adminData = {
      name: 'Asterias Admin',
      email: 'asterias.apartmentskoronisia@gmail.com',
      password: 'Asterias2025',
      role: 'ADMIN',
      phone: '+301237890',
      isActive: true
    };

    const admin = await User.createAdmin(adminData);
    console.log('✅ Admin created:', admin.email);
    console.log('Password: Asterias2024!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin(); 