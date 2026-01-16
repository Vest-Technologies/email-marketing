import prisma from '@/lib/prisma';
import { PIPELINE_STATES } from '@/lib/constants';
import { transitionState } from './pipeline';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

interface SendResult {
  success: boolean;
  error?: string;
  sentAt?: Date;
}

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

/**
 * Convert plain text to HTML (preserve line breaks)
 */
function textToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>\n');
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Get sender email and signature from settings or environment variable
 */
async function getSenderSettings(): Promise<{ email: string | null; name: string | null; signature: string | null }> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (settings?.senderEmail) {
      return { email: settings.senderEmail, name: settings.senderName, signature: settings.signature };
    }

    // Return signature even if sender email is not set (will use env fallback for email)
    if (settings?.signature) {
      return {
        email: process.env.FROM_EMAIL || process.env.AWS_SES_FROM_EMAIL || null,
        name: null,
        signature: settings.signature,
      };
    }
  } catch (error) {
    console.warn('[SES] Could not fetch sender settings, falling back to env:', error);
  }

  // Fallback to environment variable
  return {
    email: process.env.FROM_EMAIL || process.env.AWS_SES_FROM_EMAIL || null,
    name: null,
    signature: null,
  };
}

/**
 * Send an email using Amazon SES
 */
async function sendEmailViaProvider(
  to: string,
  subject: string,
  body: string,
  customSenderEmail?: string
): Promise<SendResult> {
  // Validate environment variables
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      success: false,
      error: 'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.',
    };
  }

  // Get sender settings (email, name, signature)
  const senderSettings = await getSenderSettings();

  // Use custom sender email if provided, otherwise get from settings
  let fromEmail: string | null;
  let senderName: string | null = null;

  if (customSenderEmail) {
    fromEmail = customSenderEmail;
  } else {
    fromEmail = senderSettings.email;
    senderName = senderSettings.name;
  }

  if (!fromEmail) {
    return {
      success: false,
      error: 'Sender email not configured. Please configure it in Settings or set FROM_EMAIL environment variable.',
    };
  }

  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return {
      success: false,
      error: `Invalid recipient email address: ${to}`,
    };
  }

  if (!emailRegex.test(fromEmail)) {
    return {
      success: false,
      error: `Invalid sender email address: ${fromEmail}`,
    };
  }

  try {
    // Convert plain text body to HTML
    let htmlBody = textToHtml(body);
    let plainTextBody = body;

    // Append HTML signature if configured
    if (senderSettings.signature) {
      htmlBody = htmlBody + '<div style="margin-top:20px;">' + senderSettings.signature + '</div>';
      plainTextBody = body + '\n\n' + stripHtml(senderSettings.signature);
    }

    // Format source with display name if available
    const source = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;

    // Create email command
    const command = new SendEmailCommand({
      Source: source,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: plainTextBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    // Send email
    const response = await sesClient.send(command);

    console.log(`[SES] Email sent successfully. MessageId: ${response.MessageId}, To: ${to}`);

    return {
      success: true,
      sentAt: new Date(),
    };
  } catch (error: any) {
    console.error('[SES] Error sending email:', error);
    
    // Extract meaningful error message
    let errorMessage = 'Failed to send email via Amazon SES';
    if (error.name === 'MessageRejected') {
      errorMessage = 'Email was rejected by Amazon SES. Check that the sender email is verified.';
    } else if (error.name === 'MailFromDomainNotVerifiedException') {
      errorMessage = 'Sender email domain is not verified in Amazon SES.';
    } else if (error.message) {
      errorMessage = `Amazon SES error: ${error.message}`;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send an approved email
 */
export async function sendApprovedEmail(
  companyId: string,
  recipientEmail: string,
  performedBy?: string,
  customSenderEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { email: true },
  });

  if (!company) {
    return { success: false, error: 'Company not found' };
  }

  if (company.pipelineState !== PIPELINE_STATES.APPROVED_TO_SEND) {
    return {
      success: false,
      error: `Cannot send email: company is in state "${company.pipelineState}"`,
    };
  }

  if (!company.email) {
    return { success: false, error: 'No email found for this company' };
  }

  const email = company.email;
  const subject = email.finalSubject || email.editedSubject || email.subject;
  const body = email.finalBody || email.editedBody || email.body;

  // Attempt to send
  const result = await sendEmailViaProvider(recipientEmail, subject, body, customSenderEmail);

  if (!result.success) {
    // Update send attempts and error
    await prisma.email.update({
      where: { id: email.id },
      data: {
        sendAttempts: { increment: 1 },
        sendError: result.error,
      },
    });
    return { success: false, error: result.error };
  }

  // Update email record with sent details
  await prisma.email.update({
    where: { id: email.id },
    data: {
      sentAt: result.sentAt,
      sentTo: recipientEmail,
      sendAttempts: { increment: 1 },
      sendError: null,
    },
  });

  // Transition to sent state
  const transitionResult = await transitionState(
    companyId,
    PIPELINE_STATES.SENT,
    performedBy,
    { recipientEmail, sentAt: result.sentAt }
  );

  if (!transitionResult.success) {
    return { success: false, error: transitionResult.error };
  }

  return { success: true };
}

/**
 * Get emails ready to send
 */
export async function getEmailsReadyToSend(
  limit?: number
): Promise<
  Array<{
    company: Awaited<ReturnType<typeof prisma.company.findUnique>>;
    email: NonNullable<Awaited<ReturnType<typeof prisma.email.findUnique>>>;
    recipient: { email: string; name: string; title: string } | null;
  }>
> {
  const companies = await prisma.company.findMany({
    where: {
      pipelineState: PIPELINE_STATES.APPROVED_TO_SEND,
    },
    include: {
      email: true,
    },
    take: limit,
  });

  return companies
    .filter((company) => company.email !== null)
    .map((company) => ({
      company,
      email: company.email!,
      recipient: company.targetContactEmail
        ? {
            email: company.targetContactEmail,
            name: `${company.targetContactFirstName || ''} ${company.targetContactLastName || ''}`.trim(),
            title: company.targetContactTitle || '',
          }
        : null,
    }));
}
