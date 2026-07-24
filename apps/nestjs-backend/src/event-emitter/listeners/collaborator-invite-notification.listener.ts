import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationSeverityEnum, NotificationTypeEnum } from '@teable/core';
import { PrismaService } from '@teable/db-main-prisma';
import { CollaboratorType, PrincipalType } from '@teable/openapi';
import { NotificationService } from '../../features/notification/notification.service';
import { CollaboratorCreateEvent, Events } from '../events';

@Injectable()
export class CollaboratorInviteNotificationListener {
  private readonly logger = new Logger(CollaboratorInviteNotificationListener.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService
  ) {}

  @OnEvent(Events.COLLABORATOR_CREATE, { async: true })
  async listener(event: CollaboratorCreateEvent): Promise<void> {
    try {
      await this.notifyInvitedCollaborators(event);
    } catch (error) {
      this.logger.error(
        `Failed to send collaborator invite notification: ${(error as Error).message}`,
        (error as Error).stack
      );
    }
  }

  private async notifyInvitedCollaborators(event: CollaboratorCreateEvent): Promise<void> {
    const { context } = event;
    if (!context) {
      return;
    }

    const { resourceId, resourceType, collaborators, createdBy } = context;
    const toUserIds = collaborators
      .filter((c) => c.principalType === PrincipalType.User && c.principalId !== createdBy)
      .map((c) => c.principalId);
    if (!toUserIds.length) {
      return;
    }

    const fromUser = await this.prismaService.user.findUnique({
      where: { id: createdBy },
      select: { name: true },
    });
    if (!fromUser) {
      return;
    }

    const isSpace = resourceType === CollaboratorType.Space;
    const resource = isSpace
      ? await this.prismaService.space.findUnique({
          where: { id: resourceId, deletedTime: null },
          select: { name: true },
        })
      : await this.prismaService.base.findUnique({
          where: { id: resourceId, deletedTime: null },
          select: { name: true },
        });
    if (!resource) {
      return;
    }

    await this.notificationService.sendCommonNotify(
      {
        path: isSpace ? `/space/${resourceId}` : `/base/${resourceId}`,
        fromUserId: createdBy,
        toUserId: toUserIds,
        message: {
          i18nKey: isSpace
            ? 'common.email.templates.notify.collaboratorInvite.space'
            : 'common.email.templates.notify.collaboratorInvite.base',
          context: {
            fromUserName: fromUser.name,
            resourceName: resource.name,
          },
        },
        severity: NotificationSeverityEnum.Info,
      },
      NotificationTypeEnum.CollaboratorInvite
    );
  }
}
