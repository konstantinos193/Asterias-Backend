const express = require('express');
const router = express.Router();
const { 
  calculateRoomAvailability, 
  calculateDateAvailability, 
  calculateMonthlyAvailability,
  calculateMonthlyAggregatedAvailability,
  getAvailabilityStatus 
} = require('../utils/availabilityCalculator');

/**
 * GET /api/availability/room/:roomId
 * Get availability for a specific room on a specific date
 */
router.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const availability = await calculateRoomAvailability(roomId, startDate, endDate);
    res.json(availability);
  } catch (error) {
    console.error('Error getting room availability:', error);
    res.status(500).json({ error: 'Failed to get room availability' });
  }
});

/**
 * GET /api/availability/date/:date
 * Get availability for all rooms on a specific date
 */
router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const startDate = new Date(date);
    
    const availability = await calculateDateAvailability(startDate);
    res.json(availability);
  } catch (error) {
    console.error('Error getting date availability:', error);
    res.status(500).json({ error: 'Failed to get date availability' });
  }
});

/**
 * GET /api/availability/monthly/:roomId
 * Get monthly availability for a specific room
 */
router.get('/monthly/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { month, year } = req.query;
    
    let monthDate;
    if (month && year) {
      monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    } else {
      monthDate = new Date();
    }

    const availability = await calculateMonthlyAvailability(roomId, monthDate);
    res.json(availability);
  } catch (error) {
    console.error('Error getting monthly availability:', error);
    res.status(500).json({ error: 'Failed to get monthly availability' });
  }
});

/**
 * GET /api/availability/calendar
 * Get calendar availability data for frontend calendar component (aggregated across all rooms)
 */
router.get('/calendar', async (req, res) => {
  try {
    const { month, year } = req.query;
    
    let monthDate;
    if (month && year) {
      monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    } else {
      monthDate = new Date();
    }

    const monthlyAvailability = await calculateMonthlyAggregatedAvailability(monthDate);
    
    // Transform data for frontend calendar
    const calendarData = {};
    Object.keys(monthlyAvailability).forEach(date => {
      const dayData = monthlyAvailability[date];
      calendarData[date] = {
        status: dayData.status,
        color: dayData.color,
        textColor: dayData.textColor,
        availableRooms: dayData.availableRooms,
        totalRooms: dayData.totalRooms,
        isAvailable: dayData.isAvailable
      };
    });

    res.json({
      month: monthDate.getMonth() + 1,
      year: monthDate.getFullYear(),
      availability: calendarData
    });
  } catch (error) {
    console.error('Error getting calendar availability:', error);
    res.status(500).json({ error: 'Failed to get calendar availability' });
  }
});

/**
 * GET /api/availability/overview
 * Get availability overview for dashboard
 */
router.get('/overview', async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const overview = {
      today: await calculateDateAvailability(today),
      nextWeek: await calculateDateAvailability(nextWeek),
      totalRooms: 7, // Total Standard Apartments
      availableToday: 0,
      bookedToday: 0
    };

    // Calculate today's stats
    overview.today.forEach(room => {
      if (room.isAvailable) {
        overview.availableToday += room.availableNights;
      } else {
        overview.bookedToday += room.bookedNights;
      }
    });

    res.json(overview);
  } catch (error) {
    console.error('Error getting availability overview:', error);
    res.status(500).json({ error: 'Failed to get availability overview' });
  }
});

module.exports = router;
