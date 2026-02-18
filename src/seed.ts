import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserModel } from './models/user.model';
import { ConfigService } from '@nestjs/config';

async function seedSuperAdmin() {
  console.log('🌱 Starting database seeding...');
  
  // Create a minimal NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'], // Only show errors and warnings during seeding
  });

  try {
    // Get the User model directly from Mongoose
    const userModel = app.get<any>('UserModel');
    const configService = app.get(ConfigService);

    // Check if superadmin already exists
    const existingAdmin = await userModel.findByEmail('admin@asteriashome.gr');
    if (existingAdmin) {
      console.log('✅ Superadmin user already exists');
      await app.close();
      return;
    }

    // Create superadmin user
    const superAdminData = {
      name: 'Super Admin',
      username: 'superadmin',
      email: 'admin@asteriashome.gr',
      password: 'admin1',
      role: 'ADMIN' as const,
      isActive: true,
      preferences: {
        language: 'en',
        currency: 'EUR',
        notifications: {
          email: true,
          sms: false
        }
      }
    };

    const superAdmin = await userModel.createAdmin(superAdminData);
    console.log('✅ Superadmin user created successfully');
    console.log(`📧 Email: ${superAdmin.email}`);
    console.log(`🔑 Password: admin1`);
    console.log(`👤 Name: ${superAdmin.name}`);
    console.log(`🆔 ID: ${superAdmin._id}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the seeding function
seedSuperAdmin()
  .then(() => {
    console.log('🎉 Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
