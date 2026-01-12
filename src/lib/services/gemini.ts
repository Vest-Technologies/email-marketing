import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL, DEFAULT_SYSTEM_PROMPT } from '@/lib/constants';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface EmailGenerationResult {
  success: boolean;
  subject?: string;
  body?: string;
  error?: string;
  rawResponse?: string;
}

interface GeneratedEmail {
  subject: string;
  email_body: string;
}

/**
 * Parse the JSON response from Gemini
 */
function parseEmailResponse(text: string): GeneratedEmail | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*"subject"[\s\S]*"email_body"[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedEmail;
    
    if (!parsed.subject || !parsed.email_body) {
      return null;
    }

    if (typeof parsed.subject !== 'string' || typeof parsed.email_body !== 'string') {
      return null;
    }

    if (parsed.subject.trim() === '' || parsed.email_body.trim() === '') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

interface ContactInfo {
  firstName: string;
  lastName?: string;
  title?: string;
}

/**
 * Generate an email using Gemini AI
 */
export async function generateEmail(
  companyName: string,
  companyDomain: string,
  customPrompt?: string,
  companyWebsite?: string,
  contact?: ContactInfo
): Promise<EmailGenerationResult> {
  if (!GEMINI_API_KEY) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Use custom prompt if provided, otherwise use default
    const prompt = customPrompt || DEFAULT_SYSTEM_PROMPT;

    // Build the website URL - prefer explicit website, fallback to domain
    const websiteUrl = companyWebsite || `https://${companyDomain}`;

    // Build contact info string
    const contactInfo = contact 
      ? `CONTACT_FIRST_NAME: ${contact.firstName}
CONTACT_LAST_NAME: ${contact.lastName || ''}
CONTACT_TITLE: ${contact.title || ''}`
      : '';

    // Compose the final prompt with company website URL and contact info
    const fullPrompt = `${prompt}

---

Input you will receive:
COMPANY_WEBSITE_URL: ${websiteUrl}
COMPANY_NAME: ${companyName}
${contactInfo}

You MUST first analyze and scrape the company website to understand their business in detail.
${contact ? `IMPORTANT: Replace {{CONTACT_FIRST_NAME}} with the actual first name: "${contact.firstName}". Do NOT leave {{CONTACT_FIRST_NAME}} as a placeholder in the email body.` : ''}`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    const parsed = parseEmailResponse(text);

    if (!parsed) {
      return {
        success: false,
        error: 'Failed to parse email from AI response',
        rawResponse: text,
      };
    }

    // Replace placeholder with actual contact name if present
    let finalBody = parsed.email_body;
    if (contact?.firstName) {
      finalBody = finalBody.replace(/\{\{CONTACT_FIRST_NAME\}\}/g, contact.firstName);
      finalBody = finalBody.replace(/\{\{CONTACT_LAST_NAME\}\}/g, contact.lastName || '');
    }

    return {
      success: true,
      subject: parsed.subject,
      body: finalBody,
      rawResponse: text,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate email with retry logic
 */
export async function generateEmailWithRetry(
  companyName: string,
  companyDomain: string,
  customPrompt?: string,
  companyWebsite?: string,
  contact?: ContactInfo,
  maxRetries: number = 2
): Promise<EmailGenerationResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await generateEmail(companyName, companyDomain, customPrompt, companyWebsite, contact);
    
    if (result.success) {
      return result;
    }

    lastError = result.error;
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries + 1} attempts. Last error: ${lastError}`,
  };
}

/**
 * Validate that the email content meets quality standards
 */
export function validateEmailContent(subject: string, body: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Subject validation
  if (subject.length < 10) {
    issues.push('Subject is too short (minimum 10 characters)');
  }
  if (subject.length > 100) {
    issues.push('Subject is too long (maximum 100 characters)');
  }

  // Body validation
  if (body.length < 100) {
    issues.push('Email body is too short (minimum 100 characters)');
  }
  if (body.length > 2000) {
    issues.push('Email body is too long (maximum 2000 characters)');
  }

  // Check for spam-like content
  const spamTriggers = [
    'click here',
    'act now',
    'limited time',
    'free offer',
    'guaranteed',
    '100%',
    'urgent',
    '!!!',
  ];

  const lowerBody = body.toLowerCase();
  for (const trigger of spamTriggers) {
    if (lowerBody.includes(trigger)) {
      issues.push(`Contains potential spam trigger: "${trigger}"`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
