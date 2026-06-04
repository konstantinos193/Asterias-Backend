import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contact, ContactDocument, ContactModel } from '../models/contact.model';
import { User, UserDocument } from '../models/user.model';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name) private contactModel: ContactModel,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

  /**
   * Submit a new contact form (public)
   */
  async createContact(contactData: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }) {
    const contact = new this.contactModel(contactData);
    await contact.save();

    return {
      message: 'Contact form submitted successfully',
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        status: contact.status,
        createdAt: contact.createdAt
      }
    };
  }

  /**
   * Get all contacts with pagination and filtering (admin only)
   */
  async getContacts(filters: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      status,
      priority,
      assignedTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    // Build filter
    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = new Types.ObjectId(assignedTo);

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const contacts = await this.contactModel
      .find(filter)
      .populate('assignedTo', 'name email')
      .populate('response.respondedBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.contactModel.countDocuments(filter);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single contact by ID (admin only)
   */
  async getContactById(id: string) {
    const contact = await this.contactModel
      .findById(id)
      .populate('assignedTo', 'name email')
      .populate('response.respondedBy', 'name');

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return { contact };
  }

  /**
   * Update contact status (admin only)
   */
  async updateContactStatus(id: string, updates: {
    status?: 'UNREAD' | 'READ' | 'REPLIED' | 'CLOSED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    assignedTo?: string;
  }) {
    const { status, priority, assignedTo } = updates;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo) updateData.assignedTo = new Types.ObjectId(assignedTo);

    const contact = await this.contactModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return {
      message: 'Contact status updated successfully',
      contact
    };
  }

  /**
   * Reply to contact (admin only)
   */
  async replyToContact(id: string, replyData: {
    message: string;
    respondedBy: string;
  }) {
    const { message, respondedBy } = replyData;

    const contact = await this.contactModel.findById(id);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await contact.reply(message, new Types.ObjectId(respondedBy));

    // Populate the response for the return
    const updatedContact = await this.contactModel
      .findById(id)
      .populate('response.respondedBy', 'name');

    return {
      message: 'Reply sent successfully',
      contact: updatedContact
    };
  }

  /**
   * Mark contact as read (admin only)
   */
  async markContactAsRead(id: string) {
    const contact = await this.contactModel.findById(id);
    
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await contact.markAsRead();

    return {
      message: 'Contact marked as read',
      contact
    };
  }

  /**
   * Close contact (admin only)
   */
  async closeContact(id: string) {
    const contact = await this.contactModel.findById(id);
    
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await contact.close();

    return {
      message: 'Contact closed successfully',
      contact
    };
  }

  /**
   * Get contact statistics (admin only)
   */
  async getContactStats() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [facets] = await this.contactModel.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          total: [{ $count: 'n' }],
          todayContacts: [
            { $match: { createdAt: { $gte: startOfDay, $lt: endOfDay } } },
            { $count: 'n' },
          ],
          byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
          monthlyContacts: [
            { $match: { createdAt: { $gte: startOfMonth, $lt: endOfMonth } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const byStatus: Record<string, number> = facets.byStatus.reduce((acc: Record<string, number>, s: { _id: string; count: number }) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    return {
      total: facets.total[0]?.n ?? 0,
      unread: byStatus['UNREAD'] ?? 0,
      byStatus,
      todayContacts: facets.todayContacts[0]?.n ?? 0,
      priorityBreakdown: facets.byPriority.reduce((acc: Record<string, number>, p: { _id: string; count: number }) => {
        acc[p._id] = p.count;
        return acc;
      }, {}),
      monthlyContacts: facets.monthlyContacts,
    };
  }

  /**
   * Delete contact (admin only)
   */
  async deleteContact(id: string) {
    const contact = await this.contactModel.findByIdAndDelete(id);
    
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return { message: 'Contact deleted successfully' };
  }
}
