import { Public, Authenticated } from '../auth/decorators/access.decorator';
import { Controller, Get, Param, UseGuards, Request, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MongoObjectIdPipe } from '../common/pipes/mongodb-object-id.pipe';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /api/users is gone. It was unauthenticated and took the same DTO as
  // registration, including `role`, so it was a second way for anyone to mint
  // an administrator. Accounts are created through POST /api/auth/register
  // (always role USER) or by seed/CLI for admins.

  @Authenticated()
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (self, or any user for admins)' })
  @ApiResponse({ status: 200, description: 'User found' })
  async findById(@Param('id', MongoObjectIdPipe) id: string, @Request() req) {
    // Previously any signed-in user could read any other account's profile —
    // name, email, phone and postal address for the whole user table.
    if (req.user.role !== 'ADMIN' && String(req.user._id) !== id) {
      throw new ForbiddenException('You may only view your own profile');
    }

    const profile = await this.usersService.getPublicProfile(id);
    if (!profile) {
      throw new NotFoundException('User not found');
    }
    return profile;
  }

  // PUT /api/users/:id/last-login is gone. `lastLogin` is server state and is
  // now written by AuthService.login(). The route made it client-reported: the
  // frontend had to remember to call it, so a client that did not call it
  // showed no logins, and any client could post any value.
}
