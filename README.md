# BrandVox Email Automation

Production-grade, human-controlled, AI-assisted B2B email outreach engine.

## Overview

This system implements an automated B2B email outreach flow using:
- **Apollo** as the lead source
- **Company websites** as the only context for email generation
- **Google Gemini** for AI-powered email generation
- **Human-in-the-loop** mandatory review before sending

## Key Features

### 1. Apollo Lead Ingestion
- Filter companies by location, employee count, industry, and keywords
- Select all results or specific companies
- Batch organization for campaign management

### 2. Employee Title Validation
Automatically validates employee titles against an allowlist of decision-makers:
- **Founders/Executives**: CEO, CTO, Founder, President, etc.
- **Growth/Revenue**: Head of Growth, CRO, VP Sales, etc.
- **Marketing**: CMO, VP Marketing, Head of Demand Generation, etc.
- **Product/Tech**: CPO, VP Engineering, Head of Product, etc.

Companies must have **25+ valid titles** to proceed with email generation.

### 3. Website Scraping
- Extracts meaningful content from company websites
- No external enrichment (LinkedIn, Crunchbase, news, etc.)
- Only the company's own website is used as context

### 4. Prompt Composition
- Base system prompt with professional B2B copywriting guidelines
- **Manual editing fully supported** at batch or company level
- User edits are respected verbatim

### 5. Gemini Email Generation
- Uses Google Gemini 1.5 Flash for email generation
- Strict JSON output format: `{ "subject": string, "email_body": string }`
- Validation ensures all required fields are present

### 6. Human-in-the-Loop Review
- **Mandatory blocking step** before any email can be sent
- Edit subject and body with full scrollable preview
- Approve, regenerate, or delete emails
- Auto-populated recipient email from enriched contact

### 7. Deterministic State Management
Each company exists in exactly one state:
- `pending_generation` → Website needs scraping, email not generated
- `email_not_generated` → Threshold not met or generation failed (with retry/reset options)
- `pending_review` → Email generated, awaiting human review
- `approved_to_send` → Reviewed and approved, ready to send
- `sent` → Email delivered

### 8. Email Sending with Amazon SES
- Production-ready email delivery via Amazon SES
- Automatic recipient email population from enriched contacts
- Batch sending capability for approved emails
- Error handling and retry logic
- HTML and plain text email support

### 9. Bulk Operations
- **Process All**: Automatically find contacts and generate emails for all pending companies
- **Send All**: Send all approved emails in one batch operation
- Progress tracking and error reporting

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite with Prisma 7 + LibSQL
- **UI**: React, Tailwind CSS, Radix UI
- **AI**: Google Gemini API
- **Lead Source**: Apollo API
- **Email Service**: Amazon SES (Simple Email Service)

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd email-automation

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Initialize the database
npx prisma migrate deploy
npx prisma generate

# Start development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL="file:./prisma/dev.db"
APOLLO_API_KEY="your_apollo_api_key"
GEMINI_API_KEY="your_gemini_api_key"

# Amazon SES Configuration
AWS_ACCESS_KEY_ID="your_aws_access_key_id"
AWS_SECRET_ACCESS_KEY="your_aws_secret_access_key"
AWS_REGION="us-east-1"  # Optional, defaults to us-east-1
FROM_EMAIL="noreply@yourdomain.com"  # Verified sender email in SES
```

## Usage

### 1. Create a Batch
Click the "+" button in the header to create a new batch for your campaign.

### 2. Search & Import Companies
1. Go to "Lead Search" tab
2. Configure Apollo filters (location, employee count, industry, keywords)
3. Click "Search Companies"
4. Select companies and click "Import Selected"

### 3. Process Companies

#### Manual Processing
For each company in the pipeline:
1. **Find Contact** - Search for decision-makers with target titles
2. **Generate Email** - Use Gemini AI to create personalized email
3. **Review Email** - Edit subject/body with scrollable preview
4. **Approve** - Mark as ready to send
5. **Send** - Recipient email auto-populated, send individually or in bulk

#### Bulk Processing
- **Process All**: Click "Tümünü İşle" to automatically process all pending companies
- **Send All**: Click "Tümünü Gönder" to send all approved emails at once

#### Handling Failed Generations
For companies in `email_not_generated` state:
- View error reason in the company card
- **Retry**: Attempt email generation again
- **Reset**: Reset company to `pending_generation` state
- **Find Contact**: If no contact found, search again

### 4. Customize Prompts
Go to "Prompts" tab to edit the email generation prompt at the batch level.

### 5. Email Management
- **Delete**: Remove email and reset company to pending generation
- **Regenerate**: Create new email with updated prompt
- **Review**: Edit email content before approval
- Full email preview with scrollable content

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/companies/search` | POST | Search companies via Apollo |
| `/api/companies/import` | POST | Import selected companies |
| `/api/companies/[id]` | GET, PATCH, DELETE | Get, update, or delete company |
| `/api/companies/[id]/find-contact` | POST | Find best contact with target titles |
| `/api/companies/[id]/generate` | POST | Generate email using Gemini |
| `/api/companies/[id]/email` | DELETE | Delete email and reset company |
| `/api/emails/[id]/review` | POST | Save email review edits |
| `/api/emails/[id]/approve` | POST | Approve email for sending |
| `/api/emails/[id]/send` | POST | Send approved email via Amazon SES |
| `/api/pipeline/stats` | GET | Get pipeline statistics |
| `/api/pipeline/companies` | GET | Get companies by pipeline state |
| `/api/pipeline/process-all` | POST | Process all pending companies |
| `/api/pipeline/send-all` | POST | Send all approved emails |
| `/api/target-titles` | GET, POST | Manage target job titles |
| `/api/prompts` | GET, POST | Manage email generation prompts |
| `/api/db/clear` | POST | Clear all database data |

## Architecture

```
src/
├── app/
│   ├── api/           # API routes
│   ├── globals.css    # Global styles
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Main dashboard
├── components/
│   ├── apollo/        # Lead search components
│   ├── pipeline/      # Pipeline UI components
│   └── ui/            # Base UI components
├── lib/
│   ├── services/      # Business logic
│   │   ├── apollo.ts      # Apollo API integration
│   │   ├── gemini.ts      # Gemini AI integration
│   │   ├── email-sender.ts # Amazon SES email sending
│   │   └── pipeline.ts    # State management
│   ├── constants.ts   # Configuration
│   ├── prisma.ts      # Database client
│   └── utils.ts       # Utilities
└── generated/
    └── prisma/        # Generated Prisma client
```

## Key Features & Rules

### Allowed
✅ Manual prompt editing at batch or company level
✅ Only company's own website used as AI context
✅ Email generation is company-based, not person-based
✅ Human review required before sending
✅ Deterministic state tracking
✅ Bulk operations (process all, send all)
✅ Email regeneration and deletion
✅ Retry failed operations

### Not Allowed
❌ No LinkedIn, Apollo descriptions, Crunchbase, news, or external enrichment
❌ No persona-based personalization
❌ Emails are never auto-sent (human approval required)
❌ No automatic email sending without explicit user action

## Recent Updates

- ✨ Amazon SES integration for production email delivery
- ✨ Auto-populated recipient emails from enriched contacts
- ✨ Bulk send all approved emails
- ✨ Delete and regenerate email functionality
- ✨ Retry and reset options for failed generations
- ✨ Improved email preview with scrollable content
- ✨ Database clear endpoint for testing

## License

MIT
