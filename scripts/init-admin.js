const dotenv = require('dotenv');
const connectDB = require('./config/database');
const User = require('./models/User');

// Load environment variables
dotenv.config();

const initializeAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🔍 Checking for existing admin user...');
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Username:', existingAdmin.username);
      console.log('🎭 Role:', existingAdmin.role);
      console.log('\n💡 You can use these credentials to log in to the admin panel.');
      process.exit(0);
    }
    
    console.log('🚀 Creating admin user...');
    
    // Create admin user
    const adminData = {
      username: process.env.ADMIN_USERNAME || 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@postman-mvp.local',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      profile: {
        firstName: process.env.ADMIN_FIRST_NAME || 'System',
        lastName: process.env.ADMIN_LAST_NAME || 'Administrator'
      }
    };
    
    const adminUser = await User.createAdmin(adminData);
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminUser.email);
    console.log('👤 Username:', adminUser.username);
    console.log('🎭 Role:', adminUser.role);
    console.log('🔑 Password:', adminData.password);
    console.log('\n🔐 Admin Login Credentials:');
    console.log('   Email/Username:', adminUser.email, 'or', adminUser.username);
    console.log('   Password:', adminData.password);
    console.log('\n⚠️  Please change the default password after first login!');
    console.log('💡 You can now start the server and access the admin panel.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    
    if (error.name === 'ValidationError') {
      console.error('📝 Validation errors:');
      Object.values(error.errors).forEach(err => {
        console.error('   -', err.message);
      });
    }
    
    if (error.code === 11000) {
      console.error('🔄 Admin user with this email or username might already exist.');
      console.error('💡 Try using different credentials in your .env file.');
    }
    
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Admin initialization cancelled.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Admin initialization terminated.');
  process.exit(0);
});

// Run initialization
console.log('🎯 PostWomen - Admin User Initialization');
console.log('==========================================\n');

initializeAdmin();