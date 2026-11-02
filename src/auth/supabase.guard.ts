import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  UnauthorizedException 
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    const supabase = this.supabaseService.getClient();

    //   1. Verify the token natively with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    //   2. Populate request.user so your ActivationGuard can read it!
    // We explicitly map data.user.id to 'sub' so your ActivationGuard doesn't break.
    request.user = {
      ...data.user,
      sub: data.user.id, 
      role: data.user.app_metadata?.role || data.user.user_metadata?.role || 'customer',
    };

    return true; // Token is valid, pass to the next Guard!
  }
}