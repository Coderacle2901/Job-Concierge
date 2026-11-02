import { Controller, Get, Patch, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get(':clientId')
  async getNotifications(@Param('clientId') clientId: string) {
    return this.notificationsService.getUserNotifications(clientId);
  }

  // Mark all as read
  @Patch('read-all/:clientId')
  async markAllRead(@Param('clientId') clientId: string) {
    return this.notificationsService.markAllAsRead(clientId);
  }

  //   NEW: Mark a single notification as read
  @Patch(':clientId/:notificationId')
  async markSingleRead(
    @Param('clientId') clientId: string,
    @Param('notificationId') notificationId: string
  ) {
    return this.notificationsService.markSingleAsRead(clientId, notificationId);
  }
}