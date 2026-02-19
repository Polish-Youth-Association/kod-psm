# PSM Portal - Volunteer Worker Dashboard

## Overview

The **PSM Portal** is a comprehensive volunteer worker dashboard designed for the Polish Youth Association (PSM). It serves as a centralized hub where volunteers and staff can access, manage, and execute complex backend workflows. The portal provides tools for task management, communication, document handling, onboarding workflows, and other operational functions that support the organization's daily activities.

Unlike a simple onboarding system, the PSM Portal is an extensible platform where multiple tools and features can be built, integrated, and used by volunteers and staff members to streamline their work.

---

## Core Purpose

The PSM Portal enables volunteers and staff to:

- **Execute Workflows**: Run complex multi-step backend processes (onboarding, certifications, document generation, etc.)
- **Manage Tasks**: Track and complete assigned tasks and responsibilities
- **Access Tools**: Use integrated tools like certificate generators, PDF builders, and communication templates
- **Handle Communications**: Send personalized emails using dynamic templates
- **Store & Retrieve Documents**: Upload, organize, and manage volunteer and organizational documents
- **Track Progress**: Monitor completion status of workflows and tasks
- **Access Resources**: Find templates, guides, and documentation for various processes

---

## Architecture & Design Philosophy

### Core Principles

1. **Tool-Based Architecture** - The portal is a collection of tools/features accessible from a single dashboard
2. **Workflow Engine** - Complex backend operations are abstracted into user-friendly workflows
3. **Template System** - Reusable email, document, and process templates for consistency
4. **Modular Extensibility** - New tools and workflows can be added without modifying existing code
5. **Role-Based Access** - Different volunteer roles have access to different tools
6. **Cloud-Native** - Built on GCP for scalability, integration, and reliability
7. **TypeScript-First** - Strong typing ensures reliability and maintainability

### Technology Stack

- **Runtime**: Node.js 22
- **Framework**: Express.js
- **Language**: TypeScript
- **Storage**: GCP Storage (documents, artifacts, uploads)
- **Secrets**: GCP Secret Manager (API keys, credentials, sensitive config)
- **PDF Generation**: pdf-lib, pdfkit
- **Email**: SMTP-based with HTML templates
- **Logging**: Structured console logs

### Directory Structure

