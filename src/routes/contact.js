const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Submit contact form (public)
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, subject, message } = req.body;

    const contact = new Contact({
      name,
      email,
      phone,
      subject,
      message
    });

    await contact.save();

    res.status(201).json({
      message: 'Contact form submitted successfully',
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        status: contact.status,
        createdAt: contact.createdAt
      }
    });
  } catch (error) {
    console.error('Submit contact error:', error);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

// Get all contacts (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      status,
      priority,
      assignedTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contacts = await Contact.find(filter)
      .populate('assignedTo', 'name email')
      .populate('response.respondedBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contact.countDocuments(filter);

    res.json({
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// Get single contact (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('response.respondedBy', 'name');

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ contact });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to get contact' });
  }
});

// Update contact status (admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['UNREAD', 'READ', 'REPLIED', 'CLOSED'])
    .withMessage('Valid status is required'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Valid priority is required'),
  body('assignedTo').optional().isMongoId().withMessage('Valid user ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, priority, assignedTo } = req.body;
    const updates = {};

    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (assignedTo) updates.assignedTo = assignedTo;

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({
      message: 'Contact status updated successfully',
      contact
    });
  } catch (error) {
    console.error('Update contact status error:', error);
    res.status(500).json({ error: 'Failed to update contact status' });
  }
});

// Reply to contact (admin only)
router.post('/:id/reply', authenticateToken, requireAdmin, [
  body('message').trim().notEmpty().withMessage('Reply message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message } = req.body;

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await contact.reply(message, req.user._id);

    res.json({
      message: 'Reply sent successfully',
      contact
    });
  } catch (error) {
    console.error('Reply to contact error:', error);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Mark contact as read (admin only)
router.patch('/:id/read', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await contact.markAsRead();

    res.json({
      message: 'Contact marked as read',
      contact
    });
  } catch (error) {
    console.error('Mark contact as read error:', error);
    res.status(500).json({ error: 'Failed to mark contact as read' });
  }
});

// Close contact (admin only)
router.patch('/:id/close', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await contact.close();

    res.json({
      message: 'Contact closed successfully',
      contact
    });
  } catch (error) {
    console.error('Close contact error:', error);
    res.status(500).json({ error: 'Failed to close contact' });
  }
});

// Get contact statistics (admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await Contact.getStats();
    
    // Additional stats
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todayContacts = await Contact.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });

    const priorityBreakdown = await Contact.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlyContacts = await Contact.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(today.getFullYear(), today.getMonth(), 1),
            $lt: new Date(today.getFullYear(), today.getMonth() + 1, 1)
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      ...stats,
      todayContacts,
      priorityBreakdown: priorityBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      monthlyContacts
    });
  } catch (error) {
    console.error('Contact stats error:', error);
    res.status(500).json({ error: 'Failed to get contact statistics' });
  }
});

// Delete contact (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router; 