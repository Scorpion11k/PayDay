# SCRUM-12: System-Aware AI Home Brain Design Document

**Author:** AI Agent  
**Date:** March 9, 2026  
**Status:** Implementation-Ready Draft  
**Version:** 1.1  
**Ticket:** SCRUM-12

---

## Source of Truth

This document combines three sources with different authority levels:

| Source | Authority | Notes |
|--------|-----------|-------|
| SCRUM-12 Jira ticket (`docs/SCRUM-12 (1).doc`) | Product intent | Defines what the feature should accomplish; does not specify implementation details |
| This codebase (PayDay monorepo) | Implementation constraints | Defines what already exists and must be reused; any assumption not backed by code must be flagged |
| This design document | V1 implementation defaults | Where the ticket is ambiguous or the codebase is silent, this document chooses a safe default for initial implementation |

An AI implementation agent **must not invent behavior** that is neither in the ticket nor in this document. When in doubt, the agent should stop and request clarification rather than guess.

---

## Implementation Defaults For This Repo (V1)

The following defaults are chosen for V1 to keep scope safe and avoid guessing:

| Decision | V1 Default | Rationale |
|----------|------------|-----------|
| Flow approval semantics | Approving an AI flow creates a **draft** `CollectionFlow` only; publishing/assignment is a separate explicit step | Current `flow-runtime.service.ts` only assigns published flows |
| `switch_channel_for_cohort` behavior | Temporary send override for this action only; does **not** persist `Customer.preferredChannel` | Avoids silent mutation of customer preferences |
| Actor identity for audit | Use placeholder values `ui` / `system` / `home_brain` | App has no auth/user model yet |
| Home chat panel behavior | Home page hides the bottom chat panel via `ChatVisibilityContext`; Home Brain is page-driven | Per ticket: "not a chatbot" |
| Localization | Backend may choose `en` / `he` / `ar` for message execution; Home UI v1 renders `en` / `he` only | Client i18n only supports `en` / `he` currently |
| Reply/engagement tracking | Derive "non-response" from `NotificationDelivery.status` != `delivered` or no `VoiceCallLog.answeredBy`; no generic inbound reply model | System has no reply inbox |
| Internal alerts | Persisted in new `InternalAlert` table; surfaced in Home only for v1 | No email/Slack integration in scope |
| Prompt versioning | Code constants in `home-brain.service.ts` | Simple; DB-backed versioning is follow-up |
| Card expiration | Plans expire after 24 hours or on next refresh | Keep Home fresh without complex TTL logic |
| Max cohort size per bulk action | 200 customers direct IDs; larger cohorts use filter spec | Avoid token overflow and unbounded payloads |

---

## Repo Constraints That Must Not Be Assumed Away

The following constraints come from the actual codebase and **must not be worked around** without explicit schema/service changes:

| Constraint | Source File(s) | Impact |
|------------|----------------|--------|
| Flow assignment requires published status | `server/src/services/flow-runtime.service.ts` (line 38-39) | AI-generated drafts cannot be auto-assigned until published |
| `CollectionFlowState` has no `templateKey`, `languageMode`, `fallbackRule` | `server/prisma/schema.prisma` | Blueprint richness is transient AI metadata; only `actionType`, `tone`, `explicitChannel` persist |
| Flow executor hardcodes `templateKey: 'debt_reminder'` | `server/src/services/flow-executor.service.ts` | Per-step template selection requires executor changes (out of v1 scope) |
| Client i18n is `en` / `he` only | `client/src/i18n/index.ts`, `client/src/context/LanguageContext.tsx` | Arabic UI strings require explicit addition |
| No batch flow assignment API | `server/src/services/flow-runtime.service.ts` | `assign_flow_to_customers` intent must loop single-customer calls |
| No generic reply/engagement model | Schema has `NotificationDelivery`, `VoiceCallLog` but no inbound reply table | "non-response" is inferred from delivery status, not actual customer reply |
| `ActivityLog` is limited to three types | `server/prisma/schema.prisma` enum `ActivityType` | New audit surface requires `AiPlanSnapshot` / `AiPlanAction` tables |
| `ChatPanel` is shell-mounted | `client/src/layout/AppShell.tsx` | Home must call `setChatHidden(true)` on mount |

---

## Instructions for AI Agent Implementation

This document is designed to be implementation-ready for a future AI coding agent.

### Primary Objective

Implement a **system-aware AI orchestration layer** that drives the Home experience with live data. The AI must return **structured plans** for:

- Dynamic KPIs
- Priority queues
- Recommendation cards
- Collection flow blueprints
- Bulk reminder actions
- Internal management alerts

The AI is **not** a chatbot in this feature. It acts as a **product brain** that generates UI state and executable intents.

### Required Implementation Order

1. **Backend foundation**: context assembly, prompt contract, output validation, audit persistence
2. **Home plan API**: generate structured Home plans from real system data
3. **Action execution API**: approve / modify / skip / resolve AI cards
4. **Flow materialization**: convert AI flow blueprints into existing `CollectionFlow` definitions
5. **Frontend Home UI**: replace static Home content with AI-driven sections
6. **Testing**: unit, integration, and end-to-end validation using mocked AI responses plus manual UI verification

### Existing Building Blocks To Reuse

- `server/src/services/ai.service.ts` for Gemini client initialization patterns and structured output handling
- `server/src/services/template.service.ts` for language / tone / channel template resolution
- `server/src/services/notification-dispatch.service.ts` for actual reminder delivery
- `server/src/services/flow-definition.service.ts` and `flow-runtime.service.ts` for collection-flow persistence and execution
- `client/src/pages/HomePage.tsx` as the page to replace
- `client/src/pages/DashboardsPage.tsx` and `client/src/pages/FlowsPage.tsx` as reference sources for current chart / flow UI capabilities

### Important Constraint

Do **not** build this on top of the existing bottom chat UX in `client/src/components/Chat/ChatPanel.tsx`. That component is query-oriented and chatbot-like. The Home Brain must be **page-driven**, not conversation-driven.

---

## 1. Summary

SCRUM-12 asks for a single system-aware AI prompt that works with **real system data** and dynamically generates the Home dashboard, collection flow proposals, payment reminder actions, and management alerts. The output must be **structured and system-consumable**, not prose.

In the current codebase:

- `HomePage` is static and uses hardcoded quick actions and sample stats
- `DashboardsPage` computes a fixed dashboard with fallback sample data
- `FlowsPage` already supports persisted collection-flow definitions and execution
- Messaging, templates, channel routing, and system mode already exist
- AI exists only as a query assistant, not as a structured orchestration layer

The recommended implementation is to add a new **Home Brain backend** that assembles live product context, calls Gemini with a strict JSON schema, validates the result, persists an audit snapshot, and returns a typed plan that the Home UI renders directly.

---

## 2. Goals and Non-Goals

### Goals

