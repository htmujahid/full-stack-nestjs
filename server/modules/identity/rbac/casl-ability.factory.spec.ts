import { subject } from '@casl/ability';
import { CaslAbilityFactory } from './casl-ability.factory';
import { Action } from './action.enum';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { Project } from '../../desk/project/project.entity';

/**
 * Creates a real User instance so that `item.constructor` in detectSubjectType
 * resolves to the User class, enabling CASL condition checks to work correctly.
 */
const makeUser = (overrides: Partial<User> = {}): User => {
  const defaults: Partial<User> = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    username: null,
    phone: null,
    phoneVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    role: UserRole.Member,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return Object.assign(new User(), defaults, overrides);
};

/**
 * Creates a real Project instance so that `item.constructor` in detectSubjectType
 * resolves to the Project class, enabling CASL condition checks to work correctly.
 */
const makeProject = (overrides: Partial<Project> = {}): Project => {
  const defaults: Partial<Project> = {
    id: 'project-1',
    name: 'Test Project',
    description: null,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return Object.assign(new Project(), defaults, overrides);
};

describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  afterEach(() => jest.clearAllMocks());

  describe('createForUser', () => {
    describe('admin user', () => {
      it('can manage all', () => {
        const admin = makeUser({ role: UserRole.Admin });
        const ability = factory.createForUser(admin);

        expect(ability.can(Action.Manage, 'all')).toBe(true);
      });

      it('can read Project', () => {
        const admin = makeUser({ role: UserRole.Admin });
        const ability = factory.createForUser(admin);

        expect(ability.can(Action.Read, Project)).toBe(true);
      });

      it('can create Project', () => {
        const admin = makeUser({ role: UserRole.Admin });
        const ability = factory.createForUser(admin);

        expect(ability.can(Action.Create, Project)).toBe(true);
      });

      it('can update any Project', () => {
        const admin = makeUser({ id: 'admin-1', role: UserRole.Admin });
        const ability = factory.createForUser(admin);
        const project = makeProject({ userId: 'other-user' });

        expect(ability.can(Action.Update, subject('Project', project))).toBe(true);
      });

      it('can delete any Project', () => {
        const admin = makeUser({ id: 'admin-1', role: UserRole.Admin });
        const ability = factory.createForUser(admin);
        const project = makeProject({ userId: 'other-user' });

        expect(ability.can(Action.Delete, subject('Project', project))).toBe(true);
      });

      it('can read User', () => {
        const admin = makeUser({ role: UserRole.Admin });
        const ability = factory.createForUser(admin);

        expect(ability.can(Action.Read, User)).toBe(true);
      });

      it('can delete User', () => {
        const admin = makeUser({ role: UserRole.Admin });
        const ability = factory.createForUser(admin);

        expect(ability.can(Action.Delete, User)).toBe(true);
      });
    });

    describe('member user', () => {
      it('can read Project', () => {
        const member = makeUser({ role: UserRole.Member });
        const ability = factory.createForUser(member);

        expect(ability.can(Action.Read, Project)).toBe(true);
      });

      it('can create Project', () => {
        const member = makeUser({ role: UserRole.Member });
        const ability = factory.createForUser(member);

        expect(ability.can(Action.Create, Project)).toBe(true);
      });

      it('can update own project', () => {
        const member = makeUser({ id: 'user-1', role: UserRole.Member });
        const ability = factory.createForUser(member);
        const ownProject = makeProject({ userId: 'user-1' });

        expect(ability.can(Action.Update, subject('Project', ownProject))).toBe(true);
      });

      it('cannot update someone else\'s project', () => {
        const member = makeUser({ id: 'user-1', role: UserRole.Member });
        const ability = factory.createForUser(member);
        const otherProject = makeProject({ userId: 'other-user' });

        expect(ability.can(Action.Update, subject('Project', otherProject))).toBe(false);
      });

      it('can delete own project', () => {
        const member = makeUser({ id: 'user-1', role: UserRole.Member });
        const ability = factory.createForUser(member);
        const ownProject = makeProject({ userId: 'user-1' });

        expect(ability.can(Action.Delete, subject('Project', ownProject))).toBe(true);
      });

      it('cannot delete someone else\'s project', () => {
        const member = makeUser({ id: 'user-1', role: UserRole.Member });
        const ability = factory.createForUser(member);
        const otherProject = makeProject({ userId: 'other-user' });

        expect(ability.can(Action.Delete, subject('Project', otherProject))).toBe(false);
      });

      it('cannot manage all', () => {
        const member = makeUser({ role: UserRole.Member });
        const ability = factory.createForUser(member);

        expect(ability.can(Action.Manage, 'all')).toBe(false);
      });

      it('cannot delete User', () => {
        const member = makeUser({ role: UserRole.Member });
        const ability = factory.createForUser(member);

        expect(ability.can(Action.Delete, User)).toBe(false);
      });

      it('cannot update User', () => {
        const member = makeUser({ role: UserRole.Member });
        const ability = factory.createForUser(member);

        expect(ability.can(Action.Update, User)).toBe(false);
      });
    });
  });
});
