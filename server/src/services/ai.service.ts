import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database';
import { AppError } from '../types';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

type SupportedLanguage = 'en' | 'he';

const EXPLANATION_FALLBACK: Record<SupportedLanguage, string> = {
  en: 'Query executed successfully',
  he: 'השאילתה בוצעה בהצלחה',
};

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = {
  en: 'English',
  he: 'Hebrew',
};

const HEBREW_REGEX = /[\u0590-\u05FF]/;
const LATIN_REGEX = /[A-Za-z]/;

function detectPromptLanguage(text: string): SupportedLanguage {
  return HEBREW_REGEX.test(text) ? 'he' : 'en';
}

function needsTranslation(text: string, targetLanguage: SupportedLanguage): boolean {
  if (!text || !text.trim()) return false;
  if (targetLanguage === 'he') {
    return !HEBREW_REGEX.test(text);
  }
  if (targetLanguage === 'en') {
    return HEBREW_REGEX.test(text) && !LATIN_REGEX.test(text);
  }
  return false;
}

// Database schema context for the AI
// IMPORTANT: All field names use camelCase (Prisma convention), NOT snake_case
const DATABASE_SCHEMA = `
You have access to a PostgreSQL database for a debt collection system via Prisma ORM.

CRITICAL: All field names MUST be in camelCase (e.g., createdAt, fullName, customerId), NOT snake_case!

TABLES (Prisma models):

1. customer - People/companies being collected from
   - id (uuid, PK)
   - externalRef (string, unique, optional)
   - fullName (string)
   - phone (string, optional)
   - email (string, optional)
   - status (enum: 'active', 'do_not_contact', 'blocked')
   - createdAt (timestamp)
   - updatedAt (timestamp)
   - debts (relation to debt[])
   - payments (relation to payment[])
   - notifications (relation to notification[])

2. debt - Obligations (invoice/loan/contract) for a customer
   - id (uuid, PK)
   - customerId (uuid, FK to customer)
   - originalAmount (decimal)
   - currency (char 3)
   - currentBalance (decimal)
   - status (enum: 'open', 'in_collection', 'settled', 'written_off', 'disputed')
   - openedAt (timestamp)
   - closedAt (timestamp, optional)
   - createdAt (timestamp)
   - updatedAt (timestamp)
   - customer (relation to customer)
   - installments (relation to installment[])
   - payments (relation to payment[])

3. installment - Scheduled due items under a debt
   - id (uuid, PK)
   - debtId (uuid, FK to debt)
   - sequenceNo (int)
   - dueDate (date)
   - amountDue (decimal)
   - amountPaid (decimal, default 0)
   - status (enum: 'due', 'overdue', 'partially_paid', 'paid', 'canceled')
   - createdAt (timestamp)
   - updatedAt (timestamp)
   - debt (relation to debt)

4. payment - Actual payment transactions received
   - id (uuid, PK)
   - customerId (uuid, FK to customer)
   - debtId (uuid, FK to debt, optional)
   - receivedAt (timestamp)
   - amount (decimal)
   - currency (char 3)
   - method (enum: 'bank_transfer', 'card', 'cash', 'check', 'other')
   - providerTxnId (string, unique, optional)
   - status (enum: 'received', 'reversed', 'failed')
   - createdAt (timestamp)
   - updatedAt (timestamp)
   - customer (relation to customer)
   - debt (relation to debt, optional)

5. notification - Messages sent to customers
   - id (uuid, PK)
   - customerId (uuid, FK to customer)
   - debtId (uuid, FK to debt, optional)
   - installmentId (uuid, FK to installment, optional)
   - channel (enum: 'sms', 'email', 'whatsapp', 'call_task')
   - templateKey (string)
   - createdBy (string)
   - createdAt (timestamp)
   - customer (relation to customer)
   - debt (relation to debt, optional)
   - installment (relation to installment, optional)

6. notificationDelivery - Delivery attempts for notifications
   - id (uuid, PK)
   - notificationId (uuid, FK to notification)
   - attemptNo (int)
   - provider (string)
   - status (enum: 'queued', 'sent', 'delivered', 'failed')
   - errorCode (string, optional)
   - errorMessage (string, optional)
   - sentAt (timestamp, optional)
   - createdAt (timestamp)
   - notification (relation to notification)
`;

