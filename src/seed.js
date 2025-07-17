const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
require('dotenv').config();

const apartmentType = {
  name: 'Family Apartment',
  description: 'A beautifully furnished apartment with modern amenities, perfect for a relaxing getaway in Koronisia. All our apartments are identical in style and layout, offering consistent comfort and quality.',
  price: 95, // You can adjust this price
  capacity: 4,
  size: '35 sqm',
  bedType: '1 Double Bed, 1 Sofa Bed',
  view: 'Garden or Sea View',
  bathroom: 'Private Bathroom with Shower',
  features: [
    'Entire Place',
    'Free Parking',
    'Breakfast Included',
    'Balcony',
    'Private Bathroom',
    'Free Wifi',
    'Shower',
    'Air Conditioning',
    'Flat-screen TV',
    'Kitchenette',
    'Non-smoking',
    'Family Friendly'
  ],
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
  totalRooms: 7, // We have 7 identical apartments
  image: 'https://i.imgur.com/SaAHqbC.jpeg', // Main image from user
  images: [
    'https://i.imgur.com/SaAHqbC.jpeg',
    'https://i.imgur.com/VjuPC23.png', // Image with towels on bed
    'https://i.imgur.com/2JTTkSc.png', // Kitchen image
    'https://i.imgur.com/r1uVnhU.png', // Double single bed image
    'https://i.imgur.com/X7AG1TW.png', // Another double single bed image
    // You can add more direct image links here
  ],
  rating: 4.8,
  reviewCount: 25,
  bookingcom_room_id: 'YOUR_BCOM_ROOM_TYPE_ID' // Replace with your actual Booking.com Room Type ID
};

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

    // Create the single apartment type
    await Room.create(apartmentType);
    console.log(`Created 1 apartment type with a quantity of ${apartmentType.totalRooms}.`);

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