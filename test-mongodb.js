const mongoose = require('mongoose');

// Test MongoDB connection
async function testConnection() {
  try {
    console.log('🔍 Testing MongoDB connection...');
    
    // Updated connection string with correct cluster name
    const mongoURI = 'mongodb+srv://konstantinos193:Kk.25102002@cluster0.exjpezb.mongodb.net/asterias-homes?retryWrites=true&w=majority&appName=Cluster0';
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connection successful!');
    
    // Test creating a simple document
    const TestModel = mongoose.model('Test', new mongoose.Schema({ name: String }));
    await TestModel.create({ name: 'test' });
    console.log('✅ Database write test successful!');
    
    // Clean up
    await TestModel.deleteOne({ name: 'test' });
    console.log('✅ Database cleanup successful!');
    
    await mongoose.connection.close();
    console.log('✅ Connection closed successfully!');
    console.log('\n🎉 Your MongoDB connection is working!');
    console.log('\nNext steps:');
    console.log('1. Update your Render environment variables');
    console.log('2. Deploy your backend to Render');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n💡 Possible solutions:');
    console.log('1. Check if Network Access is set to "Allow from anywhere"');
    console.log('2. Verify your username and password are correct');
    console.log('3. Make sure your cluster is running');
    console.log('4. Check if the database user has the right permissions');
  }
}

testConnection(); 