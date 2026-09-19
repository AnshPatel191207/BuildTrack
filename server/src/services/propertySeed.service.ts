import { Project, nextProjectCode } from '../models/Project';
import { ProjectNode } from '../models/ProjectNode';
import { Unit } from '../models/Unit';
import { Customer } from '../models/Customer';
import { Booking, nextBookingNumber } from '../models/Booking';
import { Payment, nextReceiptNumber, nextPaymentNumber } from '../models/Payment';
import { PropertyDocument, nextDocumentNumber } from '../models/PropertyDocument';
import { DocumentTemplate } from '../models/DocumentTemplate';
import { Company } from '../models/Company';
import { User } from '../models/User';
import {
  DEFAULT_BANAKHAT_TEMPLATE,
  DEFAULT_DASTAVEJ_TEMPLATE,
  renderTemplate,
  numberToWordsINR,
} from './templateEngine.service';
import { generateReceiptPdf, generateLegalDocumentPdf } from './pdfGenerator.service';
import { utcDay } from '../utils/dates';

export async function seedPropertyDemoData(companyId: any, userId?: any) {
  // 1. Ensure user and company
  const company = await Company.findById(companyId);
  if (!company) throw new Error('Company not found for seeding');

  let adminUser = userId ? await User.findById(userId) : null;
  if (!adminUser) {
    adminUser = await User.findOne({ companyId });
  }
  const creatorId = adminUser?._id;

  // 2. Ensure or create Property Project: "Shivalik Skyview"
  let project = await Project.findOne({ companyId, name: 'Shivalik Skyview' });
  if (!project) {
    const code = await nextProjectCode(companyId);
    project = await Project.create({
      companyId,
      name: 'Shivalik Skyview',
      projectCode: code,
      location: 'SG Highway, Ahmedabad',
      address: 'Near ISKCON Cross Roads, SG Highway, Ahmedabad, Gujarat 380054',
      builderName: 'Shivalik Real Estate & Builders LLP',
      reraNumber: 'PR/GJ/AHMEDABAD/2026/00189',
      projectType: 'residential',
      totalTowers: 2,
      totalUnits: 16,
      budget: 150000000,
      startDate: new Date('2026-01-01'),
      status: 'active',
      description: 'Ultra-luxurious residential apartments and premium high-street commercial retail shops on SG Highway.',
    });
  }

  // 3. Ensure Towers (Tower A - Aster & Tower B - Bloom)
  let towerA = await ProjectNode.findOne({ companyId, projectId: project._id, name: 'Tower A - Aster' });
  if (!towerA) {
    towerA = await ProjectNode.create({
      companyId,
      projectId: project._id,
      parentId: null,
      nodeType: 'tower',
      name: 'Tower A - Aster',
      order: 1,
      createdBy: creatorId,
      progressPercentage: 65,
    });
  }

  let towerB = await ProjectNode.findOne({ companyId, projectId: project._id, name: 'Tower B - Bloom' });
  if (!towerB) {
    towerB = await ProjectNode.create({
      companyId,
      projectId: project._id,
      parentId: null,
      nodeType: 'tower',
      name: 'Tower B - Bloom',
      order: 2,
      createdBy: creatorId,
      progressPercentage: 45,
    });
  }

  // 4. Ensure Floors for Tower A & B
  const floorsA: any[] = [];
  for (let f = 1; f <= 4; f += 1) {
    const floorName = f === 1 ? '1st Floor' : f === 2 ? '2nd Floor' : f === 3 ? '3rd Floor' : `${f}th Floor`;
    let floorNode = await ProjectNode.findOne({ companyId, projectId: project._id, parentId: towerA._id, name: floorName });
    if (!floorNode) {
      floorNode = await ProjectNode.create({
        companyId,
        projectId: project._id,
        parentId: towerA._id,
        nodeType: 'floor',
        name: floorName,
        order: f,
        createdBy: creatorId,
        progressPercentage: f === 1 ? 100 : f === 2 ? 85 : f === 3 ? 60 : 30,
      });
    }
    floorsA.push(floorNode);
  }

  let floorB1 = await ProjectNode.findOne({ companyId, projectId: project._id, parentId: towerB._id, name: '1st Floor' });
  if (!floorB1) {
    floorB1 = await ProjectNode.create({
      companyId,
      projectId: project._id,
      parentId: towerB._id,
      nodeType: 'floor',
      name: '1st Floor',
      order: 1,
      createdBy: creatorId,
      progressPercentage: 90,
    });
  }

  // 5. Ensure Flats and Commercial Shops
  const unitSpecs = [
    // Tower A Flats
    { unitNumber: 'A-101', towerId: towerA._id, floorId: floorsA[0]._id, unitType: '2BHK', bedrooms: 2, carpet: 980, built: 1250, base: 6500000, parking: 'Covered A-101', parkingCost: 200000, facing: 'East', status: 'available' },
    { unitNumber: 'A-102', towerId: towerA._id, floorId: floorsA[0]._id, unitType: '2BHK', bedrooms: 2, carpet: 980, built: 1250, base: 6500000, parking: 'Covered A-102', parkingCost: 200000, facing: 'North', status: 'available' },
    { unitNumber: 'A-201', towerId: towerA._id, floorId: floorsA[1]._id, unitType: '3BHK', bedrooms: 3, carpet: 1350, built: 1650, base: 8500000, parking: 'Basement P-21', parkingCost: 250000, facing: 'East', status: 'booked' },
    { unitNumber: 'A-202', towerId: towerA._id, floorId: floorsA[1]._id, unitType: '3BHK', bedrooms: 3, carpet: 1350, built: 1650, base: 8500000, parking: 'Basement P-22', parkingCost: 250000, facing: 'West', status: 'available' },
    { unitNumber: 'A-301', towerId: towerA._id, floorId: floorsA[2]._id, unitType: '3BHK', bedrooms: 3, carpet: 1350, built: 1650, base: 8800000, parking: 'Basement P-31', parkingCost: 250000, facing: 'North', status: 'available' },
    { unitNumber: 'A-302', towerId: towerA._id, floorId: floorsA[2]._id, unitType: '4BHK', bedrooms: 4, carpet: 1850, built: 2200, base: 12000000, parking: 'Twin Slot P-32/33', parkingCost: 400000, facing: 'East', status: 'sold' },
    // Tower B Flats
    { unitNumber: 'B-101', towerId: towerB._id, floorId: floorB1._id, unitType: '2BHK', bedrooms: 2, carpet: 980, built: 1250, base: 6500000, parking: 'Covered B-101', parkingCost: 200000, facing: 'East', status: 'available' },
    { unitNumber: 'B-102', towerId: towerB._id, floorId: floorB1._id, unitType: '2BHK', bedrooms: 2, carpet: 980, built: 1250, base: 6500000, parking: 'Covered B-102', parkingCost: 200000, facing: 'West', status: 'available' },
    // Commercial Ground-Floor Shops
    { unitNumber: 'SHOP-01', towerId: towerA._id, floorId: floorsA[0]._id, unitType: 'Shop', bedrooms: 0, carpet: 300, built: 350, base: 4500000, parking: 'Front Open', parkingCost: 0, facing: 'East', status: 'booked' },
    { unitNumber: 'SHOP-02', towerId: towerA._id, floorId: floorsA[0]._id, unitType: 'Showroom', bedrooms: 0, carpet: 520, built: 600, base: 7800000, parking: 'Front Reserved', parkingCost: 0, facing: 'North', status: 'available' },
    { unitNumber: 'SHOP-03', towerId: towerB._id, floorId: floorB1._id, unitType: 'Shop', bedrooms: 0, carpet: 280, built: 320, base: 3800000, parking: 'Front Open', parkingCost: 0, facing: 'West', status: 'available' },
  ];

  const createdUnits: Record<string, any> = {};
  for (const s of unitSpecs) {
    let unit = await Unit.findOne({ companyId, projectId: project._id, unitNumber: s.unitNumber });
    if (!unit) {
      unit = await Unit.create({
        companyId,
        projectId: project._id,
        blockId: s.towerId,
        floorId: s.floorId,
        unitNumber: s.unitNumber,
        unitType: s.unitType,
        bedrooms: s.bedrooms,
        carpetAreaSqft: s.carpet,
        builtUpAreaSqft: s.built,
        areaSqft: s.built,
        ratePerSqft: Math.round(s.base / s.built),
        basePrice: s.base,
        parkingSlot: s.parking,
        parkingCharges: s.parkingCost,
        totalValue: s.base + s.parkingCost,
        facing: s.facing,
        status: s.status,
      });
    }
    createdUnits[s.unitNumber] = unit;
  }

  // 6. Ensure Customers
  const customerDefs = [
    { name: 'Rajeshbhai Patel', phone: '9825012345', email: 'rajesh.patel@gmail.com', city: 'Ahmedabad', state: 'Gujarat', pan: 'ABCDP1234F', aadhaar: '123456789012', address: '42, Vasant Vihar, Bodakdev, Ahmedabad', occupation: 'Chemical Manufacturer', journeyStage: 'possession' },
    { name: 'Priyaben Sharma', phone: '9898011223', email: 'priya.sharma@yahoo.com', city: 'Surat', state: 'Gujarat', pan: 'AAAPS9876K', aadhaar: '987654321098', address: 'B-12, Green Park, Athwa Lines, Surat', occupation: 'Diamond Exporter', journeyStage: 'payment' },
    { name: 'Nileshbhai Mehta', phone: '9712033445', email: 'nilesh.mehta@gmail.com', city: 'Ahmedabad', state: 'Gujarat', pan: 'BKPMN4433H', aadhaar: '543216789012', address: '18, Shanti Nagar, Naranpura, Ahmedabad', occupation: 'Textile Merchant', journeyStage: 'booking' },
    { name: 'Hetalben Shah', phone: '9909044556', email: 'hetal.shah@gmail.com', city: 'Vadodara', state: 'Gujarat', pan: 'CJLPS5566T', aadhaar: '890123456789', address: '7, Alkapuri, Vadodara', occupation: 'Chartered Accountant', journeyStage: 'visit' },
  ];

  const createdCustomers: Record<string, any> = {};
  for (const c of customerDefs) {
    let customer = await Customer.findOne({ companyId, phone: c.phone });
    if (!customer) {
      customer = await Customer.create({
        companyId,
        projectId: project._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        city: c.city,
        state: c.state,
        pan: c.pan,
        aadhaar: c.aadhaar,
        address: c.address,
        occupation: c.occupation,
        leadSource: 'walk_in',
        journeyStage: c.journeyStage as any,
        timeline: [{ stage: c.journeyStage as any, note: 'Customer profile setup', date: new Date() }],
      });
    }
    createdCustomers[c.name] = customer;
  }

  // 7. Ensure Confirmed Bookings with Milestones
  const booking1Unit = createdUnits['A-201'];
  const customer1 = createdCustomers['Rajeshbhai Patel'];
  let booking1 = await Booking.findOne({ companyId, unitId: booking1Unit._id });
  if (!booking1) {
    const bookingNo = await nextBookingNumber(companyId);
    booking1 = await Booking.create({
      companyId,
      projectId: project._id,
      unitId: booking1Unit._id,
      customerId: customer1._id,
      bookingNumber: bookingNo,
      bookingDate: new Date('2026-02-15'),
      bookingAmount: 500000,
      totalValue: booking1Unit.totalValue,
      status: 'confirmed',
      createdBy: creatorId,
      salesManagerId: creatorId,
      notes: 'Confirmed 3BHK flat on 2nd Floor, Tower A.',
    });
    booking1Unit.status = 'booked';
    booking1Unit.currentCustomerId = customer1._id;
    booking1Unit.currentBookingId = booking1._id;
    await booking1Unit.save();
  }

  const booking2Unit = createdUnits['A-302'];
  const customer2 = createdCustomers['Priyaben Sharma'];
  let booking2 = await Booking.findOne({ companyId, unitId: booking2Unit._id });
  if (!booking2) {
    const bookingNo = await nextBookingNumber(companyId);
    booking2 = await Booking.create({
      companyId,
      projectId: project._id,
      unitId: booking2Unit._id,
      customerId: customer2._id,
      bookingNumber: bookingNo,
      bookingDate: new Date('2026-01-20'),
      bookingAmount: 1000000,
      totalValue: booking2Unit.totalValue,
      status: 'confirmed',
      createdBy: creatorId,
      salesManagerId: creatorId,
      notes: 'Confirmed luxury 4BHK penthouse on 3rd Floor, Tower A.',
    });
    booking2Unit.status = 'sold';
    booking2Unit.currentCustomerId = customer2._id;
    booking2Unit.currentBookingId = booking2._id;
    await booking2Unit.save();
  }

  const booking3Unit = createdUnits['SHOP-01'];
  const customer3 = createdCustomers['Nileshbhai Mehta'];
  let booking3 = await Booking.findOne({ companyId, unitId: booking3Unit._id });
  if (!booking3) {
    const bookingNo = await nextBookingNumber(companyId);
    booking3 = await Booking.create({
      companyId,
      projectId: project._id,
      unitId: booking3Unit._id,
      customerId: customer3._id,
      bookingNumber: bookingNo,
      bookingDate: new Date('2026-03-01'),
      bookingAmount: 500000,
      totalValue: booking3Unit.totalValue,
      status: 'confirmed',
      createdBy: creatorId,
      salesManagerId: creatorId,
      notes: 'Confirmed retail commercial shop on ground floor.',
    });
    booking3Unit.status = 'booked';
    booking3Unit.currentCustomerId = customer3._id;
    booking3Unit.currentBookingId = booking3._id;
    await booking3Unit.save();
  }

  // 8. Ensure Payments with Official Receipts
  let payment1 = await Payment.findOne({ companyId, bookingId: booking1._id, paymentType: 'booking_amount' });
  if (!payment1) {
    const receiptNo = await nextReceiptNumber(companyId);
    const payNo = await nextPaymentNumber(companyId);
    payment1 = await Payment.create({
      companyId,
      projectId: project._id,
      bookingId: booking1._id,
      customerId: customer1._id,
      unitId: booking1Unit._id,
      paymentNumber: payNo,
      receiptNumber: receiptNo,
      amount: 500000,
      paymentType: 'booking_amount',
      method: 'bank_transfer',
      paidDate: new Date('2026-02-15'),
      dueDate: new Date('2026-02-15'),
      status: 'paid',
      reference: 'NEFT/HDFC/20260215/98210',
      notes: 'Token advance installment paid via online NEFT',
      recordedBy: creatorId,
    });
    // Generate PDF
    try {
      const { relativeUrl } = await generateReceiptPdf({
        receiptNumber: receiptNo,
        paymentDate: payment1.paidDate!,
        companyName: company.name,
        companyAddress: company.address || 'Ahmedabad, Gujarat',
        customerName: customer1.name,
        customerPhone: customer1.phone,
        projectName: project.name,
        unitNumber: booking1Unit.unitNumber,
        towerName: 'Tower A - Aster',
        paymentAmount: 500000,
        paymentMode: 'Bank Transfer (NEFT)',
        transactionId: 'NEFT/HDFC/20260215/98210',
        totalUnitValue: booking1Unit.totalValue,
        totalPaidTillNow: 500000,
        remainingBalance: booking1Unit.totalValue - 500000,
      });
      payment1.receiptPdfUrl = relativeUrl;
      await payment1.save();
    } catch {
      // PDF generation fallback in test/offline environments
    }
  }

  let payment2 = await Payment.findOne({ companyId, bookingId: booking1._id, reference: 'CHQ-778891' });
  if (!payment2) {
    const receiptNo = await nextReceiptNumber(companyId);
    const payNo = await nextPaymentNumber(companyId);
    payment2 = await Payment.create({
      companyId,
      projectId: project._id,
      bookingId: booking1._id,
      customerId: customer1._id,
      unitId: booking1Unit._id,
      paymentNumber: payNo,
      receiptNumber: receiptNo,
      amount: 1500000,
      paymentType: 'installment',
      method: 'cheque',
      paidDate: new Date('2026-03-01'),
      dueDate: new Date('2026-03-01'),
      status: 'paid',
      reference: 'CHQ-778891',
      notes: 'Plinth level construction installment cleared',
      recordedBy: creatorId,
    });
    try {
      const { relativeUrl } = await generateReceiptPdf({
        receiptNumber: receiptNo,
        paymentDate: payment2.paidDate!,
        companyName: company.name,
        companyAddress: company.address || 'Ahmedabad, Gujarat',
        customerName: customer1.name,
        customerPhone: customer1.phone,
        projectName: project.name,
        unitNumber: booking1Unit.unitNumber,
        towerName: 'Tower A - Aster',
        paymentAmount: 1500000,
        paymentMode: 'Cheque (SBI)',
        chequeNumber: 'CHQ-778891',
        totalUnitValue: booking1Unit.totalValue,
        totalPaidTillNow: 2000000,
        remainingBalance: booking1Unit.totalValue - 2000000,
      });
      payment2.receiptPdfUrl = relativeUrl;
      await payment2.save();
    } catch {
      // ignore
    }
  }

  let payment3 = await Payment.findOne({ companyId, bookingId: booking2._id, paymentType: 'booking_amount' });
  if (!payment3) {
    const receiptNo = await nextReceiptNumber(companyId);
    const payNo = await nextPaymentNumber(companyId);
    payment3 = await Payment.create({
      companyId,
      projectId: project._id,
      bookingId: booking2._id,
      customerId: customer2._id,
      unitId: booking2Unit._id,
      paymentNumber: payNo,
      receiptNumber: receiptNo,
      amount: 1000000,
      paymentType: 'booking_amount',
      method: 'bank_transfer',
      paidDate: new Date('2026-01-20'),
      dueDate: new Date('2026-01-20'),
      status: 'paid',
      reference: 'RTGS/ICICI/009182',
      notes: 'Initial token booking amount for Penthouse A-302',
      recordedBy: creatorId,
    });
  }

  // 9. Ensure Legal Documents (Banakhat & Dastavej)
  let banakhatDoc = await PropertyDocument.findOne({ companyId, bookingId: booking1._id, documentType: 'banakhat' });
  if (!banakhatDoc) {
    const docNo = await nextDocumentNumber(companyId, 'banakhat');
    const todayStr = new Date('2026-02-16').toLocaleDateString('en-IN');
    const renderedContent = renderTemplate(DEFAULT_BANAKHAT_TEMPLATE, {
      agreement_date: todayStr,
      builder_name: project.builderName || company.name,
      builder_pan: company.pan || 'AABCB1234K',
      builder_address: company.address || 'Ahmedabad',
      project_name: project.name,
      project_location: project.location || 'Ahmedabad',
      rera_number: project.reraNumber || 'PR/GJ/AHMEDABAD/2026/00189',
      tower_name: 'Tower A - Aster',
      floor_name: '2nd Floor',
      flat_number: booking1Unit.unitNumber,
      carpet_area: booking1Unit.carpetAreaSqft || 1350,
      builtup_area: booking1Unit.builtUpAreaSqft || 1650,
      parking_slot: booking1Unit.parkingSlot || 'Basement P-21',
      total_amount: Math.round(booking1.totalValue).toLocaleString('en-IN'),
      total_amount_in_words: numberToWordsINR(booking1.totalValue),
      token_amount: (500000).toLocaleString('en-IN'),
      customer_name: customer1.name,
      customer_pan: customer1.pan || 'ABCDP1234F',
      customer_aadhaar: customer1.aadhaar || '123456789012',
      customer_address: customer1.address || 'Ahmedabad',
    });

    banakhatDoc = await PropertyDocument.create({
      companyId,
      projectId: project._id,
      bookingId: booking1._id,
      customerId: customer1._id,
      unitId: booking1Unit._id,
      documentType: 'banakhat',
      documentNumber: docNo,
      title: `Banakhat — ${customer1.name} (${booking1Unit.unitNumber})`,
      renderedContent,
      status: 'generated',
      generatedBy: creatorId,
    });
    booking1.banakhatDocumentId = banakhatDoc._id;
    await booking1.save();
  }

  let dastavejDoc = await PropertyDocument.findOne({ companyId, bookingId: booking2._id, documentType: 'dastavej' });
  if (!dastavejDoc) {
    const docNo = await nextDocumentNumber(companyId, 'dastavej');
    const todayStr = new Date('2026-02-20').toLocaleDateString('en-IN');
    const renderedContent = renderTemplate(DEFAULT_DASTAVEJ_TEMPLATE, {
      deed_date: todayStr,
      builder_name: project.builderName || company.name,
      builder_pan: company.pan || 'AABCB1234K',
      builder_address: company.address || 'Ahmedabad',
      project_name: project.name,
      project_location: project.location || 'Ahmedabad',
      rera_number: project.reraNumber || 'PR/GJ/AHMEDABAD/2026/00189',
      tower_name: 'Tower A - Aster',
      floor_name: '3rd Floor',
      flat_number: booking2Unit.unitNumber,
      carpet_area: booking2Unit.carpetAreaSqft || 1850,
      builtup_area: booking2Unit.builtUpAreaSqft || 2200,
      parking_slot: booking2Unit.parkingSlot || 'Twin Slot P-32/33',
      total_amount: Math.round(booking2.totalValue).toLocaleString('en-IN'),
      total_amount_in_words: numberToWordsINR(booking2.totalValue),
      customer_name: customer2.name,
      customer_pan: customer2.pan || 'AAAPS9876K',
      customer_aadhaar: customer2.aadhaar || '987654321098',
      customer_address: customer2.address || 'Surat',
    });

    dastavejDoc = await PropertyDocument.create({
      companyId,
      projectId: project._id,
      bookingId: booking2._id,
      customerId: customer2._id,
      unitId: booking2Unit._id,
      documentType: 'dastavej',
      documentNumber: docNo,
      title: `Dastavej — ${customer2.name} (${booking2Unit.unitNumber})`,
      renderedContent,
      status: 'registered',
      generatedBy: creatorId,
    });
    booking2.dastavejDocumentId = dastavejDoc._id;
    await booking2.save();
  }

  return {
    success: true,
    project: project.name,
    towers: 2,
    unitsCount: unitSpecs.length,
    customersCount: customerDefs.length,
    bookingsCount: 3,
    paymentsCount: 3,
    documentsCount: 2,
  };
}