const SYSTEM_PROMPT = `You are a database query assistant for a debt collection system. Your role is to convert natural language questions about the data into valid Prisma query objects.

${DATABASE_SCHEMA}

IMPORTANT RULES:
1. Return ONLY a valid JSON object with Prisma query structure - no explanations, no markdown, no code blocks
2. The response must be parseable JSON - do NOT wrap in \`\`\`json or any other formatting
3. Use Prisma's query syntax (where, include, orderBy, take, skip, select, etc.)
4. CRITICAL: ALL field names must be in camelCase (createdAt, fullName, customerId) - NEVER use snake_case!
5. For date calculations, I'll provide you with the current date
6. Always include relevant related data when it makes sense
7. Limit results to 100 by default unless specified
8. Return results sorted by most relevant field (usually createdAt desc)
9. The "explanation" field MUST be in the same language as the user's question
10. Do NOT translate JSON keys, model names, or Prisma field names

The JSON response should have this structure:
{
  "model": "customer" | "debt" | "installment" | "payment" | "notification",
  "operation": "findMany" | "findFirst" | "count" | "aggregate" | "groupBy" | "rawQuery",
  "args": { /* Prisma query arguments with camelCase field names, OR { "sql": "SELECT ..." } for rawQuery */ },
  "explanation": "Brief explanation of what this query does"
}

EXAMPLES:

User: "Show all active customers"
Response:
{
  "model": "customer",
  "operation": "findMany",
  "args": {
    "where": { "status": "active" },
    "orderBy": { "createdAt": "desc" },
    "take": 100
  },
  "explanation": "Finds all customers with active status, sorted by creation date"
}

User: "Show all customers overdue by 30 days"
Response:
{
  "model": "customer",
  "operation": "findMany",
  "args": {
    "where": {
      "debts": {
        "some": {
          "installments": {
            "some": {
              "status": "overdue",
              "dueDate": { "lte": "{{DATE_30_DAYS_AGO}}" }
            }
          }
        }
      }
    },
    "include": {
      "debts": {
        "include": {
          "installments": {
            "where": { "status": "overdue" }
          }
        }
      }
    },
    "orderBy": { "createdAt": "desc" },
    "take": 100
  },
  "explanation": "Finds customers who have at least one installment overdue by 30+ days"
}

User: "Total amount owed by all customers"
Response:
{
  "model": "debt",
  "operation": "aggregate",
  "args": {
    "_sum": { "currentBalance": true },
    "where": { "status": { "in": ["open", "in_collection"] } }
  },
  "explanation": "Calculates total current balance of all open/in-collection debts"
}

User: "Count of payments this month"
Response:
{
  "model": "payment",
  "operation": "count",
  "args": {
    "where": {
      "receivedAt": { "gte": "{{START_OF_MONTH}}" },
      "status": "received"
    }
  },
  "explanation": "Counts all received payments since the start of the current month"
}

IMPORTANT: For queries that require aggregating across relations (like "top customers by total balance"), 
use the "rawQuery" operation with raw SQL. The database uses snake_case column names and PLURAL table names:
- customers (not customer)
- debts (not debt)
- installments (not installment)
- payments (not payment)
- notifications (not notification)
- notification_deliveries (not notificationDelivery)

User: "List top 10 customers with highest outstanding balance"
Response:
{
  "model": "customer",
  "operation": "rawQuery",
  "args": {
    "sql": "SELECT c.id, c.full_name, c.phone, c.email, c.status, c.created_at, c.updated_at, COALESCE(SUM(d.current_balance), 0) as total_balance FROM customers c LEFT JOIN debts d ON d.customer_id = c.id AND d.status IN ('open', 'in_collection') GROUP BY c.id ORDER BY total_balance DESC LIMIT 10"
  },
  "explanation": "Gets top 10 customers ranked by their total outstanding debt balance"
}

User: "Show customers with total debt over 5000"
Response:
{
  "model": "customer",
  "operation": "rawQuery",
  "args": {
    "sql": "SELECT c.id, c.full_name, c.phone, c.email, c.status, COALESCE(SUM(d.current_balance), 0) as total_balance FROM customers c LEFT JOIN debts d ON d.customer_id = c.id AND d.status IN ('open', 'in_collection') GROUP BY c.id HAVING COALESCE(SUM(d.current_balance), 0) > 5000 ORDER BY total_balance DESC LIMIT 100"
  },
  "explanation": "Finds customers whose total outstanding balance exceeds 5000"
}
`;

interface PrismaQueryResponse {
  model: 'customer' | 'debt' | 'installment' | 'payment' | 'notification' | 'notificationDelivery';
  operation: 'findMany' | 'findFirst' | 'count' | 'aggregate' | 'groupBy' | 'rawQuery';
  args: Record<string, unknown>;
  explanation: string;
}

