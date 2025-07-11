const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
require('dotenv').config();

const rooms = [
  {
    name: 'Standard Double Room',
    description: 'Comfortable double room with modern amenities and beautiful views.',
    price: 90,
    capacity: 2,
    size: '25 sqm',
    bedType: 'Double Bed',
    view: 'Garden View',
    bathroom: 'Private Bathroom',
    features: ['AC', 'WiFi', 'TV', 'Balcony'],
    amenities: {
      wifi: true,
      ac: true,
      tv: true,
      minibar: false,
      balcony: true,
      seaView: false,
      roomService: false,
      safe: true
    },
    totalRooms: 3,
    available: true,
    image: '/room-1.png',
    rating: 4.5,
    reviewCount: 12
  },
  {
    name: 'Family Room',
    description: 'Spacious family room perfect for families with children.',
    price: 120,
    capacity: 4,
    size: '35 sqm',
    bedType: 'Double Bed + Sofa Bed',
    view: 'Garden View',
    bathroom: 'Private Bathroom',
    features: ['AC', 'WiFi', 'TV', 'Balcony', 'Sofa Bed'],
    amenities: {
      wifi: true,
      ac: true,
      tv: true,
      minibar: false,
      balcony: true,
      seaView: false,
      roomService: false,
      safe: true
    },
    totalRooms: 2,
    available: true,
    image: '/room-2.png',
    rating: 4.7,
    reviewCount: 8
  },
  {
    name: 'Romantic Sea View Room',
    description: 'Luxurious room with stunning sea views and romantic atmosphere.',
    price: 150,
    capacity: 2,
    size: '30 sqm',
    bedType: 'King Bed',
    view: 'Sea View',
    bathroom: 'Private Bathroom with Jacuzzi',
    features: ['AC', 'WiFi', 'TV', 'Sea View', 'Jacuzzi', 'Breakfast Included'],
    amenities: {
      wifi: true,
      ac: true,
      tv: true,
      minibar: true,
      balcony: true,
      seaView: true,
      roomService: true,
      safe: true
    },
    totalRooms: 1,
    available: true,
    image: '/room-3.png',
    rating: 4.9,
    reviewCount: 15
  },
  {
    name: 'Twin Room',
    description: 'Comfortable twin room ideal for friends or business travelers.',
    price: 95,
    capacity: 2,
    size: '22 sqm',
    bedType: 'Twin Beds',
    view: 'Garden View',
    bathroom: 'Private Bathroom',
    features: ['AC', 'WiFi', 'TV'],
    amenities: {
      wifi: true,
      ac: true,
      tv: true,
      minibar: false,
      balcony: false,
      seaView: false,
      roomService: false,
      safe: true
    },
    totalRooms: 2,
    available: true,
    image: '/room-4.png',
    rating: 4.3,
    reviewCount: 6
  },
  {
    name: 'Deluxe Suite',
    description: 'Luxurious suite with separate living area and premium amenities.',
    price: 200,
    capacity: 4,
    size: '50 sqm',
    bedType: 'King Bed + Sofa Bed',
    view: 'Sea View',
    bathroom: 'Private Bathroom with Shower',
    features: ['AC', 'WiFi', 'TV', 'Separate Living Area', 'Balcony', 'Sea View', 'Kitchenette'],
    amenities: {
      wifi: true,
      ac: true,
      tv: true,
      minibar: true,
      balcony: true,
      seaView: true,
      roomService: true,
      safe: true
    },
    totalRooms: 1,
    available: true,
    image: '/room-5.png',
    rating: 4.8,
    reviewCount: 10
  },
  {
    name: 'Accessible Room',
    description: 'Wheelchair accessible room with adapted facilities.',
    price: 100,
    capacity: 2,
    size: '28 sqm',
    bedType: 'Double Bed (Accessible)',
    view: 'Garden View',
    bathroom: 'Accessible Bathroom',
    features: ['AC', 'WiFi', 'TV', 'Accessible Bathroom'],
    amenities: {
      wifi: true,
      ac: true,
      tv: true,
      minibar: false,
      balcony: false,
      seaView: false,
      roomService: false,
      safe: true
    },
    totalRooms: 1,
    available: true,
    image: '/room-6.png',
    rating: 4.6,
    reviewCount: 4
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Room.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminUser = await User.createAdmin({
      name: process.env.ADMIN_NAME || 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@asteriashomes.com',
      password: process.env.ADMIN_PASSWORD || 'admin123'
    });
    console.log('Created admin user:', adminUser.email);

    // Create rooms
    const createdRooms = await Room.insertMany(rooms);
    console.log(`Created ${createdRooms.length} rooms`);

    console.log('Database seeded successfully!');
    console.log('\nAdmin credentials:');
    console.log('Email:', adminUser.email);
    console.log('Password:', process.env.ADMIN_PASSWORD || 'admin123');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase(); 