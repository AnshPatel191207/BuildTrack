import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { Company } from '../models/Company';
import { DocumentTemplate } from '../models/DocumentTemplate';
import {
  DEFAULT_BANAKHAT_TEMPLATE,
  DEFAULT_DASTAVEJ_TEMPLATE,
} from '../services/templateEngine.service';
import { env } from '../config/env';

export async function migrateMultiProjectBranding() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB for Multi-Project Branding Migration.');

  const projects = await Project.find();
  console.log(`Found ${projects.length} projects to migrate.`);

  for (const p of projects) {
    const company = await Company.findById(p.companyId);
    let updated = false;

    // 1. Branding Subdocument
    if (!p.branding || !p.branding.developerName) {
      p.branding = {
        logoUrl: p.branding?.logoUrl || company?.logo || null,
        logoDarkUrl: p.branding?.logoDarkUrl || null,
        shortName: p.branding?.shortName || p.name.split(' ')[0] || 'Santora',
        developerName: p.branding?.developerName || p.builderName || company?.name || 'Developer Entity',
        companyName: p.branding?.companyName || company?.name || 'Apex Real Estate Holdings',
        phone: p.branding?.phone || company?.phone || '+91 98250 00000',
        email: p.branding?.email || company?.email || 'sales@buildtrack.in',
        website: p.branding?.website || 'https://buildtrack.in',
        officeAddress: p.branding?.officeAddress || company?.address || p.location || 'Ahmedabad, Gujarat',
        siteAddress: p.branding?.siteAddress || p.address || p.location || 'Ahmedabad, Gujarat',
        gstNumber: p.branding?.gstNumber || company?.gstin || '24AAACT0000A1Z5',
        reraNumber: p.branding?.reraNumber || p.reraNumber || 'PR/GJ/AHMEDABAD/2026/00000',
        panNumber: p.branding?.panNumber || company?.pan || 'AAACT0000A',
      };
      updated = true;
    }

    // 2. Theme Subdocument
    if (!p.theme || !p.theme.primary) {
      p.theme = {
        primary: '#E8590C', // Terracotta default
        secondary: '#17263B', // Navy
        accent: '#F59E0B',
        success: '#10B981',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#2563EB',
      };
      updated = true;
    }

    // 3. Receipt Configuration Subdocument
    if (!p.receiptConfig) {
      p.receiptConfig = {
        showLogo: true,
        showGst: true,
        showRera: true,
        showCustomerAddress: true,
        showBankDetails: true,
        watermarkText: p.name.toUpperCase(),
        enableDigitalSign: true,
        termsAndConditions: [
          'Subject to realization of Cheque / RTGS payment.',
          'Interest @ 12% p.a. applicable for delayed payments.',
          'All disputes subject to local jurisdiction.',
        ],
        authorizedSignatoryTitle: `For ${p.branding?.developerName || p.name}`,
      };
      updated = true;
    }

    // 4. Booking & Payment Rules
    if (!p.bookingRules) {
      p.bookingRules = {
        minTokenAmount: 100000,
        tokenValidityDays: 7,
        cancellationPenaltyPct: 10,
      };
      updated = true;
    }
    if (!p.paymentRules) {
      p.paymentRules = {
        defaultGstRate: 5,
        overdueInterestPctPerAnnum: 12,
        gracePeriodDays: 15,
      };
      updated = true;
    }

    if (updated) {
      await p.save();
      console.log(`✅ Migrated branding & rules for project: ${p.name}`);
    }

    // 5. Ensure Project-Scoped Document Templates with dynamic clauses
    const bnkTemplate = await DocumentTemplate.findOne({
      companyId: p.companyId,
      projectId: p._id,
      templateType: 'banakhat',
    });

    if (!bnkTemplate) {
      await DocumentTemplate.create({
        companyId: p.companyId,
        projectId: p._id,
        templateType: 'banakhat',
        title: `${p.name} - Agreement for Sale (Banakhat)`,
        bodyContent: DEFAULT_BANAKHAT_TEMPLATE,
        clauses: [
          { id: 'c1', title: 'Parties to the Agreement', content: 'This agreement is executed between {{developer_name}} (Promoter) and {{customer_name}} (Allottee).', order: 1, isMandatory: true },
          { id: 'c2', title: 'Schedule of the Property', content: 'Unit {{flat_number}}, Tower {{tower_name}}, Floor {{floor_name}}, Carpet Area {{unit_area}} Sq. Ft. at {{project_name}} (RERA: {{rera_number}}).', order: 2, isMandatory: true },
          { id: 'c3', title: 'Agreed Consideration & Payments', content: 'The total purchase price is ₹{{total_amount}} ({{total_amount_in_words}}), out of which token amount of ₹{{booking_amount}} is acknowledged as received.', order: 3, isMandatory: true },
        ],
        signatures: [
          { role: 'promoter', label: `For ${p.branding?.developerName || p.name}`, signerName: 'Authorized Signatory', required: true },
          { role: 'purchaser', label: 'Allottee / Purchaser', required: true },
        ],
        witnesses: [
          { label: 'Witness 1', required: true },
          { label: 'Witness 2', required: true },
        ],
        showLogo: true,
        showRera: true,
        showGst: true,
        watermarkText: p.name.toUpperCase(),
        isDefault: true,
        createdBy: p.projectManagerId || company?.ownerId,
      });
      console.log(`   📄 Created Banakhat template with dynamic clauses for: ${p.name}`);
    }
  }

  console.log('Multi-Project Branding & ERP migration complete.');
  await mongoose.disconnect();
}

if (process.argv[1]?.includes('migrateMultiProjectBranding')) {
  migrateMultiProjectBranding()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