// Column mapping interfaces - re-export from import service for consistency
export interface ColumnMapping {
  // Customer fields
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  gender?: string;
  dateOfBirth?: string;
  region?: string;
  religion?: string;
  externalRef?: string;
  // Debt/Payment fields
  debtAmount?: string;
  currency?: string;
  dueDate?: string;
  installmentAmount?: string;
  sequenceNo?: string;
}

export interface ColumnMappingResponse {
  mapping: ColumnMapping;
  confidence: Record<string, number>;
  explanation: string;
}

const MAPPING_SYSTEM_PROMPT = `You are a data mapping assistant for a debt collection system. Map Excel headers to database fields.

TARGET FIELDS:
Customer Info:
- customerName: Full name (REQUIRED)
- customerEmail: Email address
- customerPhone: Phone/mobile number
- gender: Gender (male/female/other)
- dateOfBirth: Date of birth, birthday, DOB
- region: Region, area, location
- religion: Religion
- externalRef: External ID, customer ID, reference number

Payment Info:
- debtAmount: Debt amount, balance, total owed (REQUIRED)
- currency: Currency code (USD, EUR, ILS)
- dueDate: Payment due date
- installmentAmount: Installment/payment amount
- sequenceNo: Sequence/payment number

RULES:
1. Return ONLY valid JSON
2. Map by SEMANTIC MEANING (any language)
3. One header → one field only
4. Skip fields with no match
5. Include confidence (0-1)

FORMAT: {"mapping":{"field":"Header"},"confidence":{"field":0.9},"explanation":"brief"}`;