1. **System-aware Home plan generation** from live customers, debts, installments, notifications, channels, and system mode
2. **Dynamic dashboard composition** including KPIs, queues, cards, filters, and grouping suggestions
3. **AI-generated collection flow blueprints** that map into the existing `CollectionFlow` engine
4. **Bulk reminder and escalation actions** with explainable reasoning
5. **Automatic tone, channel, and language decisions** constrained by real availability and business rules
6. **Internal management alerts and digest cards** generated by AI
7. **User control** to approve, modify, skip, or resolve AI cards
8. **Auditability** of prompts, context summaries, AI outputs, and action outcomes

### Non-Goals

1. Replacing the existing AI query chat assistant
2. Creating a fully autonomous agent that sends messages without approval
3. Building a generic BI platform or unrestricted ad hoc visualization engine
4. Replacing the existing flow executor runtime
5. Solving every future Lovable parity requirement without a provided visual reference

---

## 3. Current State Analysis

### 3.1 Home UI Is Static

`client/src/pages/HomePage.tsx` currently renders:

- Fixed quick-action cards
- Hardcoded stats
- Static navigation buttons

There is no server-driven Home plan, no AI-generated cards, and no approval workflow.

### 3.2 Dashboards Are Semi-Real but Still Fixed

`client/src/pages/DashboardsPage.tsx` loads customer and payment data, then renders a predetermined set of tabs, stat cards, and charts. The page does not support AI-defined:

- KPI lists
- Queue definitions
- Custom groupings
- Explainable card priorities

### 3.3 Collection Flow Infrastructure Already Exists

The repository already includes:

- Prisma models for `CollectionFlow`, states, transitions, assignments, instances
- APIs in `server/src/controllers/flows.controller.ts`
- Persistence and validation in `server/src/services/flow-definition.service.ts`
- Runtime assignment and instance management in `server/src/services/flow-runtime.service.ts`
- Executor polling in `server/src/services/flow-executor.service.ts`

This is a major asset. SCRUM-12 should generate **blueprints that compile into these existing flow models**, rather than inventing a parallel flow engine.

### 3.4 Multichannel Messaging Infrastructure Already Exists

The system already supports:

- Template lookup by channel / language / tone
- Bulk send endpoints
- Notification dispatch by email / SMS / WhatsApp / voice
- Customer preference fallback
- Development mode simulation through `SystemSettings.mode`

This means Home Brain cards can execute through existing messaging services once approved.

### 3.5 AI Today Is Query-Centric, Not Product-Centric

`server/src/services/ai.service.ts` turns natural-language questions into Prisma queries and limited `updateMany` operations. It is useful for chat but does not:

- assemble product context
- output UI state
- produce cards, queues, or actions
- maintain Home-level explainability or audit snapshots

**Reusable patterns from this file:**
- Gemini client initialization via `GoogleGenerativeAI`
- Strict JSON response format with `responseMimeType: 'application/json'`
- Safety validation and parse cleanup
- Confirmation-token gating for write operations

### 3.6 Chat Panel Is Shell-Mounted

`client/src/layout/AppShell.tsx` unconditionally mounts `ChatPanel` at the bottom of every page. Pages that need to hide it must call `setChatHidden(true)` via `ChatVisibilityContext`. The Home Brain implementation must do this on mount.

### 3.7 Gap vs SCRUM-12

| Requirement | Current State | Gap | V1 Scope |
|-------------|---------------|-----|----------|
| AI uses real system context | Partial AI query service only | Need full context assembly service | In scope |
| Dynamic Home dashboard | Static / fixed components | Need AI plan output and renderer | In scope |
| End-to-end collection flow generation | Flow engine exists, generation missing | Need flow blueprint materializer | In scope (draft only) |
| Bulk reminder recommendations | Bulk send exists, AI planning missing | Need AI intents + approval path | In scope |
| Automatic tone/channel/language | Deterministic preference logic only | Need AI decision layer with hard constraints | In scope |
| Internal alerts / digests | Not implemented | Need in-app internal alert model and cards | In scope (Home only) |
| Explainable / auditable UI decisions | Minimal | Need persisted plan snapshots and action logs | In scope |
| Reply/engagement tracking | No inbound reply model | Derive from delivery status only | Deferred |
| Batch flow assignment | Single-customer only | Loop over customers | In scope (loop) |
| Arabic UI localization | Not in client i18n | Add `ar.json` | Deferred |

---

## 4. Product Requirements Interpreted for Implementation

The uploaded SCRUM-12 document is strong on product intent but incomplete for implementation. The following details are added here so an AI coding agent can build safely:

1. **Structured output contract** must be explicit and validated with Zod
2. **Deterministic guardrails** must run before and after the model, so AI never chooses blocked customers or unavailable channels
3. **Audit persistence** is mandatory because the feature must stay explainable
4. **Plan execution** must reuse existing notification and flow services
5. **UI state ownership** must shift from static React definitions to server-generated plan objects
6. **Lovable parity**: The ticket says "Home screen must behave and look identical to Lovable." This repo contains **no canonical Lovable reference** (no Figma, no screenshot pack, no reference implementation). Therefore:
   - Implement the **interaction model** described in the ticket (AI-generated cards, approve/modify/skip/resolve controls, KPIs, queues)
   - Keep the layout **modular** so visual polish can be applied later
   - Flag any remaining parity gaps as **design-review follow-ups**, not implementation blockers
   - Do **not** invent visual behavior that is not explicitly described

### 4.1 Clarified Definitions

| Term in Ticket | Operational Definition for V1 |
|----------------|-------------------------------|
| "non-response" | `NotificationDelivery.status` is `failed` or `queued` (not `delivered`), or `VoiceCallLog.answeredBy` is null for voice calls |
| "recent communication outcomes" | Aggregate of `NotificationDelivery` and `VoiceCallLog` records from the last 30 days, grouped by channel and status |
| "switch to SMS where WhatsApp failed" | Temporary channel override for this send action; does not mutate `Customer.preferredChannel` |
| "management alerts" | New `InternalAlert` records surfaced as Home cards; no email/Slack delivery in v1 |
| "real system data" | Live queries against PostgreSQL via Prisma, summarized into bounded context DTO |

---

## 5. Proposed Architecture

### 5.1 High-Level Flow

```mermaid
flowchart LR
    UI[Home Page] --> API[Home Brain API]
    API --> CA[Context Assembler]
    CA --> DB[(PostgreSQL)]
    CA --> CH[Channel/Template Availability]
    CA --> FL[Flow Definitions]
    API --> PR[Prompt Builder]
    PR --> LLM[Gemini]
    LLM --> VA[Zod Validator]
    VA --> PS[Plan Snapshot Persistence]
    VA --> UI
    UI --> EX[Action Execution API]
    EX --> ND[Notification Dispatch]
    EX --> FM[Flow Materializer]
    EX --> IA[Internal Alerts]
```

### 5.2 New Backend Responsibilities

