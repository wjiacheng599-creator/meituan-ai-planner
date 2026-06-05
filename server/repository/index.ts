import { ResilientRepository } from './resilientRepository';
import type { ServerRepository } from './types';

let singletonRepository: ServerRepository | null = null;

export function getServerRepository(): ServerRepository {
  if (!singletonRepository) {
    singletonRepository = new ResilientRepository();
  }
  return singletonRepository;
}

export type {
  DatabaseShape,
  PersistedExecutionRun,
  PersistedPlanRecord,
  PersistedShareRecord,
  PersistedStoryRecord,
  ServerRepository,
  ServerSessionRecord,
  ServerUser,
} from './types';