```
apps/portal/
├── src/
│   ├── index.ts                              # Main app entry point
│   ├── routes/
│   │   ├── health.ts                         # Health check
│   │   ├── workflows/
│   │   │   ├── onboarding.ts                 # Onboarding workflow
│   │   │   ├── certification.ts              # Certification workflow
│   │   │   └── [other workflows]
│   │   ├── tools/
│   │   │   ├── certificateGenerator.ts       # Certificate generation
│   │   │   ├── emailComposer.ts              # Email creation & sending
│   │   │   └── [other tools]
│   │   └── admin/
│   │       ├── volunteers.ts                 # Volunteer management
│   │       ├── tasks.ts                      # Task management
│   │       └── templates.ts                  # Template management
│   ├── templates/
│   │   ├── emails/
│   │   │   ├── onboardingTemplatePsmInbox.ts # Onboarding email
│   │   │   ├── certificationTemplate.ts      # Certification email
│   │   │   └── [other templates]
│   │   ├── documents/
│   │   │   ├── CertTemplate.pdf              # Certificate template
│   │   │   └── [other document templates]
│   │   └── workflows/
│   │       └── [workflow configurations]
│   ├── services/
│   │   ├── workflowService.ts                # Workflow execution engine
│   │   ├── toolService.ts                    # Tool management
│   │   ├── emailService.ts                   # Email sending
│   │   ├── pdfService.ts                     # PDF generation
│   │   ├── volunteerService.ts               # Volunteer data operations
│   │   ├── taskService.ts                    # Task management
│   │   └── storageService.ts                 # GCP Storage operations
│   ├── middleware/
│   │   ├── auth.ts                           # Authentication/authorization
│   │   ├── errorHandler.ts                   # Global error handling
│   │   └── logging.ts                        # Request logging
│   └── types/
│       ├── volunteer.ts                      # Volunteer interfaces
│       ├── workflow.ts                       # Workflow interfaces
│       ├── tool.ts                           # Tool interfaces
│       └── task.ts                           # Task interfaces
├── generated_files/                          # Temporary local storage
├── public/
│   └── dashboard.html                        # Optional web UI
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

---

## Core Concepts

### 1. Tools

**Tools** are discrete features that volunteers can access from the dashboard to accomplish specific tasks.

#### **Tool Structure**

```typescript
// filepath: apps/portal/src/types/tool.ts
export interface Tool {
  id: string;                    // Unique tool identifier
  name: string;                  // Display name
  description: string;           // What the tool does
  icon?: string;                 // Icon URL
  category: 'workflow' | 'generator' | 'manager' | 'communication';
  requiredRoles: string[];       // Roles needed to access
  endpoint: string;              // API endpoint to invoke tool
  parameters: ToolParameter[];   // Input parameters
  outputType: 'json' | 'pdf' | 'email' | 'file';
  status: 'active' | 'beta' | 'deprecated';
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'select';
  required: boolean;
  description: string;
  options?: string[];           // For select type
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}
```

#### **Example: Certificate Generator Tool**

```typescript
// filepath: apps/portal/src/tools/certificateGenerator.ts
export const CERTIFICATE_GENERATOR_TOOL: Tool = {
  id: 'cert-gen',
  name: 'Certificate Generator',
  description: 'Generate PDF certificates for volunteers and participants',
  icon: 'https://cdn-icons.flaticon.com/certificate.png',
  category: 'generator',
  requiredRoles: ['admin', 'coordinator', 'staff'],
  endpoint: '/tools/generate-certificate',
  parameters: [
    {
      name: 'firstName',
      type: 'string',
      required: true,
      description: 'Recipient first name',
    },
    {
      name: 'lastName',
      type: 'string',
      required: true,
      description: 'Recipient last name',
    },
    {
      name: 'participantType',
      type: 'select',
      required: true,
      description: 'Type of certification',
      options: ['volunteer', 'workshop_attendee', 'trainer', 'coordinator'],
    },
    {
      name: 'date',
      type: 'string',
      required: false,
      description: 'Certificate issue date (YYYY-MM-DD)',
    },
  ],
  outputType: 'pdf',
  status: 'active',
};
```

### 2. Workflows

**Workflows** are multi-step processes that orchestrate multiple tools and services to accomplish complex tasks.

#### **Workflow Structure**

```typescript
// filepath: apps/portal/src/types/workflow.ts
export interface Workflow {
  id: string;                         // Unique workflow identifier
  name: string;                       // Display name
  description: string;                // What workflow accomplishes
  steps: WorkflowStep[];              // Sequence of steps
  requiredRoles: string[];            // Roles that can execute
  estimatedDuration: string;          // e.g., "15 minutes"
  status: 'active' | 'beta' | 'deprecated';
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: 'tool' | 'email' | 'decision' | 'data_collection';
  targetTool?: string;               // Tool to execute
  template?: string;                 // Template to use
  inputs?: Record<string, string>;   // Step inputs
  condition?: {                       // Conditional execution
    field: string;
    operator: 'equals' | 'contains' | 'exists';
    value: string;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  initiatedBy: string;               // Volunteer/staff who started it
  initiatedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  currentStep: number;
  steps: WorkflowStepExecution[];
  data: Record<string, any>;         // Collected data
  error?: string;                    // Error message if failed
}

export interface WorkflowStepExecution {
  stepId: string;
  status: 'pending' | 'completed' | 'skipped' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
  error?: string;
}
```

#### **Example: Volunteer Onboarding Workflow**

```typescript
// filepath: apps/portal/src/workflows/onboardingWorkflow.ts
export const ONBOARDING_WORKFLOW: Workflow = {
  id: 'onboard-volunteer',
  name: 'Volunteer Onboarding',
  description: 'Complete onboarding process for new volunteers',
  steps: [
    {
      id: 'collect-info',
      name: 'Collect Volunteer Information',
      description: 'Gather basic information about the new volunteer',
      action: 'data_collection',
      inputs: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        team: '',
      },
    },
    {
      id: 'create-account',
      name: 'Create PSM Account',
      description: 'Create email account and PSM email address',
      action: 'tool',
      targetTool: 'account-creator',
    },
    {
      id: 'send-welcome',
      name: 'Send Welcome Email',
      description: 'Send personalized welcome email with Slack invite',
      action: 'email',
      template: 'onboarding-welcome',
    },
    {
      id: 'invite-slack',
      name: 'Slack Workspace Invitation',
      description: 'Send Slack workspace invite',
      action: 'tool',
      targetTool: 'slack-inviter',
    },
    {
      id: 'schedule-meeting',
      name: 'Schedule Onboarding Meeting',
      description: 'Set up first meeting with team manager',
      action: 'tool',
      targetTool: 'calendar-integration',
    },
  ],
  requiredRoles: ['admin', 'coordinator'],
  estimatedDuration: '30 minutes',
  status: 'active',
};
```

### 3. Email Template System

The portal uses a **variable-based email template system** for consistent, personalized communication.

#### **Standard Template Variables**

```typescript
interface EmailTemplateVariables {
  // Volunteer info
  FIRST_NAME: string;
  LAST_NAME: string;
  FULL_NAME: string;
  EMAIL: string;
  PHONE?: string;