#### A. Context Assembler

Create a service that builds a compact, deterministic Home context from live data:

- system mode (`demo`, `development`, `production`)
- customer cohorts
- overdue and risk summaries
- recent communication outcomes
- channel availability and permission constraints
- template coverage
- existing default flow and published flows
- current Home filters / page state

This service should summarize large datasets into a **bounded prompt context** instead of dumping raw tables.

#### B. Home Brain Prompt Builder

Create a prompt builder that:

- frames the model as a system planner, not a chatbot
- passes only summarized real data
- includes hard rules and forbidden behaviors
- requests a strict JSON response conforming to the schema in Section 7

#### C. Plan Validator

Every AI response must be validated before use:

- JSON parse
- Zod schema validation
- business-rule validation
- reference validation against known channel, language, tone, template, and flow capabilities

Invalid responses should fail closed and return a handled error or a cached last-good plan.

#### D. Plan Persistence

Persist generated plans and user actions so every Home card remains auditable.

#### E. Action Execution Layer

Approving a card should dispatch through one of:

- existing bulk messaging
- existing notification dispatch
- new internal alert persistence
- flow blueprint materialization into `CollectionFlow`

---

## 6. Deterministic Rules Before AI

The AI must reason within guardrails derived from the system, not replace them.

### 6.1 Customer Eligibility Rules

Always exclude from message actions:

- `do_not_contact`
- `blocked`
- customers lacking required contact details for the chosen channel

### 6.2 Channel Availability Rules

AI may only recommend a channel if:

1. the provider is available in current system mode, or simulated in development mode
2. a template exists for the requested `templateKey + channel + language + tone`
3. the targeted cohort has usable recipient data

### 6.3 Language Resolution Rules

Resolution order:

1. explicit user modification
2. customer `preferredLanguage`
3. deterministic inference (`recommendLanguageByRegion`)
4. system default (`en` unless product team changes default)

### 6.4 Tone Resolution Rules

Resolution order:

1. explicit user modification
2. customer `preferredTone`
3. deterministic overdue-based default
4. `calm`

### 6.5 Risk Scoring for AI Context

Before prompting, compute a deterministic `riskScore` per customer or cohort using signals already available:

- open balance
- max overdue days
- count of failed deliveries
- count of unanswered notifications
- active debt count

Keep this heuristic server-side and include only the derived score and flags in the AI prompt.

---

## 7. Structured Output Contract

The Home Brain must return JSON that conforms to a strict schema.

### 7.1 Top-Level Response Shape

```typescript
interface HomeBrainPlan {
  planVersion: string;
  generatedAt: string;
  contextVersion: string;
  reasoningSummary: string;
  dashboard: DashboardDefinition;
  cards: RecommendationCard[];
  flowBlueprints: CollectionFlowBlueprint[];
  actionIntents: ActionIntent[];
  internalAlerts: InternalAlertDraft[];
}
```

### 7.2 Dashboard Definition

```typescript
interface DashboardDefinition {
  title: string;
  subtitle?: string;
  kpis: KpiDefinition[];
  queues: QueueDefinition[];
  filters: FilterDefinition[];
  groupings: GroupingSuggestion[];
}

interface KpiDefinition {
  key: string;
  label: string;
  value: number | string;
  format: 'currency' | 'number' | 'percent' | 'text';
  trend?: {
    direction: 'up' | 'down' | 'flat';
    value?: number;
    label?: string;
  };
}

interface QueueDefinition {
  queueId: string;
  title: string;
  description?: string;
  count: number;
  customerIds: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface FilterDefinition {
  key: string;
  label: string;
  type: 'select' | 'multi_select' | 'date_range' | 'toggle';
  options?: Array<{ label: string; value: string }>;
}

interface GroupingSuggestion {
  key: string;
  label: string;
  supportedValues: string[];
}
```

### 7.3 Recommendation Cards

```typescript
interface RecommendationCard {
  cardId: string;
  type: 'queue' | 'bulk_action' | 'flow' | 'alert' | 'kpi_explainer';
  title: string;
  body: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  badges: string[];
  targetCustomerIds: string[];
  queueRef?: string;
  actionIntentIds: string[];
  explainability: {
    whyNow: string;
    keySignals: string[];
  };
}
```

### 7.4 Action Intents

```typescript
interface ActionIntent {
  id: string;
  type: ActionIntentType;
  title: string;
  requiresApproval: boolean;
  payload: ActionIntentPayload;
}

type ActionIntentType =
  | 'open_queue'
  | 'send_bulk_reminders'
  | 'switch_channel_for_cohort'
  | 'materialize_collection_flow'
  | 'assign_flow_to_customers'
  | 'notify_management'
  | 'create_internal_alert';
```

### 7.4.1 Per-Intent Payload Schemas (Narrowed)

Replace open-ended `Record<string, unknown>` with typed payloads:

```typescript
type ActionIntentPayload =
  | OpenQueuePayload
  | SendBulkRemindersPayload
  | SwitchChannelPayload
  | MaterializeFlowPayload
  | AssignFlowPayload
  | NotifyManagementPayload
  | CreateAlertPayload;

interface OpenQueuePayload {
  queueId: string;
  filterSpec?: Record<string, string>;
}

interface SendBulkRemindersPayload {
  customerIds: string[];
  channel: 'sms' | 'email' | 'whatsapp' | 'call_task';
  language: 'en' | 'he' | 'ar';
  tone: 'calm' | 'medium' | 'heavy';
  templateKey: string;
}

interface SwitchChannelPayload {
  customerIds: string[];
  fromChannel: 'sms' | 'email' | 'whatsapp' | 'call_task';
  toChannel: 'sms' | 'email' | 'whatsapp' | 'call_task';
  language: 'en' | 'he' | 'ar';
  tone: 'calm' | 'medium' | 'heavy';
  templateKey: string;
}

interface MaterializeFlowPayload {
  blueprintId: string;
  flowName: string;
  description?: string;
}

interface AssignFlowPayload {
  flowId: string;
  customerIds: string[];
}

interface NotifyManagementPayload {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  body: string;
  metadata?: Record<string, string | number | boolean>;
}

interface CreateAlertPayload {
  severity: 'critical' | 'high' | 'medium' | 'low';
  audience: 'management' | 'operations' | 'collections';
  title: string;
  body: string;
  metadata?: Record<string, string | number | boolean>;
}
```

### 7.4.2 Per-Intent Editable Fields (Modify Action)

When a user clicks "Modify" on a card, only these fields are editable per intent type:

| Intent Type | Editable Fields |
|-------------|-----------------|
| `send_bulk_reminders` | `channel`, `language`, `tone`, `customerIds` (remove only) |
| `switch_channel_for_cohort` | `toChannel`, `language`, `tone`, `customerIds` (remove only) |
| `materialize_collection_flow` | `flowName`, `description` |
| `assign_flow_to_customers` | `customerIds` (remove only) |
| `notify_management` | `severity`, `title`, `body` |
| `create_internal_alert` | `severity`, `audience`, `title`, `body` |
| `open_queue` | Not editable (navigation only) |

