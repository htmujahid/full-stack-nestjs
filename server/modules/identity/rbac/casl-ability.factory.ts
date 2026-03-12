import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
} from '@casl/ability';
import { Action } from './action.enum';
import { User } from '../user/user.entity';
import { UserRole } from '../user/user-role.enum';
import { Project } from '../../desk/project/project.entity';

type Subjects = InferSubjects<typeof User | typeof Project> | 'all';

export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === UserRole.Admin) {
      can(Action.Manage, 'all');
    } else {
      can(Action.Read, Project);
      can(Action.Create, Project);
      can([Action.Update, Action.Delete], Project, { userId: user.id });
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
