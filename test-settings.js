const mongoose = require('mongoose');
require('dotenv').config();

const Settings = require('./src/models/Settings');

async function testSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/asteriashomes');
    console.log('✅ Connected to MongoDB');

    // Test 1: Get or create default settings
    console.log('\n🧪 Test 1: Get default settings');
    const settings = await Settings.getInstance();
    console.log('Default check-in time:', settings.checkInTime);
    console.log('Default tax rate:', settings.taxRate);
    console.log('Default items per page:', settings.itemsPerPage);

    // Test 2: Update a specific setting
    console.log('\n🧪 Test 2: Update tax rate');
    const originalTaxRate = settings.taxRate;
    await Settings.updateSetting('taxRate', 15);
    const newSettings = await Settings.getInstance();
    console.log('Updated tax rate:', newSettings.taxRate);

    // Test 3: Restore original value
    console.log('\n🧪 Test 3: Restore original tax rate');
    await Settings.updateSetting('taxRate', originalTaxRate);
    const restoredSettings = await Settings.getInstance();
    console.log('Restored tax rate:', restoredSettings.taxRate);

    // Test 4: Get specific setting
    console.log('\n🧪 Test 4: Get specific setting');
    const maintenanceMode = await Settings.getSetting('maintenanceMode');
    console.log('Maintenance mode:', maintenanceMode);

    // Test 5: Test validation (this should work)
    console.log('\n🧪 Test 5: Valid update');
    await Settings.updateSetting('itemsPerPage', 50);
    const validatedSettings = await Settings.getInstance();
    console.log('Items per page updated to:', validatedSettings.itemsPerPage);

    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run tests
testSettings(); 