### 7.5 Internal Alert Draft

```typescript
interface InternalAlertDraft {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  audience: 'management' | 'operations' | 'collections';
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}
```

### 7.6 Collection Flow Blueprint

```typescript
interface CollectionFlowBlueprint {
  blueprintId: string;
  name: string;
  description?: string;
  audienceCustomerIds: string[];
  steps: Array<{
    stepKey: string;
    dayOffset: number;
    actionType: 'assigned_channel' | 'send_email' | 'send_sms' | 'send_whatsapp' | 'voice_call';
    explicitChannel?: 'email' | 'sms' | 'whatsapp' | 'call_task';
    languageMode: 'preferred' | 'explicit' | 'inferred';
    language?: 'en' | 'he' | 'ar';
    toneMode: 'auto' | 'explicit';
    tone?: 'calm' | 'medium' | 'heavy';
    templateKey: string;
    expectedOutcome?: string;
    fallbackRule?: string;
  }>;
}
```

### 7.7 Output Rules

The model must never:

- return freeform markdown
- invent customers that are not in the context
- reference unavailable channels
- include actions for blocked / opt-out customers
- emit unbounded customer lists

**Server-Enforced Caps (Post-Validation)**

| Limit | Value | Enforcement |
|-------|-------|-------------|
| Max KPIs | 8 | Truncate to first 8, log warning |
| Max queues | 6 | Truncate to first 6, log warning |
| Max cards | 12 | Truncate to highest priority 12, log warning |
| Max customers per card payload | 200 direct IDs | If >200, replace `customerIds` with `cohortFilterSpec` |
| Max flow blueprints | 3 | Truncate to first 3, log warning |
| Max internal alerts | 5 | Truncate to highest severity 5, log warning |

**Prompt Size Caps (Pre-Model)**

| Limit | Value | Strategy |
|-------|-------|----------|
| Max customers in full detail | 100 | Send full detail for top 100 by risk score; summarize rest as cohorts |
| Max cohorts | 20 | Merge smaller cohorts into "other" |
| Max communication history | 30 days | Exclude older records |
| Max template coverage entries | 50 | Include only active templates |
| Target prompt tokens | ~4000 | Context assembler should compress to stay within Gemini context limits |

### 7.8 Example Output

```json
{
  "planVersion": "home-brain-v1",
  "generatedAt": "2026-03-08T12:00:00.000Z",
  "contextVersion": "ctx_20260308_120000",
  "reasoningSummary": "Priority is concentrated in overdue Hebrew-speaking customers with repeated WhatsApp non-response.",
  "dashboard": {
    "title": "Today's Collection Focus",
    "kpis": [
      { "key": "total_overdue_balance", "label": "Total overdue", "value": 2485000, "format": "currency" }
    ],
    "queues": [
      {
        "queueId": "high_risk_hebrew_nonresponsive",
        "title": "High-risk Hebrew speakers with no WhatsApp response",
        "count": 34,
        "customerIds": ["uuid1", "uuid2"]
      }
    ],
    "filters": [],
    "groupings": []
  },
  "cards": [
    {
      "cardId": "card_1",
      "type": "bulk_action",
      "title": "Switch 34 non-responsive customers from WhatsApp to SMS",
      "body": "Customers in this cohort have open balances and failed to engage on WhatsApp.",
      "priority": "high",
      "badges": ["34 customers", "Hebrew", "Overdue >14d"],
      "targetCustomerIds": ["uuid1", "uuid2"],
      "actionIntentIds": ["intent_1"],
      "explainability": {
        "whyNow": "Repeated WhatsApp non-response increases collection delay.",
        "keySignals": ["overdue>14", "whatsapp_failed", "phone_available"]
      }
    }
  ],
  "flowBlueprints": [],
  "actionIntents": [
    {
      "id": "intent_1",
      "type": "send_bulk_reminders",
      "title": "Send SMS reminders to cohort",
      "requiresApproval": true,
      "payload": {
        "customerIds": ["uuid1", "uuid2"],
        "overrideChannel": "sms",
        "overrideLanguage": "he",
        "overrideTone": "medium",
        "templateKey": "debt_reminder"
      }
    }
  ],
  "internalAlerts": []
}
```

---

## 8. Data Model

### 8.1 New Enum: `AiPlanStatus`

```prisma
enum AiPlanStatus {
  generated
  approved
  modified
  skipped
  resolved
  failed
  expired
}
```

### 8.2 New Model: `AiPlanSnapshot`

Stores the generated Home plan plus a sanitized context summary.

```prisma
model AiPlanSnapshot {
  id              String       @id @default(uuid()) @db.Uuid
  surface         String       // e.g. "home"
  promptVersion   String       @map("prompt_version")
  contextVersion  String       @map("context_version")
  locale          String
  filtersJson     Json?        @map("filters_json")
  contextSummary  Json         @map("context_summary")
  outputJson      Json         @map("output_json")
  reasoningSummary String?     @map("reasoning_summary")
  status          AiPlanStatus @default(generated)
  generatedBy     String       @map("generated_by")
  createdAt       DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime     @updatedAt @map("updated_at") @db.Timestamptz

  actions AiPlanAction[]

  @@index([surface, createdAt])
  @@index([status])
  @@map("ai_plan_snapshots")
}
```

### 8.3 New Model: `AiPlanAction`

Stores the outcome of approving, modifying, skipping, or resolving a card / intent.

```prisma
model AiPlanAction {
  id              String       @id @default(uuid()) @db.Uuid
  planId          String       @map("plan_id") @db.Uuid
  cardId          String       @map("card_id")
  intentId        String?      @map("intent_id")
  actionType      String       @map("action_type")
  status          AiPlanStatus @default(generated)
  modifiedPayload Json?        @map("modified_payload")
  executionResult Json?        @map("execution_result")
  performedBy     String       @map("performed_by")
  createdAt       DateTime     @default(now()) @map("created_at") @db.Timestamptz

  plan AiPlanSnapshot @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@index([planId])
  @@index([cardId])
  @@map("ai_plan_actions")
}
```

### 8.4 New Model: `InternalAlert`

Required for management notifications that should outlive a transient Home card.

```prisma
model InternalAlert {
  id          String   @id @default(uuid()) @db.Uuid
  severity    String
  title       String
  body        String   @db.Text
  audience    String   // e.g. "management", "operations"
  metadata    Json?
  status      String   @default("open")
  createdBy   String   @map("created_by")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@index([audience, status])
  @@map("internal_alerts")
}
```

### 8.5 V1 Data Model Decisions