  // PSM Account info
  POLISH_YOUTH_EMAIL: string;
  TEAM: string;
  ROLE?: string;

  // Communication links
  SLACK_INVITE_URL: string;
  PORTAL_LOGIN_URL: string;

  // Additional context
  ONBOARDING_DATE?: string;
  MANAGER_NAME?: string;
  MANAGER_EMAIL?: string;
  MEETING_TIME?: string;

  // Custom variables
  [key: string]: string | undefined;
}
```

#### **Template Example**

```typescript
// filepath: apps/portal/src/templates/emails/onboardingTemplatePsmInbox.ts
export const ONBOARDING_TEMPLATE_PSM_HTML = `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color:#333; line-height:1.8;">
  <p>Hi {{FIRST_NAME}},</p>
  <p>Welcome to the <strong>Polish Youth Association</strong> — you're on the <strong>{{TEAM}}</strong> team.</p>

  <p>Your account is now active:</p>
  <ul>
    <li><strong>Email:</strong> {{POLISH_YOUTH_EMAIL}}</li>
  </ul>

  <p>Join our workspace:</p>
  <ul>
    <li><strong>Slack:</strong> <a href="{{SLACK_INVITE_URL}}">Click to join</a> (use your PSM email)</li>
    <li><strong>Portal:</strong> <a href="{{PORTAL_LOGIN_URL}}">Access the dashboard</a></li>
  </ul>

  <p><strong>Next steps:</strong></p>
  <ol>
    <li>Join Slack and introduce yourself</li>
    <li>Complete your volunteer profile in the portal</li>
    <li>Meet with {{MANAGER_NAME}} on {{MEETING_TIME}}</li>
  </ol>

  <hr style="margin: 30px 0;" />

  <p style="font-size: 12px; color: #666;">
    <strong>Polish Youth Association</strong><br/>
    m. +1 (929) 266-7551<br/>
    e. info@polishyouth.org<br/>
    w. www.polishyouth.org
  </p>
</div>
`;
```

### 4. Volunteer Data Model

```typescript
// filepath: apps/portal/src/types/volunteer.ts
export interface Volunteer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;                 // Personal email
  phone?: string;
  
  // PSM Account details
  psmEmail?: string;
  psmAccountStatus?: 'pending' | 'active' | 'suspended';
  
  // Team & Role
  team: string;
  role?: string;
  reportingManager?: string;
  
  // Status & Timeline
  status: 'onboarding' | 'active' | 'inactive' | 'archived';
  joinDate: Date;
  
  // Permissions & Access
  accessLevel: 'volunteer' | 'coordinator' | 'admin';
  
  // Uploads & Documents
  documents?: {
    bio?: string;
    headshot?: string;
    resume?: string;
    [key: string]: string | undefined;
  };
  
  // Tracking
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. Task Management

Volunteers and staff can track tasks and assignments:

```typescript
// filepath: apps/portal/src/types/task.ts
export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;            // Volunteer ID
  assignedBy: string;            // Who assigned it
  
  status: 'todo' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  
  dueDate?: Date;
  completedDate?: Date;
  
  category: 'workflow' | 'document' | 'review' | 'other';
  relatedWorkflow?: string;      // Link to workflow
  
  notes?: string;
  attachments?: string[];        // File URLs
  
  createdAt: Date;
  updatedAt: Date;
}
```

---

## How to Build Features

