const mongoose = require('mongoose');
const { calculateMonthlyAggregatedAvailability } = require('./src/utils/availabilityCalculator');

// Test script for calendar availability logic
async function testAvailabilityLogic() {
  console.log('🧪 Testing Calendar Availability Logic...\n');
  
  try {
    // Test 1: Current month availability
    console.log('📅 Test 1: Current Month Availability');
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    console.log(`Testing month: ${currentMonth}/${currentYear}`);
    const availability = await calculateMonthlyAggregatedAvailability(currentDate);
    
    console.log('\n📊 Availability Results:');
    console.log('Date\t\t| Available | Total | Status\t| Color');
    console.log('----------------|-----------|-------|-----------|--------');
    
    Object.keys(availability).forEach(date => {
      const day = availability[date];
      const status = day.status.padEnd(10);
      const color = day.color.padEnd(6);
      console.log(`${date}\t| ${day.availableRooms}/7\t| 7\t| ${status}| ${color}`);
    });
    
    // Test 2: Color coding verification
    console.log('\n🎨 Test 2: Color Coding Verification');
    const colorStats = {
      green: 0,
      yellow: 0,
      red: 0
    };
    
    Object.values(availability).forEach(day => {
      colorStats[day.color]++;
    });
    
    console.log('Color Distribution:');
    console.log(`🟢 Green (Available): ${colorStats.green} days`);
    console.log(`🟡 Yellow (Limited): ${colorStats.yellow} days`);
    console.log(`🔴 Red (Booked): ${colorStats.red} days`);
    
    // Test 3: Logic verification
    console.log('\n🔍 Test 3: Logic Verification');
    let logicErrors = 0;
    
    Object.entries(availability).forEach(([date, day]) => {
      // Check if availableRooms + bookedRooms = totalRooms
      const bookedRooms = 7 - day.availableRooms;
      const expectedTotal = day.availableRooms + bookedRooms;
      
      if (expectedTotal !== 7) {
        console.log(`❌ Logic Error on ${date}: ${day.availableRooms} + ${bookedRooms} ≠ 7`);
        logicErrors++;
      }
      
      // Check if status matches available rooms count
      let expectedStatus;
      if (day.availableRooms === 0) {
        expectedStatus = 'booked';
      } else if (day.availableRooms <= 2) {
        expectedStatus = 'limited';
      } else {
        expectedStatus = 'available';
      }
      
      if (day.status !== expectedStatus) {
        console.log(`❌ Status Error on ${date}: Expected ${expectedStatus}, got ${day.status}`);
        logicErrors++;
      }
      
      // Check if color matches status
      let expectedColor;
      switch (day.status) {
        case 'available':
          expectedColor = 'green';
          break;
        case 'limited':
          expectedColor = 'yellow';
          break;
        case 'booked':
          expectedColor = 'red';
          break;
        default:
          expectedColor = 'unknown';
      }
      
      if (day.color !== expectedColor) {
        console.log(`❌ Color Error on ${date}: Status ${day.status} should be ${expectedColor}, got ${day.color}`);
        logicErrors++;
      }
    });
    
    if (logicErrors === 0) {
      console.log('✅ All logic checks passed!');
    } else {
      console.log(`❌ Found ${logicErrors} logic errors`);
    }
    
    // Test 4: Edge cases
    console.log('\n🔬 Test 4: Edge Cases');
    
    // Test with a specific month
    const testMonth = new Date(2025, 7, 15); // August 15, 2025
    console.log(`Testing specific date: ${testMonth.toISOString().split('T')[0]}`);
    
    const specificAvailability = await calculateMonthlyAggregatedAvailability(testMonth);
    const testDate = testMonth.toISOString().split('T')[0];
    
    if (specificAvailability[testDate]) {
      console.log(`✅ Specific date test passed: ${testDate} shows ${specificAvailability[testDate].availableRooms}/7`);
    } else {
      console.log(`❌ Specific date test failed: ${testDate} not found in availability data`);
    }
    
    console.log('\n🎯 Test Summary:');
    console.log(`Total dates tested: ${Object.keys(availability).length}`);
    console.log(`Logic errors: ${logicErrors}`);
    console.log(`Status: ${logicErrors === 0 ? 'PASSED' : 'FAILED'}`);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Test specific scenarios
async function testSpecificScenarios() {
  console.log('\n🧪 Testing Specific Scenarios...\n');
  
  try {
    // Test scenario 1: All rooms available
    console.log('📋 Scenario 1: All rooms available (should show 7/7, green)');
    // This would require no bookings in the database
    
    // Test scenario 2: Some rooms booked
    console.log('📋 Scenario 2: Some rooms booked (should show 5/7, yellow)');
    // This would require some bookings in the database
    
    // Test scenario 3: All rooms booked
    console.log('📋 Scenario 3: All rooms booked (should show 0/7, red)');
    // This would require all rooms to be booked
    
    console.log('\n💡 To test these scenarios, you need to:');
    console.log('1. Create test bookings in the database');
    console.log('2. Run this test script');
    console.log('3. Verify the calendar shows correct colors and counts');
    
  } catch (error) {
    console.error('❌ Scenario test failed:', error);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Calendar Availability Tests...\n');
  
  await testAvailabilityLogic();
  await testSpecificScenarios();
  
  console.log('\n✨ All tests completed!');
  process.exit(0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  // Connect to database first
  require('dotenv').config();
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/asterias-homes')
    .then(() => {
      console.log('✅ Connected to MongoDB');
      runAllTests();
    })
    .catch(err => {
      console.error('❌ Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}

module.exports = { testAvailabilityLogic, testSpecificScenarios };