| Model | Required for V1? | Rationale |
|-------|------------------|-----------|
| `AiPlanSnapshot` | **Yes** | Core audit requirement; stores generated plans |
| `AiPlanAction` | **Yes** | Tracks approve/modify/skip/resolve outcomes |
| `InternalAlert` | **Yes** | Required for management notification cards |
| `AiPlanStatus` enum | **Yes** | Used by both snapshot and action models |

**Alternative considered:** Using existing `ActivityLog` for audit. Rejected because:
- `ActivityType` enum is limited to three values (`notification_sent`, `chat_prompt`, `collection_flow_created`)
- `ActivityLog` lacks structured fields for plan output, card references, and modification payloads
- Adding new enum values would be more invasive than a dedicated table

### 8.6 Migration Notes

These additions are additive and do not change existing flow or messaging tables. The migration should:

1. Add `AiPlanStatus` enum
2. Create `ai_plan_snapshots` table
3. Create `ai_plan_actions` table
4. Create `internal_alerts` table
5. Add indexes as specified

No foreign keys to existing tables except soft references via `customerId` in action payloads.

---

## 9. Backend API Design

### 9.1 `POST /api/home-brain/plan`

Generate a Home plan from live system context.

**Request**

```typescript
interface GeneratePlanRequest {
  locale: 'en' | 'he';
  filters?: {
    segment?: 'all' | 'high_risk' | 'overdue' | 'no_response';
    language?: 'en' | 'he' | 'ar';
    minOverdueDays?: number;
  };
  forceRefresh?: boolean;
  maxCards?: number; // default 8, max 12
}
```

**Success Response**

```typescript
interface GeneratePlanResponse {
  success: true;
  data: {
    planId: string;
    status: 'generated';
    plan: HomeBrainPlan;
    cachedAt?: string; // present if returning cached plan
  };
}
```

**Error Responses**

| Scenario | HTTP Status | Response Shape |
|----------|-------------|----------------|
| Zod validation failure (request) | 400 | `{ success: false, error: "Invalid request: <details>" }` |
| Model call failure | 502 | `{ success: false, error: "AI service unavailable", fallback: <lastGoodPlan or null> }` |
| Model output validation failure | 500 | `{ success: false, error: "AI output validation failed", fallback: <lastGoodPlan or null> }` |
| No urgent recommendations | 200 | `{ success: true, data: { planId, status: "generated", plan: <emptyPlan> } }` |

**Fallback Behavior**

1. If `forceRefresh` is false and a valid plan exists for the same filters within 1 hour, return cached plan
2. If model call fails, return last-good plan with `cachedAt` timestamp if available
3. If no last-good plan exists, return empty plan structure with `reasoningSummary: "Unable to generate recommendations at this time"`

**Empty Plan Structure**

```typescript
const emptyPlan: HomeBrainPlan = {
  planVersion: 'home-brain-v1',
  generatedAt: new Date().toISOString(),
  contextVersion: 'empty',
  reasoningSummary: 'No urgent actions recommended at this time.',
  dashboard: { title: 'Home', kpis: [], queues: [], filters: [], groupings: [] },
  cards: [],
  flowBlueprints: [],
  actionIntents: [],
  internalAlerts: [],
};
```

### 9.2 `GET /api/home-brain/plans/:id`

Fetch a persisted plan snapshot for refresh / audit / revisit flows.

### 9.3 `POST /api/home-brain/cards/:cardId/approve`

Approve and execute the primary action for a card.

**Request**

```json
{
  "planId": "uuid",
  "performedBy": "ui",
  "modifications": {
    "overrideChannel": "sms",
    "overrideTone": "medium"
  }
}
```

**Execution behavior**

| Card / intent type | Execution path |
|--------------------|----------------|
| `send_bulk_reminders` | Existing messaging bulk-send path |
| `switch_channel_for_cohort` | Existing messaging bulk-send with override channel |
| `materialize_collection_flow` | New flow materializer + existing `flow-definition.service.ts` |
| `assign_flow_to_customers` | Existing `flow-runtime.service.ts` |
| `notify_management` | New `InternalAlert` persistence |
| `create_internal_alert` | New `InternalAlert` persistence |

### 9.4 `POST /api/home-brain/cards/:cardId/skip`

Persist skip outcome with optional reason.

### 9.5 `POST /api/home-brain/cards/:cardId/resolve`

Mark the card resolved without executing a side effect.

### 9.6 `POST /api/home-brain/cards/:cardId/modify`

Persist user changes to the generated payload and optionally preview the updated execution result.

### 9.7 Controller / Route Layout

```
server/src/controllers/home-brain.controller.ts   # NEW
server/src/routes/home-brain.routes.ts            # NEW
server/src/routes/index.ts                        # UPDATED
server/src/services/home-brain/                   # NEW DIRECTORY
```

---

## 10. Flow Blueprint Materialization

The AI should not write directly into `CollectionFlow` tables. Instead, the server converts a validated blueprint into a draft flow definition.

### 10.1 Schema Mapping (Blueprint to CollectionFlowState)

The existing `CollectionFlowState` schema supports only a subset of blueprint fields. The materializer must map accordingly:

| Blueprint Field | Persisted in `CollectionFlowState` | Notes |
|-----------------|-----------------------------------|-------|
| `stepKey` | `stateKey` | Direct map |
| `actionType` | `actionType` | Direct map (enum values match) |
| `explicitChannel` | `explicitChannel` | Direct map |
| `tone` | `tone` | Direct map |
| `dayOffset` | N/A | Used to compute transition `waitSeconds` |
| `languageMode` | **Not persisted** | Transient; executor uses customer preference |
| `language` | **Not persisted** | Transient; log in flow description for audit |
| `toneMode` | **Not persisted** | Transient; tone field captures explicit value |
| `templateKey` | **Not persisted** | Executor currently hardcodes `debt_reminder`; log in description |
| `expectedOutcome` | **Not persisted** | Log in flow description for audit |
| `fallbackRule` | **Not persisted** | Log in flow description for audit |

**Implication:** The flow executor will use `debt_reminder` template regardless of AI suggestion until executor changes are made (out of v1 scope). Blueprint-specific template/language/fallback are recorded in the flow description for audit and future enhancement.

### 10.2 Translation Rules

For each blueprint step:

- create one `CollectionFlowState`
- set `stateKey` from `stepKey`
- set `stateName` and `actionName` derived from step context (e.g., "Day 3 WhatsApp")
- set `actionType` based on blueprint `actionType`
- set `explicitChannel` when provided
- set `tone` when explicit
- set `positionX`, `positionY` for visual layout (optional; use auto-layout)
- create a transition from previous step using `waitSeconds = delta(dayOffset) * 86400`

### 10.3 Start / End Rules

- First step becomes `isStart = true`
- Final step becomes `isEnd = true`
- Add a terminal state with `actionType: 'none'` if the blueprint omits an explicit end

### 10.4 Materialized Flow Metadata

Draft flow records should use:

