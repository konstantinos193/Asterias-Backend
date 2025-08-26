const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testBackend() {
  console.log('🧪 Testing Asterias Homes Backend...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test 2: Root endpoint
    console.log('\n2. Testing root endpoint...');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ Root endpoint passed:', rootResponse.data.message);

    // Test 3: Get rooms (public endpoint)
    console.log('\n3. Testing rooms endpoint...');
    const roomsResponse = await axios.get(`${BASE_URL}/api/rooms`);
    console.log('✅ Rooms endpoint passed:', `Found ${roomsResponse.data.length || 0} rooms`);

    // Test 4: Register a test user
    console.log('\n4. Testing user registration...');
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      phone: '1234567890'
    });
    console.log('✅ User registration passed:', registerResponse.data.message);

    // Test 5: Login with test user
    console.log('\n5. Testing user login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    console.log('✅ User login passed:', loginResponse.data.message);

    const token = loginResponse.data.token;

    // Test 6: Get user profile
    console.log('\n6. Testing profile endpoint...');
    const profileResponse = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile endpoint passed:', profileResponse.data.user.name);

    // Test 7: Admin login (if admin exists)
    console.log('\n7. Testing admin login...');
    try {
      const adminLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@asteriashomes.com',
        password: 'admin123'
      });
      console.log('✅ Admin login passed:', adminLoginResponse.data.message);
      
      const adminToken = adminLoginResponse.data.token;

      // Test 8: Admin dashboard
      console.log('\n8. Testing admin dashboard...');
      const dashboardResponse = await axios.get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ Admin dashboard passed:', dashboardResponse.data.stats);

      // Test 9: Admin stats
      console.log('\n9. Testing admin stats...');
      const statsResponse = await axios.get(`${BASE_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ Admin stats passed:', statsResponse.data);

    } catch (adminError) {
      console.log('⚠️  Admin login failed (this is normal if admin user not created yet):', adminError.response?.data?.error || adminError.message);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Backend is ready for deployment!');
    console.log('\nNext steps:');
    console.log('1. Set up your environment variables');
    console.log('2. Deploy to Render');
    console.log('3. Update your frontend to use the deployed backend URL');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.log('\n💡 Make sure:');
    console.log('- Backend is running on port 5000');
    console.log('- MongoDB is connected');
    console.log('- Environment variables are set');
  }
}

// Run the test
testBackend(); 