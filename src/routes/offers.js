const express = require('express');
const { body, validationResult } = require('express-validator');
const Offer = require('../models/Offer');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all active offers (public)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const offers = await Offer.getActiveOffers();
    res.json({ offers });
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({ error: 'Failed to get offers' });
  }
});

// Get single offer by ID (public)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate('applicableRooms');
    
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({ offer });
  } catch (error) {
    console.error('Get offer error:', error);
    res.status(500).json({ error: 'Failed to get offer' });
  }
});

// Create new offer (admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('title').trim().notEmpty().withMessage('Offer title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('discount').isFloat({ min: 0, max: 100 }).withMessage('Valid discount percentage is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('applicableRooms').optional().isArray().withMessage('Applicable rooms must be an array'),
  body('minStay').optional().isInt({ min: 1 }).withMessage('Minimum stay must be at least 1'),
  body('maxStay').optional().isInt({ min: 1 }).withMessage('Maximum stay must be at least 1'),
  body('conditions').optional().trim(),
  body('code').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      discount,
      startDate,
      endDate,
      applicableRooms,
      minStay,
      maxStay,
      conditions,
      code
    } = req.body;

    // Check if end date is after start date
    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Check if code is unique (if provided)
    if (code) {
      const existingOffer = await Offer.findByCode(code);
      if (existingOffer) {
        return res.status(400).json({ error: 'Offer code already exists' });
      }
    }

    const offer = new Offer({
      title,
      description,
      discount,
      startDate,
      endDate,
      applicableRooms,
      minStay,
      maxStay,
      conditions,
      code: code?.toUpperCase()
    });

    await offer.save();

    res.status(201).json({
      message: 'Offer created successfully',
      offer
    });
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// Update offer (admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('title').optional().trim().notEmpty().withMessage('Offer title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('Valid discount percentage is required'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('applicableRooms').optional().isArray().withMessage('Applicable rooms must be an array'),
  body('minStay').optional().isInt({ min: 1 }).withMessage('Minimum stay must be at least 1'),
  body('maxStay').optional().isInt({ min: 1 }).withMessage('Maximum stay must be at least 1'),
  body('conditions').optional().trim(),
  body('active').optional().isBoolean().withMessage('Active must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      discount,
      startDate,
      endDate,
      applicableRooms,
      minStay,
      maxStay,
      conditions,
      active
    } = req.body;

    // Check if end date is after start date (if both are provided)
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('applicableRooms');

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({
      message: 'Offer updated successfully',
      offer
    });
  } catch (error) {
    console.error('Update offer error:', error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

// Delete offer (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Delete offer error:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

// Get all offers (admin only)
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    
    const filter = {};
    if (active !== undefined) filter.active = active === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const offers = await Offer.find(filter)
      .populate('applicableRooms')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Offer.countDocuments(filter);

    res.json({
      offers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all offers error:', error);
    res.status(500).json({ error: 'Failed to get offers' });
  }
});

// Toggle offer active status (admin only)
router.patch('/:id/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    offer.active = !offer.active;
    await offer.save();

    res.json({
      message: `Offer ${offer.active ? 'activated' : 'deactivated'} successfully`,
      offer
    });
  } catch (error) {
    console.error('Toggle offer error:', error);
    res.status(500).json({ error: 'Failed to toggle offer status' });
  }
});

// Get applicable offers for dates and room
router.post('/applicable', [
  body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  body('roomId').optional().isMongoId().withMessage('Valid room ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { checkIn, checkOut, roomId } = req.body;

    // Get all active offers
    const allOffers = await Offer.getActiveOffers();
    
    // Filter offers that are applicable for the given dates and room
    const applicableOffers = allOffers.filter(offer => {
      // Check if offer is valid for the dates
      if (!offer.isValidForDates(checkIn, checkOut)) {
        return false;
      }

      // Check if room is applicable (if roomId is provided)
      if (roomId && offer.applicableRooms.length > 0) {
        const isRoomApplicable = offer.applicableRooms.some(room => 
          room.toString() === roomId
        );
        if (!isRoomApplicable) {
          return false;
        }
      }

      // Check minimum stay requirement
      const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
      if (offer.minStay && nights < offer.minStay) {
        return false;
      }

      // Check maximum stay requirement
      if (offer.maxStay && nights > offer.maxStay) {
        return false;
      }

      return true;
    });

    res.json({
      message: 'Applicable offers retrieved successfully',
      offers: applicableOffers.map(offer => ({
        id: offer._id,
        title: offer.title,
        titleKey: offer.titleKey,
        description: offer.description,
        descriptionKey: offer.descriptionKey,
        discount: offer.discount,
        image: offer.image,
        conditions: offer.conditions,
        code: offer.code,
        badgeKey: offer.badgeKey,
        roomTypeKey: offer.roomTypeKey,
        includesKeys: offer.includesKeys,
        featured: offer.featured
      }))
    });
  } catch (error) {
    console.error('Get applicable offers error:', error);
    res.status(500).json({ error: 'Failed to get applicable offers' });
  }
});

// Validate offer code
router.post('/validate-code', [
  body('code').trim().notEmpty().withMessage('Offer code is required'),
  body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  body('roomId').optional().isMongoId().withMessage('Valid room ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, checkIn, checkOut, roomId } = req.body;

    const offer = await Offer.findByCode(code);
    if (!offer) {
      return res.status(404).json({ error: 'Invalid offer code' });
    }

    if (!offer.active) {
      return res.status(400).json({ error: 'Offer is not active' });
    }

    // Check if offer is valid for the dates
    const isValidForDates = offer.isValidForDates(checkIn, checkOut);
    if (!isValidForDates) {
      return res.status(400).json({ error: 'Offer is not valid for the selected dates' });
    }

    // Check if room is applicable (if roomId is provided)
    if (roomId && offer.applicableRooms.length > 0) {
      const isRoomApplicable = offer.applicableRooms.some(room => 
        room.toString() === roomId
      );
      if (!isRoomApplicable) {
        return res.status(400).json({ error: 'Offer is not valid for this room' });
      }
    }

    // Check minimum stay requirement
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    if (offer.minStay && nights < offer.minStay) {
      return res.status(400).json({ 
        error: `Minimum stay requirement is ${offer.minStay} nights` 
      });
    }

    // Check maximum stay requirement
    if (offer.maxStay && nights > offer.maxStay) {
      return res.status(400).json({ 
        error: `Maximum stay allowed is ${offer.maxStay} nights` 
      });
    }

    res.json({
      message: 'Offer code is valid',
      offer: {
        id: offer._id,
        title: offer.title,
        description: offer.description,
        discount: offer.discount,
        conditions: offer.conditions
      }
    });
  } catch (error) {
    console.error('Validate offer code error:', error);
    res.status(500).json({ error: 'Failed to validate offer code' });
  }
});

module.exports = router; 