- `flowKey`: `ai_generated_<timestamp>`
- `version`: `1`
- `name`: Blueprint `name`
- `description`: JSON stringified object containing `{ planId, cardId, blueprintId, originalSteps: <blueprint steps with all fields for audit> }`
- `status`: `'draft'`
- `createdBy`: `'home_brain'`

### 10.5 Assignment Strategy (V1 Default)

On approval of a `materialize_collection_flow` intent:

1. Create draft `CollectionFlow` via `flow-definition.service.ts`
2. **Do not publish or assign automatically**
3. Return the draft flow ID to the UI
4. User must explicitly publish via Flows page and then assign

This matches the constraint that `flow-runtime.service.ts` only assigns published flows.

**Future enhancement:** Add `autoPublish` and `autoAssign` flags to the intent payload, with appropriate safeguards, if product wants faster execution.

---

## 11. Home UI Design

### 11.1 Replace Static `HomePage`

`client/src/pages/HomePage.tsx` should become a data-driven screen that:

- loads a Home plan on mount
- supports refresh and filter changes
- renders AI-defined KPIs, queues, and cards
- exposes approve / modify / skip / resolve interactions
- shows short explainability copy for every card

### 11.2 Required Sections

1. **Header / context banner**
   - current mode
   - refresh time
   - selected filters

2. **KPI rail**
   - AI-defined KPI cards

3. **Priority queues**
   - list of cohorts with count, reason, CTA

4. **Recommendation cards**
   - primary actions
   - reason summary
   - approval controls

5. **Alerts / management digest**
   - internal notifications generated by AI

6. **Card details drawer**
   - show explainability
   - preview affected customers
   - allow modifications before approval

### 11.3 UX Behavior

For every recommendation card, the user can:

- **Approve**: execute or materialize the action
- **Modify**: change channel / tone / language / target size / timing
- **Skip**: dismiss but keep audit trail
- **Mark resolved**: keep the card in history as completed

### 11.4 Lovable Parity Note

The SCRUM-12 requirement says the Home UI should match Lovable behavior. This repo does not include a canonical Lovable implementation for Home. The implementation agent should therefore:

1. reproduce the intended interaction model from the ticket
2. keep the layout modular for later visual polish
3. flag any remaining parity gaps as design-review issues rather than inventing hidden behavior

### 11.5 UI State Ownership

| State | Location | Lifecycle |
|-------|----------|-----------|
| Current plan | Local component state (`useState`) | Fetched on mount, refreshed on filter change or manual refresh |
| Selected filters | URL query params | Enables shareable/bookmarkable Home views |
| Card expansion state | Local component state | Resets on plan refresh |
| Drawer open/content | Local component state | Resets on drawer close |
| Skipped/resolved cards | Server-side (`AiPlanAction`) | Persist across sessions |
| Chat panel visibility | `ChatVisibilityContext` | Home sets `setChatHidden(true)` on mount |

**Request Lifecycle**

```mermaid
sequenceDiagram
    participant User
    participant HomePage
    participant API
    participant HomeBrainService
    participant Gemini
    participant DB

    User->>HomePage: Navigate to /
    HomePage->>HomePage: setChatHidden(true)
    HomePage->>API: POST /api/home-brain/plan
    API->>HomeBrainService: generatePlan(filters)
    HomeBrainService->>DB: Assemble context
    HomeBrainService->>Gemini: Generate plan
    Gemini-->>HomeBrainService: JSON response
    HomeBrainService->>HomeBrainService: Validate with Zod
    HomeBrainService->>DB: Persist AiPlanSnapshot
    HomeBrainService-->>API: HomeBrainPlan
    API-->>HomePage: { planId, plan }
    HomePage->>HomePage: Render KPIs, queues, cards
```

### 11.6 Component Boundaries

Based on current client structure, the following component organization is recommended:

| Component | Responsibility | Reuses From |
|-----------|----------------|-------------|
| `client/src/pages/HomePage.tsx` | Page container, plan fetching, filter state, layout | Existing page shell |
| `client/src/components/home/HomeBrainProvider.tsx` | Plan state context, refresh logic | New |
| `client/src/components/home/AiKpiRail.tsx` | Render KPI cards | `client/src/components/Dashboard/StatCard.tsx` |
| `client/src/components/home/PriorityQueues.tsx` | Render queue list with counts and CTAs | New |
| `client/src/components/home/RecommendationCard.tsx` | Single card with actions | New |
| `client/src/components/home/CardDetailDrawer.tsx` | Drawer for modify/preview/approve | New |
| `client/src/components/home/InternalAlertsList.tsx` | Management alerts section | New |
| `client/src/services/api.ts` | Add `homeBrain` namespace with API methods | Existing `apiFetch` pattern |
| `client/src/types/home-brain.ts` | TypeScript interfaces matching server contracts | New |

**API Client Additions (in `api.ts`)**

```typescript
export const homeBrain = {
  generatePlan: (request: GeneratePlanRequest) =>
    apiFetch<GeneratePlanResponse>('/home-brain/plan', { method: 'POST', body: JSON.stringify(request) }),
  
  getPlan: (planId: string) =>
    apiFetch<{ plan: HomeBrainPlan }>(`/home-brain/plans/${planId}`),
  
  approveCard: (cardId: string, request: ApproveCardRequest) =>
    apiFetch<ApproveCardResponse>(`/home-brain/cards/${cardId}/approve`, { method: 'POST', body: JSON.stringify(request) }),
  
  skipCard: (cardId: string, request: SkipCardRequest) =>
    apiFetch<void>(`/home-brain/cards/${cardId}/skip`, { method: 'POST', body: JSON.stringify(request) }),
  
  resolveCard: (cardId: string, request: ResolveCardRequest) =>
    apiFetch<void>(`/home-brain/cards/${cardId}/resolve`, { method: 'POST', body: JSON.stringify(request) }),
  
  modifyCard: (cardId: string, request: ModifyCardRequest) =>
    apiFetch<ModifyCardResponse>(`/home-brain/cards/${cardId}/modify`, { method: 'POST', body: JSON.stringify(request) }),
};
```

### 11.7 Localization Constraints

| Aspect | V1 Support | Notes |
|--------|------------|-------|
| Home UI strings | `en`, `he` | Use existing i18n infrastructure |
| AI-generated card titles/body | Model returns in requested locale | Pass `locale` in plan request |
| Arabic UI | **Not supported in v1** | `client/src/i18n/locales/ar.json` does not exist |
| RTL support | Existing | `LanguageContext` handles RTL for Hebrew |

**Recommendation:** AI should return card content in the requested locale (`en` or `he`). Do not request Arabic locale from the model until client i18n supports it.

---

## 12. Context Assembly Design

### 12.1 Context Inputs

Build a compact context object with:

- system mode
- total active customers
- overdue balance totals
- high-risk cohort counts
- recent deliveries by channel and outcome
- channel provider availability
- template coverage by channel / language / tone
- top candidate cohorts
- top candidate customers for urgent cards
- currently published default flow
- current Home filter state