### 1. **Create a New Tool**

Tools are self-contained features that solve a specific problem.

#### **Step 1: Define the Tool Interface**

```typescript
// filepath: apps/portal/src/tools/myNewTool.ts
import { Tool } from '../types/tool';

export const MY_NEW_TOOL: Tool = {
  id: 'my-tool',
  name: 'My New Tool',
  description: 'Does something useful',
  category: 'generator',
  requiredRoles: ['admin', 'coordinator'],
  endpoint: '/tools/my-tool',
  parameters: [
    {
      name: 'input1',
      type: 'string',
      required: true,
      description: 'First input',
    },
  ],
  outputType: 'json',
  status: 'active',
};
```

#### **Step 2: Create the Route Handler**

```typescript
// filepath: apps/portal/src/routes/tools/myNewTool.ts
import express from 'express';

const router = express.Router();

/**
 * POST /tools/my-tool
 * Execute my new tool
 */
router.post('/', async (req, res) => {
  try {
    const { input1 } = req.body;

    // Validate
    if (!input1) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required parameter: input1',
      });
    }

    // Process
    const result = await processMyTool(input1);

    res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error('Error executing tool:', err);
    res.status(500).json({
      ok: false,
      error: 'Tool execution failed',
    });
  }
});

async function processMyTool(input: string): Promise<any> {
  // Implementation here
  return { processed: input };
}

export default router;
```

#### **Step 3: Register the Tool**

In `src/index.ts`:

```typescript
import myNewToolRouter from './routes/tools/myNewTool';

app.use('/tools/my-tool', myNewToolRouter);
```

### 2. **Create a New Workflow**

Workflows chain multiple tools together in a structured sequence.

```typescript
// filepath: apps/portal/src/workflows/myWorkflow.ts
import { Workflow } from '../types/workflow';

export const MY_WORKFLOW: Workflow = {
  id: 'my-workflow',
  name: 'My Complex Process',
  description: 'Accomplishes multiple things in sequence',
  steps: [
    {
      id: 'step1',
      name: 'Collect Data',
      description: 'Gather information from user',
      action: 'data_collection',
      inputs: {
        name: '',
        email: '',
      },
    },
    {
      id: 'step2',
      name: 'Process Data',
      description: 'Run processing tool',
      action: 'tool',
      targetTool: 'my-tool',
    },
    {
      id: 'step3',
      name: 'Send Confirmation',
      description: 'Email confirmation to user',
      action: 'email',
      template: 'confirmation-email',
    },
  ],
  requiredRoles: ['coordinator'],
  estimatedDuration: '20 minutes',
  status: 'active',
};
```

Create the workflow service:

```typescript
// filepath: apps/portal/src/services/workflowService.ts
export class WorkflowService {
  async executeWorkflow(
    workflowId: string,
    data: Record<string, any>,
    initiatedBy: string
  ): Promise<WorkflowExecution> {
    // Validate workflow exists
    const workflow = getWorkflowById(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    // Create execution record
    const execution: WorkflowExecution = {
      id: generateId(),
      workflowId,
      initiatedBy,
      initiatedAt: new Date(),
      status: 'in_progress',
      currentStep: 0,
      steps: [],
      data,
    };

    // Execute each step
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepExecution = await this.executeStep(step, data);
      execution.steps.push(stepExecution);
      execution.currentStep = i;

      if (stepExecution.status === 'failed') {
        execution.status = 'failed';
        break;
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date();
    return execution;
  }

  private async executeStep(
    step: WorkflowStep,
    data: Record<string, any>
  ): Promise<WorkflowStepExecution> {
    const execution: WorkflowStepExecution = {
      stepId: step.id,
      status: 'pending',
      startedAt: new Date(),
    };

    try {
      if (step.action === 'tool') {
        // Call tool service
        execution.output = await this.callTool(step.targetTool, data);
      } else if (step.action === 'email') {
        // Send email
        execution.output = await this.sendEmail(step.template, data);
      }
      execution.status = 'completed';
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : 'Unknown error';
    }

    execution.completedAt = new Date();
    return execution;
  }
}
```

Create the route:

```typescript
// filepath: apps/portal/src/routes/workflows/myWorkflow.ts
import express from 'express';
import { WorkflowService } from '../../services/workflowService';

const router = express.Router();
const workflowService = new WorkflowService();

router.post('/execute/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { data } = req.body;
    const initiatedBy = req.headers['x-user-id'] as string;

    const execution = await workflowService.executeWorkflow(
      workflowId,
      data,
      initiatedBy
    );

    res.json({
      ok: true,
      execution,
    });
  } catch (err) {
    console.error('Workflow execution failed:', err);
    res.status(500).json({
      ok: false,
      error: 'Workflow execution failed',
    });
  }
});

export default router;
```

### 3. **Add Email Communication**

```typescript
// filepath: apps/portal/src/services/emailService.ts
import nodemailer from 'nodemailer';
import { ONBOARDING_TEMPLATE_PSM_HTML } from '../templates/emails/onboardingTemplatePsmInbox';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    template: string;
    variables: Record<string, string>;
    from?: string;
  }): Promise<void> {
    let html = this.getTemplate(options.template);
    html = this.replaceVariables(html, options.variables);

    await this.transporter.sendMail({
      from: options.from || process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html,
    });
  }

  private getTemplate(templateName: string): string {
    const templates: Record<string, string> = {
      'onboarding-welcome': ONBOARDING_TEMPLATE_PSM_HTML,
      // Add more templates
    };
    return templates[templateName] || '';
  }

  private replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    });
    return result;
  }
}
```

---

## API Documentation

### Dashboard Endpoints

#### **GET /health**

Health check:

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "ok": true,
  "service": "portal",
  "uptime": 3600
}
```

#### **GET /dashboard**

Get dashboard overview:

```bash
curl -H "x-user-id: USER123" http://localhost:8080/dashboard
```

Response:
```json
{
  "ok": true,
  "tools": [...],
  "workflows": [...],
  "tasks": [...],
  "recentActivity": [...]
}
```

### Tools Endpoints

#### **POST /tools/:toolId/execute**

Execute a tool:

```bash
curl -X POST http://localhost:8080/tools/cert-gen/execute \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER123" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "participantType": "volunteer"
  }'
```

### Workflow Endpoints

#### **POST /workflows/:workflowId/execute**

Start a workflow:

```bash
curl -X POST http://localhost:8080/workflows/onboard-volunteer/execute \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER123" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "team": "Community Outreach"
  }'
```

#### **GET /workflows/:executionId/status**

Check workflow progress:

```bash
curl -H "x-user-id: USER123" \
  http://localhost:8080/workflows/exec-12345/status
```

### Task Management

#### **POST /tasks**

Create a task:

```bash
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER123" \
  -d '{
    "title": "Review volunteer bio",
    "description": "Review and approve bio for John Doe",
    "assignedTo": "VOL-001",
    "dueDate": "2024-02-28",
    "priority": "high"
  }'
```

#### **GET /tasks**

List tasks:

```bash
curl -H "x-user-id: USER123" http://localhost:8080/tasks
```

#### **PATCH /tasks/:taskId**

Update task status:

```bash
curl -X PATCH http://localhost:8080/tasks/TASK-001 \
  -H "Content-Type: application/json" \
  -H "x-user-id: USER123" \
  -d '{"status": "completed"}'
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `GCP_PROJECT_ID` | GCP project ID | `psm-platform-dev` |
| `GCP_BUCKET_NAME` | Storage bucket | `psm-documents` |
| `SMTP_HOST` | Email SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `info@polishyouth.org` |
| `SMTP_PASS` | SMTP password | `[from Secret Manager]` |
| `EMAIL_FROM` | Default sender | `info@polishyouth.org` |
| `SLACK_INVITE_URL` | Slack invite link | `https://join.slack.com/...` |
| `PORTAL_LOGIN_URL` | Portal URL | `https://portal.polishyouth.org` |

---

## Running Locally

```bash
cd apps/portal
pnpm install
export GCP_PROJECT_ID="psm-platform-dev"
pnpm run dev
```

Access at `http://localhost:8080`

---

## Deployment

```bash
gcloud run deploy portal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Contributing

When adding features:

1. **Define the Tool or Workflow** interface
2. **Create the service logic** in `services/`
3. **Create the route handler** in `routes/`
4. **Add email templates** if needed
5. **Test locally** before pushing
6. **Update this README**

---

## Support

For questions: info@polishyouth.org