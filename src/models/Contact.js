const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['UNREAD', 'READ', 'REPLIED', 'CLOSED'],
    default: 'UNREAD'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  response: {
    message: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for better query performance
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ email: 1 });
contactSchema.index({ assignedTo: 1 });

// Virtual for full name
contactSchema.virtual('fullName').get(function() {
  return this.name;
});

// Method to mark as read
contactSchema.methods.markAsRead = function() {
  this.status = 'READ';
  return this.save();
};

// Method to reply to contact
contactSchema.methods.reply = function(responseMessage, respondedBy) {
  this.status = 'REPLIED';
  this.response = {
    message: responseMessage,
    respondedBy: respondedBy,
    respondedAt: new Date()
  };
  return this.save();
};

// Method to close contact
contactSchema.methods.close = function() {
  this.status = 'CLOSED';
  return this.save();
};

// Static method to get unread contacts
contactSchema.statics.getUnread = function() {
  return this.find({ status: 'UNREAD' }).sort({ createdAt: -1 });
};

// Static method to get contacts by status
contactSchema.statics.getByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Static method to get contact statistics
contactSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const total = await this.countDocuments();
  const unread = await this.countDocuments({ status: 'UNREAD' });

  return {
    total,
    unread,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {})
  };
};

module.exports = mongoose.model('Contact', contactSchema); 