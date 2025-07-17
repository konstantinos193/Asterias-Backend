const axios = require('axios');

// These should be stored in your .env file
const BOOKINGCOM_API_URL = process.env.BOOKINGCOM_API_URL || 'https://api.booking.com/v1'; // Example URL
const BOOKINGCOM_API_USER = process.env.BOOKINGCOM_API_USER;
const BOOKINGCOM_API_PASSWORD = process.env.BOOKINGCOM_API_PASSWORD;

const bookingcomApi = axios.create({
  baseURL: BOOKINGCOM_API_URL,
  auth: {
    username: BOOKINGCOM_API_USER,
    password: BOOKINGCOM_API_PASSWORD
  }
});

/**
 * Creates a booking on Booking.com to block availability.
 * This is called when a booking is made on our own site.
 * @param {object} bookingDetails - The details of the booking from our system.
 * @returns {Promise<object>} The response from the Booking.com API, including their booking ID.
 */
async function createBooking(bookingDetails) {
  try {
    // This is a hypothetical endpoint and payload.
    // You would need to map your bookingDetails to the format required by Booking.com.
    const payload = {
      hotel_id: bookingDetails.room.bookingcom_room_id,
      start_date: bookingDetails.checkIn.toISOString().split('T')[0],
      end_date: bookingDetails.checkOut.toISOString().split('T')[0],
      // ... other required fields like guest name, number of adults, etc.
    };

    const response = await bookingcomApi.post('/bookings', payload);
    console.log('Successfully created booking on Booking.com:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating booking on Booking.com:', error.response ? error.response.data : error.message);
    // This error needs robust handling to prevent availability mismatches.
    throw error;
  }
}

/**
 * Fetches availability for a room from Booking.com.
 * This might be used for an initial sync or periodic checks.
 * @param {string} roomId - The Booking.com room ID.
 * @param {Date} startDate - The start date to check.
 * @param {Date} endDate - The end date to check.
 * @returns {Promise<object>} The availability data from Booking.com.
 */
async function getAvailability(roomId, startDate, endDate) {
  try {
    const response = await bookingcomApi.get('/availability', {
      params: {
        hotel_ids: [roomId],
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      }
    });
    console.log('Fetched availability from Booking.com:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching availability from Booking.com:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  createBooking,
  getAvailability
};