### 12.2 Suggested Context DTO

```typescript
interface HomeBrainContext {
  generatedAt: string;
  mode: 'demo' | 'development' | 'production';
  filters: Record<string, unknown>;
  metrics: {
    totalCustomers: number;
    totalOverdueBalance: number;
    collectedToday: number;
    overdueCustomers: number;
  };
  channelAvailability: Record<string, boolean>;
  templateCoverage: Array<{
    channel: string;
    language: string;
    tone: string;
    available: boolean;
  }>;
  cohorts: Array<{
    cohortId: string;
    label: string;
    count: number;
    totalBalance: number;
    avgOverdueDays: number;
    languages: string[];
    recommendedChannelOptions: string[];
    riskLevel: 'critical' | 'high' | 'medium' | 'low';
    sampleCustomerIds: string[];
  }>;
  customers: Array<{
    id: string;
    fullName: string;
    balance: number;
    overdueDays: number;
    preferredLanguage?: string | null;
    preferredChannel?: string | null;
    preferredTone?: string | null;
    eligibleChannels: string[];
    recentCommSummary: string[];
    riskScore: number;
  }>;
}
```

### 12.3 Prompt Size Strategy

To keep tokens bounded:

- send full detail for at most 100 customers
- send aggregated cohort summaries for larger groups
- include only recent communications from the last 30 days
- include only active / relevant templates and provider availability

---

## 13. Security, Safety, and Explainability

### 13.1 Safety Rules

- No autonomous send without user approval
- No messaging blocked or opt-out customers
- No unsupported channel recommendations
- No hidden execution; every action must create an audit row

### 13.2 Explainability Requirements

Every card must expose:

- `whyNow`
- key signals used
- targeted customer count
- previewable payload before approval

### 13.3 Prompt / Output Logging

Do not persist raw full prompt text if it risks storing excessive PII. Persist:

- prompt version
- compact context summary
- validated AI output
- user action outcome

---

## 14. File Reference Summary

### Files to Create

| File | Purpose |
|------|---------|
| `server/src/controllers/home-brain.controller.ts` | Home Brain generate / approve / skip / modify / resolve endpoints |
| `server/src/routes/home-brain.routes.ts` | Route registration |
| `server/src/services/home-brain/context-assembler.service.ts` | Build live summarized system context |
| `server/src/services/home-brain/home-brain.service.ts` | Prompting, validation, persistence orchestration |
| `server/src/services/home-brain/plan-validator.ts` | Zod schema + business validation |
| `server/src/services/home-brain/flow-materializer.service.ts` | Convert AI blueprint to `CollectionFlow` draft |
| `client/src/types/home-brain.ts` | Shared client-side types |
| `client/src/components/home/AiKpiRail.tsx` | KPI renderer |
| `client/src/components/home/PriorityQueues.tsx` | Queue renderer |
| `client/src/components/home/RecommendationCard.tsx` | AI card UI |
| `client/src/components/home/CardDetailDrawer.tsx` | Modify / approve UX |

### Files to Modify

| File | Changes |
|------|---------|
| `server/prisma/schema.prisma` | Add `AiPlanSnapshot`, `AiPlanAction`, `InternalAlert`, `AiPlanStatus` |
| `server/src/routes/index.ts` | Register Home Brain routes |
| `server/src/services/ai.service.ts` | Reuse model init patterns or extract shared model client if helpful |
| `server/src/controllers/messaging.controller.ts` | Reuse bulk-send execution path where useful |
| `server/src/services/notification-dispatch.service.ts` | Possibly expose preview helpers / shared validation |
| `client/src/pages/HomePage.tsx` | Replace static content with plan-driven Home screen |
| `client/src/services/api.ts` | Add Home Brain API client methods |

---

## 15. Implementation Phases

### Phase 1: Backend Foundation

- Add Prisma models and migration
- Build context assembler
- Build prompt builder and validator
- Add `POST /api/home-brain/plan`

### Phase 2: Home Rendering

- Replace static Home page
- Render KPI rail, queues, and recommendation cards
- Add refresh and filter handling

### Phase 3: Action Execution

- Implement approve / modify / skip / resolve endpoints
- Connect bulk reminder execution
- Connect internal alert creation

### Phase 4: Flow Materialization

- Convert AI flow blueprints into draft `CollectionFlow` definitions
- Add optional publish / assign path

### Phase 5: Polish and Safety

- Improve explainability UI
- Add caching / last-good plan fallback
- Finalize error states and skeleton loading

---

## 16. Testing Strategy

### 16.1 Unit Tests

| Component | Test Cases |
|-----------|------------|
| `context-assembler.service.ts` | correct cohort summaries, risk flags, channel eligibility |
| `plan-validator.ts` | rejects invalid JSON, invalid card references, unavailable channels |
| `flow-materializer.service.ts` | step-to-state translation, wait-seconds calculation, start/end correctness |
| deterministic rule helpers | blocked / opt-out exclusion, template availability checks |

### 16.2 Integration Tests

| Endpoint | Test Cases |
|----------|------------|
| `POST /api/home-brain/plan` | returns validated plan using mocked AI output |
| `POST /api/home-brain/cards/:cardId/approve` | executes correct backend path |
| `POST /api/home-brain/cards/:cardId/modify` | persists modified payload |
| `POST /api/home-brain/cards/:cardId/skip` | updates audit status |
| `POST /api/home-brain/cards/:cardId/resolve` | updates audit status |

### 16.3 End-to-End Tests

1. Load Home page with live seeded data and verify AI-generated KPIs / queues / cards render
2. Approve a bulk reminder card and verify notifications / deliveries are created
3. Approve a flow blueprint and verify a draft `CollectionFlow` is created
4. Create a management alert card and verify `InternalAlert` persistence
5. Modify a recommendation before approval and verify execution uses modified values

### 16.4 Manual QA Checklist

- [ ] Home page loads from `POST /api/home-brain/plan`, not hardcoded arrays
- [ ] Cards show explainability text
- [ ] Approve / Modify / Skip / Resolve work and remain auditable
- [ ] AI never targets blocked or opt-out customers
- [ ] AI never recommends unavailable channels
- [ ] Generated flow blueprints materialize into valid draft flows
- [ ] Refresh regenerates or reloads the latest valid plan
- [ ] Empty-state behavior is clear when no urgent actions exist

### 16.5 AI Testing Recommendation

For automated tests, mock the Gemini response. Do not call the live model in CI.

---

## 17. Rollout Plan

### Phase A: Safe Read-Only Home

Ship plan generation and rendering first with no side-effect approvals enabled.

### Phase B: Controlled Action Execution

Enable bulk reminder approvals and internal alerts.

### Phase C: Flow Materialization

Enable AI-generated flow drafts and optional assignment.

### Phase D: Full Home Brain

