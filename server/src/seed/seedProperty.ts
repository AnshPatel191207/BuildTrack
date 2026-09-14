import { connectDatabase, disconnectDatabase } from '../config/db';
import { Company } from '../models/Company';
import { seedPropertyDemoData } from '../services/propertySeed.service';

async function run() {
  try {
    await connectDatabase();
    console.log('📦 Connected to MongoDB. Seeding Property ERP data...');
    const companies = await Company.find({});
    if (companies.length === 0) {
      console.log('⚠️ No company found in DB. Creating a default company first...');
      const company = await Company.create({
        name: 'BuildTrack Demo Builders LLP',
        phone: '9825001122',
        email: 'info@buildtrack.app',
        address: 'SG Highway, Ahmedabad, Gujarat',
      });
      const res = await seedPropertyDemoData(company._id);
      console.log('✅ Seeded Property ERP demo data for new company:', res);
    } else {
      for (const c of companies) {
        console.log(`🏢 Seeding Property ERP demo data for "${c.name}"...`);
        const res = await seedPropertyDemoData(c._id);
        console.log('   Result:', res);
      }
    }
    console.log('🎉 Property ERP dummy data seeded successfully!');
  } catch (err) {
    console.error('❌ Property seed error:', err);
  } finally {
    await disconnectDatabase();
  }
}

void run();
