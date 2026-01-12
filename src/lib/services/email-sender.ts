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
 * Send an email using Amazon SES
 */
async function sendEmailViaProvider(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  // Validate environment variables
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      success: false,
      error: 'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.',
    };
  }

  const fromEmail = process.env.FROM_EMAIL || process.env.AWS_SES_FROM_EMAIL;
  if (!fromEmail) {
    return {
      success: false,
      error: 'FROM_EMAIL not configured. Please set FROM_EMAIL or AWS_SES_FROM_EMAIL environment variable.',
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
    const htmlBody = textToHtml(body);

    // Create email command
    const command = new SendEmailCommand({
      Source: fromEmail,
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
            Data: body,
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
  performedBy?: string
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
  const result = await sendEmailViaProvider(recipientEmail, subject, body);

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