Enable all card types after validation with real operators.

---

## 18. Resolved Defaults for V1

The following questions from the original draft have been resolved with implementation defaults:

| Original Question | V1 Resolution |
|-------------------|---------------|
| Should approving a generated flow immediately publish and assign it? | **No.** Create draft only; require explicit publish via Flows page |
| Where should management alerts surface? | **Home cards only** for v1; no email/Slack integration |
| Which default language should Home Brain use? | **English (`en`)** as system default; respect `preferredLanguage` when available |
| How long should generated cards stay active? | **24 hours** or until next refresh, whichever comes first |
| What is the safe maximum customer count per bulk recommendation? | **200 direct IDs**; larger cohorts use filter spec |
| Should prompt versions be database-backed? | **No.** Code constants in `home-brain.service.ts` for v1 |
| What does "switch channel" mean operationally? | **Temporary send override** for this action only; does not persist `Customer.preferredChannel` |
| How should "non-response" be determined? | **Delivery status** from `NotificationDelivery` and `VoiceCallLog`; no inbound reply model |

---

## 19. Still-Blocking Decisions (Need Product Input)

The following decisions cannot be safely defaulted by an implementation agent and require explicit product team input:

| Decision | Options | Impact |
|----------|---------|--------|
| **Lovable reference assets** | Provide Figma/screenshots or accept interaction-model-only parity | Visual fidelity of Home UI |
| **Arabic UI support timeline** | Add `ar.json` now or defer | Whether AI can recommend Arabic messaging in v1 |
| **Auto-publish flows** | Allow with safeguard flag or always require manual publish | Speed vs control for AI-generated flows |
| **Multi-flow assignment batch API** | Build dedicated batch endpoint or accept loop | Performance for large `assign_flow_to_customers` intents |
| **Per-step template selection** | Expand executor to use step-level templateKey or keep hardcoded | Fidelity of AI flow blueprints |

If product does not provide input, the implementation agent should proceed with the conservative defaults documented in this spec.

---

## 20. AI Agent Handoff Checklist

Before starting implementation, verify the following:

### Files to Reuse (Copy Patterns From)

| Pattern | Source File | What to Copy |
|---------|-------------|--------------|
| Gemini client initialization | `server/src/services/ai.service.ts` | `GoogleGenerativeAI` setup, `responseMimeType: 'application/json'` |
| Zod validation in controller | `server/src/controllers/flows.controller.ts` | Schema definition and `safeParse` pattern |
| DTO/input interfaces | `server/src/services/flow-definition.service.ts` | Interface definitions colocated with service |
| Activity logging | `server/src/services/activity.service.ts` | `logNotification`, `logChatPrompt` patterns |
| API envelope pattern | `client/src/services/api.ts` | `apiFetch<T>` wrapper |
| Dashboard components | `client/src/components/Dashboard/StatCard.tsx` | Visual primitives for KPIs |
| Flow visualization | `client/src/components/FlowBuilder/FlowDiagramView.tsx` | Read-only flow preview |
| i18n usage | `client/src/pages/HomePage.tsx` | `useTranslation` hook pattern |
| Chat visibility control | `client/src/context/ChatVisibilityContext.tsx` | `useChatVisibility` hook |

### Files to Create

| File | Purpose |
|------|---------|
| `server/src/controllers/home-brain.controller.ts` | All Home Brain endpoints |
| `server/src/routes/home-brain.routes.ts` | Route registration |
| `server/src/services/home-brain/context-assembler.service.ts` | Build bounded context DTO |
| `server/src/services/home-brain/home-brain.service.ts` | Orchestrate prompt, validation, persistence |
| `server/src/services/home-brain/plan-validator.ts` | Zod schemas for AI output |
| `server/src/services/home-brain/flow-materializer.service.ts` | Blueprint to CollectionFlow conversion |
| `server/prisma/migrations/YYYYMMDD_add_home_brain_tables/migration.sql` | Schema additions |
| `client/src/types/home-brain.ts` | Shared TypeScript interfaces |
| `client/src/components/home/` | All Home Brain UI components |

### Files to Modify

| File | Changes |
|------|---------|
| `server/prisma/schema.prisma` | Add `AiPlanStatus`, `AiPlanSnapshot`, `AiPlanAction`, `InternalAlert` |
| `server/src/routes/index.ts` | Register `/api/home-brain` routes |
| `client/src/pages/HomePage.tsx` | Replace static content with plan-driven rendering |
| `client/src/services/api.ts` | Add `homeBrain` API methods |

### Assumptions the Agent Must NOT Invent

1. **Do not** assume batch flow assignment API exists - use loop over single-customer calls
2. **Do not** assume executor respects per-step templateKey - it uses `debt_reminder`
3. **Do not** assume Arabic UI support - only `en` and `he` are available
4. **Do not** assume inbound reply tracking - derive non-response from delivery status only
5. **Do not** assume auto-publish for AI-generated flows - always create as draft
6. **Do not** assume management alerts have email/Slack delivery - Home cards only
7. **Do not** invent Lovable visual behavior not described in this document
8. **Do not** assume auth/user context exists - use placeholder actor values

### Pre-Implementation Verification

Before writing code, the agent should:

1. Run `npx prisma generate` to verify current schema
2. Run `cd server && npx tsc --noEmit` to verify server compiles
3. Run `cd client && npm run lint` to understand existing lint baseline
4. Read `server/src/services/ai.service.ts` to understand existing Gemini patterns
5. Read `server/src/services/flow-definition.service.ts` to understand flow creation API

---

## 21. Final Recommendation

Implement SCRUM-12 as a **new AI orchestration layer on top of the existing messaging and flow infrastructure**, not as a separate chatbot or a parallel workflow engine. The core design principle is:

**AI decides what the product should show and recommend; deterministic services decide what is allowed and how execution happens.**

That split will keep the feature explainable, auditable, and implementable with the codebase that already exists.

### Key Implementation Principles

1. **Reuse first**: Every service call should go through existing infrastructure (`notification-dispatch.service.ts`, `flow-definition.service.ts`, `flow-runtime.service.ts`)
2. **Validate always**: Every AI output must pass Zod validation before use
3. **Audit everything**: Every plan generation and card action must create a database record
4. **Fail safe**: On model failure, return cached plan or empty state - never expose raw errors to users
5. **Explain clearly**: Every recommendation card must have `whyNow` and `keySignals` visible in UI

---

*End of Design Document*

**Document Version:** 1.1  
**Last Updated:** March 9, 2026  
**Changes from v1.0:**
- Added Source of Truth, Implementation Defaults, and Repo Constraints sections
- Tightened API contracts with typed payloads and error handling
- Added per-intent editable fields for Modify action
- Added schema mapping for flow materialization
- Added UI state ownership and component boundaries
- Replaced Open Questions with Resolved Defaults and Still-Blocking Decisions
- Added AI Agent Handoff Checklist
