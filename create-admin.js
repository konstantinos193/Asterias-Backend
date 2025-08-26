const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const existingAdmin = await User.findOne({ 
      username: 'admin'
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      return;
    }

    const adminData = {
      name: 'Asterias Admin',
      username: 'admin',
      email: 'asterias.apartmentskoronisia@gmail.com',
      password: 'admin1',
      role: 'ADMIN',
      phone: '+301237890',
      isActive: true
    };

    const admin = await User.createAdmin(adminData);
    console.log('✅ Admin created:', admin.username);
    console.log('Username: admin');
    console.log('Password: admin1');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin(); 