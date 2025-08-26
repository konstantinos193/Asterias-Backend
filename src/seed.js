const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');
require('dotenv').config();

const standardApartmentData = {
  name: 'Standard Apartment',
  nameKey: 'rooms.standard.name',
  description: 'A beautifully furnished apartment with modern amenities, perfect for a relaxing getaway in Koronisia. All our apartments are identical in style and layout, offering consistent comfort and quality.',
  descriptionKey: 'rooms.standard.description',
  price: 85,
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
  featureKeys: [
    'rooms.feature.entirePlace',
    'rooms.feature.freeParking',
    'rooms.feature.breakfastIncluded',
    'rooms.feature.balcony',
    'rooms.feature.privateBathroom',
    'rooms.feature.freeWifi',
    'rooms.feature.shower',
    'rooms.feature.airConditioning',
    'rooms.feature.flatScreenTV',
    'rooms.feature.kitchenette',
    'rooms.feature.nonSmoking',
    'rooms.feature.familyFriendly'
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
  totalRooms: 1,
  image: 'https://i.imgur.com/SaAHqbC.jpeg',
  images: [
    'https://i.imgur.com/SaAHqbC.jpeg',
    'https://i.imgur.com/VjuPC23.png',
    'https://i.imgur.com/2JTTkSc.png',
    'https://i.imgur.com/r1uVnhU.png',
    'https://i.imgur.com/X7AG1TW.png'
  ],
  rating: 4.8,
  reviewCount: 25
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
      username: 'admin',
      email: process.env.ADMIN_EMAIL || 'admin@asteriashomes.com',
      password: process.env.ADMIN_PASSWORD || 'admin1'
    });
    console.log('Created admin user:', adminUser.username);

    // Create 7 identical Standard Apartments
    for (let i = 1; i <= 7; i++) {
      const roomData = {
        ...standardApartmentData,
        name: `Standard Apartment ${i}`,
        nameKey: 'rooms.standard.name',
        bookingcom_room_id: `asterias-standard-${i}` // Give each room unique ID
      };
      await Room.create(roomData);
      console.log(`Created Standard Apartment ${i}`);
    }

    console.log('Database seeded successfully!');
    console.log('\nAdmin credentials:');
    console.log('Username: admin');
    console.log('Password: admin1');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase(); 