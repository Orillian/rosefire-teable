import type { CollaboratorType, PrincipalType } from '@teable/openapi';
import { Events } from '../event.enum';

export interface ICollaboratorCreateContext {
  resourceId: string;
  resourceType: CollaboratorType;
  collaborators: { principalId: string; principalType: PrincipalType }[];
  createdBy: string;
}

export class CollaboratorCreateEvent {
  public readonly name = Events.COLLABORATOR_CREATE;

  constructor(
    public readonly spaceId: string,
    public readonly context?: ICollaboratorCreateContext
  ) {}
}

export class CollaboratorDeleteEvent {
  public readonly name = Events.COLLABORATOR_DELETE;

  constructor(public readonly spaceId: string) {}
}

export class CollaboratorUpdateEvent {
  public readonly name = Events.COLLABORATOR_UPDATE;

  constructor(public readonly spaceId: string) {}
}