class AIService {
  /**
   * Process a natural language query about the data
   */
  async query(naturalLanguageQuery: string, language?: SupportedLanguage): Promise<{
    query: string;
    explanation: string;
    results: unknown;
    resultCount: number;
  }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new AppError('Gemini API key not configured', 500);
    }

    const targetLanguage = language || detectPromptLanguage(naturalLanguageQuery);

    // Get current date for date calculations
    const now = new Date();
    const dates = {
      today: now.toISOString().split('T')[0],
      '7_days_ago': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      '30_days_ago': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      '60_days_ago': new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      '90_days_ago': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      'start_of_month': new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      'start_of_year': new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
    };

    const userPrompt = `Current date context:
- Today: ${dates.today}
- 7 days ago: ${dates['7_days_ago']}
- 30 days ago: ${dates['30_days_ago']}
- 60 days ago: ${dates['60_days_ago']}
- 90 days ago: ${dates['90_days_ago']}
- Start of month: ${dates.start_of_month}
- Start of year: ${dates.start_of_year}

Target language for "explanation": ${LANGUAGE_LABEL[targetLanguage]} (${targetLanguage}).
Return the explanation strictly in this language. Do NOT translate JSON keys, model names, or Prisma field names.

User question: "${naturalLanguageQuery}"

Generate the Prisma query JSON (return ONLY valid JSON, no markdown):`;

    try {
      // Get the Gemini model
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1500,
          responseMimeType: 'application/json',
        },
      });

      // Start chat with system context
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: SYSTEM_PROMPT }],
          },
          {
            role: 'model',
            parts: [{ text: 'I understand. I will convert natural language questions about the debt collection database into valid Prisma query JSON objects. I will always use camelCase for all field names (like createdAt, fullName, customerId) and never use snake_case. I will return only valid JSON without any markdown formatting or code blocks.' }],
          },
        ],
      });

      // Send the user's query
      const result = await chat.sendMessage(userPrompt);
      const responseText = result.response.text();

      if (!responseText) {
        throw new AppError('No response from AI model', 500);
      }

      // Parse the AI response - clean up any potential markdown formatting
      let cleanedResponse = responseText.trim();
      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      let queryConfig: PrismaQueryResponse;
      try {
        queryConfig = JSON.parse(cleanedResponse) as PrismaQueryResponse;
      } catch {
        throw new AppError(`Failed to parse AI response as valid JSON: ${cleanedResponse.substring(0, 200)}`, 500);
      }

      // Validate the response structure
      if (!queryConfig.model || !queryConfig.operation || !queryConfig.args) {
        throw new AppError('Invalid query structure from AI', 500);
      }

      // Execute the query
      const results = await this.executeQuery(queryConfig);

      // Get result count
      const resultCount = Array.isArray(results) ? results.length : 1;

      let explanation = queryConfig.explanation?.trim() || EXPLANATION_FALLBACK[targetLanguage];
      const explanationNeedsTranslationInitial = needsTranslation(explanation, targetLanguage);
      let explanationWasTranslated = false;
      if (explanationNeedsTranslationInitial) {
        const translated = await this.translateText(explanation, targetLanguage);
        explanation = translated || EXPLANATION_FALLBACK[targetLanguage];
        explanationWasTranslated = true;
      }
      const explanationNeedsTranslationFinal = needsTranslation(explanation, targetLanguage);
      if (explanationNeedsTranslationFinal) {
        explanation = EXPLANATION_FALLBACK[targetLanguage];
      }

      return {
        query: naturalLanguageQuery,
        explanation,
        results,
        resultCount,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to process query: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Recursively convert ISO date strings to Date objects in query args
   * Prisma requires actual Date objects for DateTime comparisons
   */
  private convertDatesToObjects(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Check if it's a date string (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    if (typeof obj === 'string') {
      // Match ISO date format (with or without time component)
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
      if (isoDateRegex.test(obj)) {
        return new Date(obj);
      }
      return obj;
    }

    // Recursively process arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDatesToObjects(item));
    }

    // Recursively process objects
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = this.convertDatesToObjects(value);
      }
      return result;
    }

    return obj;
  }

  private async translateText(text: string, targetLanguage: SupportedLanguage): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
        },
      });

      const prompt = `You are a translation engine. Translate the following text to ${LANGUAGE_LABEL[targetLanguage]} (${targetLanguage}). 
Return only the translated text, with no quotes, no markdown, and no extra commentary.

Text: "${text}"`;

      const result = await model.generateContent(prompt);
      let responseText = result.response.text();
      if (!responseText) return text;
      responseText = responseText.trim();
      // Strip simple wrapping quotes if the model adds them.
      if ((responseText.startsWith('"') && responseText.endsWith('"')) ||
          (responseText.startsWith('“') && responseText.endsWith('”'))) {
        responseText = responseText.slice(1, -1).trim();
      }
      return responseText || text;
    } catch {
      return text;
    }
  }

  /**
   * Execute a Prisma query based on the AI-generated config
   */
  private async executeQuery(config: PrismaQueryResponse): Promise<unknown> {
    const { model, operation } = config;
    // Convert any date strings to Date objects for Prisma compatibility
    const args = this.convertDatesToObjects(config.args) as Record<string, unknown>;

    // Map model names to Prisma delegates
    const modelMap = {
      customer: prisma.customer,
      debt: prisma.debt,
      installment: prisma.installment,
      payment: prisma.payment,
      notification: prisma.notification,
      notificationDelivery: prisma.notificationDelivery,
    };

    const prismaModel = modelMap[model];
    if (!prismaModel) {
      throw new AppError(`Invalid model: ${model}`, 400);
    }

    // Execute the appropriate operation
    switch (operation) {
      case 'findMany':
        return (prismaModel as typeof prisma.customer).findMany(args as Parameters<typeof prisma.customer.findMany>[0]);
      case 'findFirst':
        return (prismaModel as typeof prisma.customer).findFirst(args as Parameters<typeof prisma.customer.findFirst>[0]);
      case 'count':
        return (prismaModel as typeof prisma.customer).count(args as Parameters<typeof prisma.customer.count>[0]);
      case 'aggregate':
        return (prismaModel as typeof prisma.customer).aggregate(args as Parameters<typeof prisma.customer.aggregate>[0]);
      case 'groupBy':
        // GroupBy has special handling
        return (prismaModel as unknown as { groupBy: (args: unknown) => Promise<unknown> }).groupBy(args);
      case 'rawQuery':
        // Execute raw SQL query for complex aggregations
        return this.executeRawQuery(args);
      default:
        throw new AppError(`Invalid operation: ${operation}`, 400);
    }
  }

  /**
   * Execute a raw SQL query for complex aggregations
   * Only SELECT queries are allowed for safety
   */
  private async executeRawQuery(args: Record<string, unknown>): Promise<unknown> {
    const sql = args.sql as string;
    
    if (!sql) {
      throw new AppError('Raw query requires a sql field', 400);
    }

    // Security: Only allow SELECT queries (read-only)
    const normalizedSql = sql.trim().toLowerCase();
    if (!normalizedSql.startsWith('select')) {
      throw new AppError('Only SELECT queries are allowed for safety', 400);
    }

    // Block dangerous keywords
    const dangerousKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'create', 'grant', 'revoke'];
    for (const keyword of dangerousKeywords) {
      // Check for keyword as a standalone word (not part of column name)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(sql)) {
        throw new AppError(`Dangerous SQL keyword detected: ${keyword}`, 400);
      }
    }

    // Execute the raw query using Prisma's $queryRawUnsafe
    // We use $queryRawUnsafe because the SQL is AI-generated, but we've validated it above
    const results = await prisma.$queryRawUnsafe(sql);
    
    // Convert BigInt values to numbers (Prisma returns BigInt for aggregates)
    return this.convertBigIntsToNumbers(results);
  }

  /**
   * Convert BigInt values to numbers in query results
   * PostgreSQL returns BigInt for COUNT and SUM which JSON.stringify can't handle
   */
  private convertBigIntsToNumbers(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return Number(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertBigIntsToNumbers(item));
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = this.convertBigIntsToNumbers(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * Get suggested queries for the user
   */
  getSuggestedQueries(language?: string): string[] {
    const lang = language === 'he' ? 'he' : 'en';
    if (lang === 'he') {
      return [
        'הצג את כל הלקוחות באיחור של 30 ימים',
        'הצג 10 לקוחות עם היתרה הגבוהה ביותר',
        'כמה תשלומים התקבלו החודש?',
        'הצג לקוחות שמעולם לא ביצעו תשלום',
        'מהו הסכום הכולל שנגבה השנה?',
        'הצג את כל החובות במחלוקת',
        'הצג לקוחות עם סטטוס חסום',
        'מצא תשלומים שמועד פירעונם ב-7 הימים הקרובים',
        'הצג תשלומים אחרונים מעל 1000$',
        'הצג לקוחות עם מספר חובות פתוחים',
      ];
    }
    return [
      'Show all customers overdue by 30 days',
      'List top 10 customers with highest outstanding balance',
      'How many payments were received this month?',
      'Show customers who have never made a payment',
      'What is the total amount collected this year?',
      'List all debts in dispute status',
      'Show customers with blocked status',
      'Find installments due in the next 7 days',
      'Show recent payments over $1000',
      'List customers with multiple open debts',
    ];
  }

  /**
   * Detect column mapping from Excel headers using AI
   */
  async detectColumnMapping(headers: string[]): Promise<ColumnMappingResponse> {
    if (!process.env.GEMINI_API_KEY) {
      throw new AppError('Gemini API key not configured', 500);
    }

    const startTime = Date.now();

    // Compact prompt for faster response
    const prompt = `Map Excel headers to database fields. Headers: ${JSON.stringify(headers)}

Fields:
- customerName: Full name (REQUIRED)
- customerEmail: Email
- customerPhone: Phone number
- gender: Gender (male/female)
- dateOfBirth: Birth date, DOB
- region: Region, area
- religion: Religion
- externalRef: External ID, customer ID
- debtAmount: Debt amount, balance (REQUIRED)
- currency: Currency code
- dueDate: Payment due date
- installmentAmount: Installment amount
- sequenceNo: Sequence number

Return JSON: {"mapping":{"field":"Header"},"confidence":{"field":0.9},"explanation":"brief"}
Map semantically. Any language. Only matched fields.`;

    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          // @ts-expect-error - thinkingConfig is valid for Gemini 2.5 models
          thinkingConfig: { thinkingBudget: 0 }, // Disable thinking mode for faster response
        },
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      console.log(`AI mapping completed in ${Date.now() - startTime}ms`); // Performance log

      if (!responseText) {
        throw new AppError('No response from AI model', 500);
      }

      // Parse response - clean up any potential markdown formatting
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7);
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      let mappingResult: ColumnMappingResponse;
      try {
        mappingResult = JSON.parse(cleanedResponse) as ColumnMappingResponse;
      } catch (parseError) {
        console.error('Failed to parse AI response:', cleanedResponse);
        throw new AppError(`Failed to parse AI response as valid JSON: ${cleanedResponse.substring(0, 500)}`, 500);
      }

      // Validate mapped headers exist in input
      if (mappingResult.mapping) {
        const validMapping: ColumnMapping = {};
        for (const [key, value] of Object.entries(mappingResult.mapping)) {
          if (value && headers.includes(value)) {
            validMapping[key as keyof ColumnMapping] = value;
          }
        }
        mappingResult.mapping = validMapping;
      }

      return mappingResult;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to detect column mapping: ${(error as Error).message}`, 500);
    }
  }
}

export default new AIService();
