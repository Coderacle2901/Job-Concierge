import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { DashboardModule } from './dashboard/dashboard.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ResumeModule } from './resumes/resume.module'; 
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { InterviewsModule } from './interviews/interviews.module';
import { ProfileModule } from './profile/profile.module';
import { JobsModule } from './job/module/job.module';
import { StaffModule } from './staff/staff.module';
import { ApplicationEngineModule } from './applications/module/applications.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';

// Make sure your AppController is imported if you have one!
import { AppController } from './app.controller'; 
import { AppService } from './app.service';
import { QuotaModule } from './quota/quota.module';
import { AdminModule } from './admin/module/admin.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    

BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT), // Make sure to convert the string to a number!
    password: process.env.REDIS_PASSWORD,
    tls: {
      rejectUnauthorized: false,
    },
  },
}),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isLiveDb =
          configService.get<string>('DB_HOST')?.includes('supabase.co') || 
          configService.get<string>('DB_HOST')?.includes('pooler.supabase.com');

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'], 
          autoLoadEntities: true, 
          synchronize: true,
          ssl: isLiveDb ? { rejectUnauthorized: false } : false,
        };
      },
    }),
 
    AuthModule,
    DashboardModule,
    WebhooksModule,
    ResumeModule,
    SupabaseModule,  
    InterviewsModule,
    ProfileModule,
    JobsModule,
    StaffModule,
    ApplicationEngineModule,
    NotificationsModule,
    SupportModule,
    UsersModule,
    QuotaModule,
    AdminModule,
    EmailModule,
    AnalyticsModule,
  ],
  
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}