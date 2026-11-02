import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type  { Request } from 'express';
import { SupabaseService } from '../../supabase/supabase.service';
import { AdminService } from '../services/admin-service';

@Injectable()
export class AdminGuard implements CanActivate {
  // CanActivate is a NestJS interface that requires us to implement
  // one method: canActivate(). It returns true (allow) or false/throws (block).
  // Spring Boot equivalent: implementing OncePerRequestFilter or
  // a Spring Security AuthorizationManager.

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly adminService: AdminService,
    // We need both services:
    // - SupabaseService to verify the JWT token is genuine
    // - AdminService to check the token owner is in our admins table
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ExecutionContext gives us access to the underlying HTTP request.


    // ── Step 1: Extract the request object ──
    const request = context.switchToHttp().getRequest<Request>();
    // switchToHttp() tells NestJS we're in an HTTP context (not WebSocket etc).
    // getRequest<Request>() gives us the Express request object typed correctly.

    // ── Step 2: Extract token from Authorization header ──
    const rawAuthHeader = request.headers['authorization'] || request.headers['Authorization'];
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
    // Authorization header format: "Bearer <token>"
    // We need to extract just the token part after "Bearer "

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
      // If there's no Authorization header at all, or it doesn't
      // follow the Bearer format, we reject immediately.
      // UnauthorizedException → HTTP 401
    }

    const token = authHeader.split(' ')[1];
    // Split "Bearer eyJhbGc..." by space → ['Bearer', 'eyJhbGc...']
    // Index [1] gives us just the token string.

    // ── Step 3: Verify token with Supabase ──
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase.auth.getUser(token);
    // supabase.auth.getUser(token) validates the JWT against Supabase Auth.
    // It checks the signature, expiry, and returns the user if valid.
    // This is equivalent to JwtService.verify() in a custom JWT setup,
    // but uses Supabase's own verification since Supabase issued the token.

    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid or expired token');
      // Token is malformed, expired, or tampered with.
    }

    const supabaseUserId = data.user.id;

    // ── Step 4: Check our admins table ──
    const admin = await this.adminService.findById(supabaseUserId);
    // Even if the token is valid, we need to confirm this user
    // actually exists in our admins table. A valid Supabase token
    // belonging to a CLIENT would pass step 3 but must be blocked here.

    if (!admin) {
      throw new ForbiddenException('Access denied. Not an admin account.');
      // ForbiddenException → HTTP 403.
      // 401 means "who are you?" — 403 means "I know who you are, but no."
      // This person has a valid token but is not in the admins table.
    }

    // ── Step 5: Check admin is still active ──
    if (!admin.isActive) {
      throw new ForbiddenException('This admin account has been deactivated');
      // Account exists but has been deactivated.
      // Their Supabase token is still technically valid but
      // we block them at this layer.
    }

    // ── Step 6: Attach admin to request object ──
    (request as any).admin = admin;
    // We attach the admin object to the request so controllers
    // can access it without hitting the DB again.
    // Usage in controller: @Req() req → req.admin.id


    return true;
    // Returning true tells NestJS to proceed to the controller.
  }
}