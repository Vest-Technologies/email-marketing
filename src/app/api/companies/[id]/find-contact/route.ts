import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findBestContact } from '@/lib/services/apollo';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/companies/[id]/find-contact
// Finds the best contact (highest seniority) and enriches their email
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Check API key
    if (!process.env.APOLLO_API_KEY || process.env.APOLLO_API_KEY === 'your_apollo_api_key_here') {
      return NextResponse.json(
        { error: 'Apollo API key not configured' },
        { status: 500 }
      );
    }

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    if (!company.apolloId) {
      return NextResponse.json(
        { error: 'Company has no Apollo ID (organization_id)' },
        { status: 400 }
      );
    }

    // Find best contact from Apollo using organization_id
    const bestContact = await findBestContact(
      company.name,
      company.apolloId
    );

    if (!bestContact.person) {
      return NextResponse.json({
        success: false,
        error: 'No contacts found for this company with target titles',
      }, { status: 200 });
    }

    // Log for debugging
    const fullName = `${bestContact.person.first_name || ''} ${bestContact.person.last_name || ''}`.trim();
    console.log('Found contact:', {
      name: fullName || bestContact.person.first_name || 'Unknown',
      firstName: bestContact.person.first_name,
      lastName: bestContact.person.last_name,
      title: bestContact.person.title,
      hasEmail: !!bestContact.enrichedEmail,
      company: company.name,
      domain: company.domain,
    });

    // Save the contact to the database
    const contactData = {
      firstName: bestContact.person.first_name || null,
      lastName: bestContact.person.last_name || null,
      email: bestContact.enrichedEmail || null,
      title: bestContact.title || bestContact.person.title || null,
    };

    // Validate we have at least a first name
    if (!contactData.firstName) {
      console.error('[Find Contact] Invalid contact data - no first name:', bestContact);
      return NextResponse.json({
        success: false,
        error: 'Contact found but missing required information',
      }, { status: 500 });
    }

    // Update company with target contact info
    await prisma.company.update({
      where: { id },
      data: {
        targetContactFirstName: contactData.firstName,
        targetContactLastName: contactData.lastName,
        targetContactEmail: contactData.email,
        targetContactTitle: contactData.title,
        contactFoundAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      contact: contactData,
      hasEmail: !!contactData.email,
    });
  } catch (error) {
    console.error('Error finding contact:', error);
    return NextResponse.json(
      { error: 'Failed to find contact' },
      { status: 500 }
    );
  }
}
