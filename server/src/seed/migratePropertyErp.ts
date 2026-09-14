import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { DocumentTemplate } from '../models/DocumentTemplate';
import {
  DEFAULT_BANAKHAT_TEMPLATE,
  DEFAULT_DASTAVEJ_TEMPLATE,
} from '../services/templateEngine.service';
import { env } from '../config/env';

export async function migratePropertyErp() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB for Property ERP migration.');

  const companies = await Company.find().select('_id name ownerId');
  console.log(`Found ${companies.length} companies to migrate.`);

  for (const company of companies) {
    // 1. Ensure Default Banakhat Template
    const existingBanakhat = await DocumentTemplate.findOne({
      companyId: company._id,
      templateType: 'banakhat',
    });
    if (!existingBanakhat) {
      await DocumentTemplate.create({
        companyId: company._id,
        templateType: 'banakhat',
        title: 'Standard RERA Agreement for Sale (Banakhat)',
        bodyContent: DEFAULT_BANAKHAT_TEMPLATE,
        isDefault: true,
        createdBy: company.ownerId,
      });
      console.log(`Created default Banakhat template for ${company.name}`);
    }

    // 2. Ensure Default Dastavej Template
    const existingDastavej = await DocumentTemplate.findOne({
      companyId: company._id,
      templateType: 'dastavej',
    });
    if (!existingDastavej) {
      await DocumentTemplate.create({
        companyId: company._id,
        templateType: 'dastavej',
        title: 'Standard Conveyance Deed (Dastavej)',
        bodyContent: DEFAULT_DASTAVEJ_TEMPLATE,
        isDefault: true,
        createdBy: company.ownerId,
      });
      console.log(`Created default Dastavej template for ${company.name}`);
    }
  }

  console.log('Property ERP migration complete.');
  await mongoose.disconnect();
}

if (process.argv[1]?.includes('migratePropertyErp')) {
  migratePropertyErp()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
