import type { PrismaService } from '@teable/db-main-prisma';
import { CollaboratorType, PrincipalType } from '@teable/openapi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationService } from '../../features/notification/notification.service';
import { CollaboratorCreateEvent } from '../events';
import { CollaboratorInviteNotificationListener } from './collaborator-invite-notification.listener';

describe('CollaboratorInviteNotificationListener', () => {
  let listener: CollaboratorInviteNotificationListener;
  let prismaService: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    space: { findUnique: ReturnType<typeof vi.fn> };
    base: { findUnique: ReturnType<typeof vi.fn> };
  };
  let notificationService: { sendCommonNotify: ReturnType<typeof vi.fn> };

  const createdBy = 'usrInviter';

  beforeEach(() => {
    prismaService = {
      user: { findUnique: vi.fn().mockResolvedValue({ name: 'Inviter' }) },
      space: { findUnique: vi.fn().mockResolvedValue({ name: 'My Space' }) },
      base: { findUnique: vi.fn().mockResolvedValue({ name: 'My Base' }) },
    };
    notificationService = { sendCommonNotify: vi.fn().mockResolvedValue({ sentCount: 1 }) };
    listener = new CollaboratorInviteNotificationListener(
      prismaService as unknown as PrismaService,
      notificationService as unknown as NotificationService
    );
  });

  const spaceContext = (
    collaborators: { principalId: string; principalType: PrincipalType }[]
  ) => ({
    resourceId: 'spcxxx',
    resourceType: CollaboratorType.Space,
    collaborators,
    createdBy,
  });

  it('does nothing when event has no context', async () => {
    await listener.listener(new CollaboratorCreateEvent('spcxxx'));

    expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    expect(notificationService.sendCommonNotify).not.toHaveBeenCalled();
  });

  it('skips department principals', async () => {
    const event = new CollaboratorCreateEvent(
      'spcxxx',
      spaceContext([{ principalId: 'dptxxx', principalType: PrincipalType.Department }])
    );
    await listener.listener(event);

    expect(notificationService.sendCommonNotify).not.toHaveBeenCalled();
  });

  it('skips collaborators added by themselves', async () => {
    const event = new CollaboratorCreateEvent(
      'spcxxx',
      spaceContext([{ principalId: createdBy, principalType: PrincipalType.User }])
    );
    await listener.listener(event);

    expect(notificationService.sendCommonNotify).not.toHaveBeenCalled();
  });

  it('does nothing when the inviter user is missing', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);
    const event = new CollaboratorCreateEvent(
      'spcxxx',
      spaceContext([{ principalId: 'usrInvitee', principalType: PrincipalType.User }])
    );
    await listener.listener(event);

    expect(notificationService.sendCommonNotify).not.toHaveBeenCalled();
  });

  it('does nothing when the resource is missing', async () => {
    prismaService.space.findUnique.mockResolvedValue(null);
    const event = new CollaboratorCreateEvent(
      'spcxxx',
      spaceContext([{ principalId: 'usrInvitee', principalType: PrincipalType.User }])
    );
    await listener.listener(event);

    expect(notificationService.sendCommonNotify).not.toHaveBeenCalled();
  });

  it('sends a space invite notification to invited users', async () => {
    const event = new CollaboratorCreateEvent(
      'spcxxx',
      spaceContext([
        { principalId: 'usrInvitee', principalType: PrincipalType.User },
        { principalId: createdBy, principalType: PrincipalType.User },
        { principalId: 'dptxxx', principalType: PrincipalType.Department },
      ])
    );
    await listener.listener(event);

    expect(notificationService.sendCommonNotify).toHaveBeenCalledWith(
      {
        path: '/space/spcxxx',
        fromUserId: createdBy,
        toUserId: ['usrInvitee'],
        message: {
          i18nKey: 'common.email.templates.notify.collaboratorInvite.space',
          context: { fromUserName: 'Inviter', resourceName: 'My Space' },
        },
        severity: 'info',
      },
      'collaboratorInvite'
    );
  });

  it('sends a base invite notification with base path and i18n key', async () => {
    const event = new CollaboratorCreateEvent('spcxxx', {
      resourceId: 'bsexxx',
      resourceType: CollaboratorType.Base,
      collaborators: [{ principalId: 'usrInvitee', principalType: PrincipalType.User }],
      createdBy,
    });
    await listener.listener(event);

    expect(prismaService.base.findUnique).toHaveBeenCalledWith({
      where: { id: 'bsexxx', deletedTime: null },
      select: { name: true },
    });
    expect(notificationService.sendCommonNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/base/bsexxx',
        toUserId: ['usrInvitee'],
        message: {
          i18nKey: 'common.email.templates.notify.collaboratorInvite.base',
          context: { fromUserName: 'Inviter', resourceName: 'My Base' },
        },
      }),
      'collaboratorInvite'
    );
  });
});
