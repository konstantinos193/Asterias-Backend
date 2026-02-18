import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete,
  Param, 
  Body, 
  Query,
  UseGuards,
  Request
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto';
import { ReplyToContactDto } from './dto/reply-to-contact.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @ApiOperation({ summary: 'Submit contact form (public)' })
  @ApiResponse({ status: 201, description: 'Contact form submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createContact(@Body() createContactDto: CreateContactDto) {
    return await this.contactService.createContact(createContactDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all contacts' })
  @ApiQuery({ name: 'status', description: 'Filter by status', required: false })
  @ApiQuery({ name: 'priority', description: 'Filter by priority', required: false })
  @ApiQuery({ name: 'assignedTo', description: 'Filter by assigned user', required: false })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
  @ApiQuery({ name: 'sortBy', description: 'Sort field', required: false })
  @ApiQuery({ name: 'sortOrder', description: 'Sort order (asc/desc)', required: false })
  @ApiResponse({ status: 200, description: 'Contacts retrieved successfully' })
  async getContacts(@Query() query: any) {
    return await this.contactService.getContacts(query);
  }

  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get contact statistics (admin only)' })
  @ApiResponse({ status: 200, description: 'Contact statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async getContactStats() {
    return await this.contactService.getContactStats();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Get single contact by ID (admin only)' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async getContactById(@Param('id') id: string) {
    return await this.contactService.getContactById(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Update contact status (admin only)' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact status updated successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async updateContactStatus(
    @Param('id') id: string,
    @Body() updateContactStatusDto: UpdateContactStatusDto
  ) {
    return await this.contactService.updateContactStatus(id, updateContactStatusDto);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Reply to contact (admin only)' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Reply sent successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async replyToContact(
    @Param('id') id: string,
    @Body() replyToContactDto: ReplyToContactDto,
    @Request() req: any
  ) {
    return await this.contactService.replyToContact(id, {
      message: replyToContactDto.message,
      respondedBy: req.user._id
    });
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Mark contact as read (admin only)' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact marked as read' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async markContactAsRead(@Param('id') id: string) {
    return await this.contactService.markContactAsRead(id);
  }

  @Patch(':id/close')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Close contact (admin only)' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact closed successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async closeContact(@Param('id') id: string) {
    return await this.contactService.closeContact(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Delete contact (admin only)' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  async deleteContact(@Param('id') id: string) {
    return await this.contactService.deleteContact(id);
  }
}
