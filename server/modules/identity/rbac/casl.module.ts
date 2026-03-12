import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PoliciesGuard } from './policies.guard';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [CaslAbilityFactory, PoliciesGuard],
  exports: [CaslAbilityFactory, PoliciesGuard],
})
export class CaslModule {}
