const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { authenticateToken, requireAdmin, optionalAuth, requireApiKeyOrAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Get all rooms (public)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      available,
      minPrice,
      maxPrice,
      capacity,
      features,
      sortBy = 'price',
      sortOrder = 'asc',
      page = 1,
      limit = 10
    } = req.query;

    // Build filter
    const filter = {};
    if (available === 'true') filter.available = true;
    if (minPrice) filter.price = { $gte: parseFloat(minPrice) };
    if (maxPrice) {
      filter.price = { ...filter.price, $lte: parseFloat(maxPrice) };
    }
    if (capacity) filter.capacity = { $gte: parseInt(capacity) };
    if (features) {
      const featureArray = features.split(',');
      filter.features = { $in: featureArray };
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const rooms = await Room.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Room.countDocuments(filter);

    res.json({
      rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Get single room by ID (public)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Check room availability
router.get('/:id/availability', [
  query('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  query('checkOut').isISO8601().withMessage('Valid check-out date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { checkIn, checkOut } = req.query;
    const roomId = req.params.id;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check availability for individual room
    const isAvailable = await Booking.isIndividualRoomAvailable(roomId, checkIn, checkOut);

    res.json({
      roomId,
      checkIn,
      checkOut,
      isAvailable,
      room: {
        id: room._id,
        name: room.name,
        price: room.price,
        capacity: room.capacity
      }
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Create new room (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Room name is required'),
  body('nameKey').trim().notEmpty().withMessage('Room name key is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('descriptionKey').trim().notEmpty().withMessage('Description key is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('capacity').isInt({ min: 1 }).withMessage('Valid capacity is required'),
  body('bedType').trim().notEmpty().withMessage('Bed type is required'),
  body('features').optional().isArray(),
  body('featureKeys').optional().isArray(),
  body('amenities').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { normalizeRoomUpdateData } = require('../utils/roomDataNormalizer');
    
    // Normalize the room data to ensure amenities are properly formatted
    const roomData = normalizeRoomUpdateData(req.body);
    const room = new Room(roomData);
    await room.save();

    res.status(201).json({
      message: 'Room created successfully',
      room
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().notEmpty().withMessage('Room name cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Valid capacity is required'),
  body('bedType').optional().trim().notEmpty().withMessage('Bed type cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { normalizeRoomUpdateData } = require('../utils/roomDataNormalizer');
    
    // Normalize the update data to ensure amenities are properly formatted
    const updates = normalizeRoomUpdateData(req.body);

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      message: 'Room updated successfully',
      room
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete room (admin only) - accept either API key or admin auth
router.delete('/:id', requireApiKeyOrAdmin, async (req, res) => {
  try {
    // Check if room has any bookings
    const hasBookings = await Booking.exists({ roomId: req.params.id });
    if (hasBookings) {
      return res.status(400).json({ 
        error: 'Cannot delete room with existing bookings' 
      });
    }

    const room = await Room.findByIdAndDelete(req.params.id);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Upload room images (admin only) - accept either API key or admin auth
router.post('/:id/images', requireApiKeyOrAdmin, async (req, res) => {
  try {
    const { images } = req.body;
    
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: 'Images array is required' });
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $push: { images: { $each: images } } },
      { new: true }
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      message: 'Images uploaded successfully',
      room
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Get room statistics (admin only) - accept either API key or admin auth
router.get('/stats/overview', requireApiKeyOrAdmin, async (req, res) => {
  try {
    const totalRooms = await Room.countDocuments();
    const availableRooms = await Room.countDocuments({ available: true });
    const totalCapacity = await Room.aggregate([
      { $group: { _id: null, total: { $sum: '$capacity' } } }
    ]);

    const roomTypes = await Room.aggregate([
      { $group: { _id: '$bedType', count: { $sum: 1 } } }
    ]);

    res.json({
      totalRooms,
      availableRooms,
      totalCapacity: totalCapacity[0]?.total || 0,
      roomTypes
    });
  } catch (error) {
    console.error('Room stats error:', error);
    res.status(500).json({ error: 'Failed to get room statistics' });
  }
});

module.exports = router; 