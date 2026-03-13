import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { withOAuthRedirect } from './base-oauth.guard';

@Injectable()
export class GoogleAuthGuard extends withOAuthRedirect(AuthGuard('google')) {}
