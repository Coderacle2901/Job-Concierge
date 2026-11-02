# Job Concierge

**An AI-assisted job search and application automation backend built with NestJS and TypeScript.**

Job Concierge is a backend platform designed to streamline the job application process through job discovery, application automation, AI-assisted processing, resume management, and application tracking.

The project explores the integration of backend APIs, browser automation, background processing, and AI services to reduce repetitive work involved in applying for jobs.

## Overview

Job Concierge provides backend services for managing the job search and application lifecycle.

The application is organized into modular NestJS components responsible for authentication, job discovery, application processing, resume management, notifications, and administrative operations.

## Key Features

### Job Discovery and Management
- Job ingestion and management.
- Greenhouse job fetching and question processing.
- ATS platform detection.
- Job matching and candidate-job relevance processing.

### Application Automation
- Automated application submission workflows.
- Background application processing using BullMQ.
- Application status and attempt tracking.
- ATS-specific integrations and adapters.

### AI Integration
- AI service integrations using Google Gemini and Anthropic.
- LLM-assisted mapping of application questions to candidate information.
- AI-assisted application processing.

### Resume Management
- Resume generation and management.
- PDF parsing and rendering.
- Resume scoring and validation utilities.
- Resume processing through background jobs.
- Resume versioning and administrative management.

### User and Administrative Management
- Authentication and access control.
- Candidate profile management.
- Administrative dashboard.
- Staff and assignment management.
- Client request management.
- Application analytics and dashboard services.

### Supporting Services
- Email notifications and templating.
- Webhook processing.
- Application quotas and pricing.
- Saved answers for application workflows.
- Support and notification services.

## Technology Stack

| Technology | Purpose |
|---|---|
| NestJS | Backend application framework |
| TypeScript | Application development |
| PostgreSQL | Relational database |
| TypeORM | Database interaction and entity management |
| Supabase | Database and supporting backend services |
| BullMQ | Background job processing |
| Redis / ioredis | Queue infrastructure |
| Puppeteer | Browser automation and PDF generation |
| Google Gemini | AI integration |
| Anthropic | AI integration |
| Passport | Authentication integration |
| Swagger | API documentation tooling |
| Jest | Testing |
| Docker | Containerization support |

## Architecture

The backend follows a modular NestJS architecture.

```text
src/
├── admin/          # Administrative functionality
├── analytics/      # Analytics services
├── applications/   # Application processing and automation
├── auth/           # Authentication
├── clients/        # Client entities
├── dashboard/      # Dashboard services
├── email/          # Email services and templates
├── interviews/     # Interview management
├── job/            # Job ingestion, matching, and management
├── notifications/  # Notifications
├── profile/        # Candidate profiles
├── quota/          # Quota and pricing management
├── resumes/        # Resume processing and management
├── review/         # Review-related entities
├── saved-answers/  # Saved application answers
├── staff/          # Staff management
├── supabase/       # Supabase integration
├── support/        # Support services
├── users/          # User management
└── webhooks/       # Webhook processing
```

### Application Processing Flow

The application structure supports a workflow involving:

1. Job ingestion and discovery.
2. ATS platform detection.
3. Job matching and application preparation.
4. AI-assisted application question processing.
5. Application submission through ATS-specific adapters.
6. Background processing and application attempt tracking.

BullMQ provides infrastructure for asynchronous application processing.

## Project Structure

```text
.
├── src/                 # Backend source code
├── test/                # End-to-end tests
├── supabase/            # Supabase-related configuration
├── views/               # Application templates
├── Dockerfile           # Docker configuration
├── docker-compose.yml    # Docker Compose configuration
├── package.json         # Dependencies and scripts
├── package-lock.json    # npm dependency lockfile
├── tsconfig.json        # TypeScript configuration
└── nest-cli.json        # NestJS CLI configuration
```

## Getting Started

### Prerequisites

- Node.js compatible with NestJS 11
- npm
- PostgreSQL
- Redis for background job processing
- Required external service credentials

### Installation

Clone the repository:

```bash
git clone https://github.com/Coderacle2901/Job-Concierge.git
```

Navigate into the project:

```bash
cd Job-Concierge
```

Install dependencies:

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the project root.

Example configuration:

```env
DATABASE_URL=your_postgresql_connection_string
GEMINI_API_KEY=your_gemini_api_key

NODE_ENV=development
PORT=3001
```

Additional environment variables may be required for Redis, Supabase, authentication, email, and other integrations depending on the modules being used.

**Never commit actual credentials, API keys, or production environment files.**

### Running the Application

Start the development server:

```bash
npm run dev
```

Build the application:

```bash
npm run build
```

Start the compiled application:

```bash
npm run start:prod
```

## Testing

Run the unit tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate test coverage:

```bash
npm run test:cov
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## API Documentation

The project includes Swagger dependencies for API documentation.

The Swagger UI endpoint should be confirmed from the application's bootstrap configuration before publishing its exact URL.

## Docker

The repository includes Docker configuration for containerized deployment.

```bash
docker-compose up --build
```

Review the Docker Compose configuration and environment variables before running the application.

## Engineering Focus

This project brings together several backend engineering concepts:

- Modular backend architecture.
- REST API development.
- Relational database modeling.
- Background job processing.
- Browser automation.
- AI service integration.
- External API integrations.
- Application workflow orchestration.
- Automated testing.

## Project Status

Job Concierge is an evolving project. Some integrations and workflows may require external services and configuration to operate.

## Future Improvements

- Expand automated test coverage.
- Improve application workflow observability.
- Add comprehensive API documentation.
- Strengthen retry and failure-handling strategies.
- Improve deployment and operational documentation.

## License

License and usage permissions should be confirmed before distributing this repository.
