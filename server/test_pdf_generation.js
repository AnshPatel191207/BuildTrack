const fs = require('fs');
const path = require('path');
const {
  fillReceiptPdf,
  fillBanakhatPdf,
  fillDastavejPdf,
} = require('./dist/src/services/pdfTemplateEngine.service');

async function runTests() {
  console.log('=== STARTING NODE PDF GENERATION TESTS ===');

  // Test 1: Receipt (Santora default)
  const santoraReceipt = await fillReceiptPdf(
    {
      projectName: 'Santora',
      developerName: 'RUDRA DEVELOPERS',
      companyName: 'Rudra Developers',
      officeAddress: 'Santora, Opp. Veltis Respair, Lubi Corporate House Road, Tragad Underpass, Ahmedabad-382421',
      phone: '+91 75749 98888',
      email: 'santorabyclover@gmail.com',
      tagline: '2 BHK PODIUM HOMES',
      jurisdiction: 'Ahmedabad Jurisdiction',
      authorizedSignatoryTitle: 'FOR, RUDRA DEVELOPERS',
    },
    {
      receiptNumber: 'RCP-2026-TEST01',
      paymentDate: '2026-09-17',
      customerName: 'RAJESHBHAI MOHANBHAI PATEL',
      customerPhone: '+91 98250 12345',
      unitNumber: 'A-402',
      floorName: '4th Floor',
      towerName: 'Tower A',
      carpetAreaSqft: 1450,
      paymentAmount: 500000,
      paymentMode: 'RTGS',
      transactionId: 'HDFC000987654321',
      bankName: 'HDFC Bank, S.G. Highway Branch',
      chequeDate: '2026-09-17',
    }
  );
  console.log('✔ Test 1 (Santora Receipt): Created', santoraReceipt.filePath, 'Buffer size:', santoraReceipt.buffer.length);

  // Test 2: Receipt (Custom project)
  const customReceipt = await fillReceiptPdf(
    {
      projectName: 'Sunrise Royale',
      developerName: 'APEX INFRASTRUCTURE',
      companyName: 'Apex Group',
      officeAddress: 'Apex Square, Satellite, Ahmedabad-380015',
      phone: '+91 98980 11111',
      email: 'info@apexinfra.com',
      tagline: '3 & 4 BHK LUXURY LIVING',
      jurisdiction: 'Gandhinagar Jurisdiction',
      authorizedSignatoryTitle: 'FOR, APEX INFRASTRUCTURE',
    },
    {
      receiptNumber: 'RCP-2026-CUSTOM02',
      paymentDate: '2026-09-17',
      customerName: 'SURESHBHAI SHAH',
      customerPhone: '+91 98251 54321',
      unitNumber: 'B-701',
      floorName: '7th Floor',
      towerName: 'Tower B',
      carpetAreaSqft: 1950,
      paymentAmount: 1250000,
      paymentMode: 'Cheque',
      chequeNumber: 'CHQ-889900',
      bankName: 'State Bank of India',
      chequeDate: '2026-09-17',
    }
  );
  console.log('✔ Test 2 (Custom Receipt): Created', customReceipt.filePath, 'Buffer size:', customReceipt.buffer.length);

  // Test 3: Agreement of Sale (Banakhat - 27 pages)
  const banakhat = await fillBanakhatPdf(
    {
      projectName: 'Santora',
      developerName: 'RUDRA DEVELOPERS',
      officeAddress: 'Santora, Opp. Veltis Respair, Lubi Corporate House Road, Tragad Underpass, Ahmedabad-382421',
      reraNumber: 'PR/GJ/GANDHINAGAR/2026/001',
      tagline: '2 BHK PODIUM HOMES',
      jurisdiction: 'Ahmedabad Jurisdiction',
    },
    {
      documentNumber: 'BNK-2026-TEST01',
      bookingNumber: 'BK-2026-001',
      bookingDate: '2026-09-17',
      todayDate: '17/09/2026',
      customerName: 'RAJESHKUMAR MOHANBHAI PATEL',
      customerPhone: '+91 98250 12345',
      customerPan: 'ABCDE1234F',
      customerAddress: 'B-402, Santora, Tragad Underpass, Khoraj, Ahmedabad',
      customerAge: 38,
      customerOccupation: 'Business',
      unitNumber: 'A-402',
      towerName: 'Tower A',
      floorName: '4th Floor',
      carpetAreaSqft: 1450,
      totalAmount: 6500000,
      bookingAmount: 500000,
    }
  );
  console.log('✔ Test 3 (Banakhat): Created', banakhat.filePath, 'Buffer size:', banakhat.buffer.length);

  // Test 4: Sales Deed (Dastavej - 17 pages Legal size)
  const dastavej = await fillDastavejPdf(
    {
      projectName: 'Santora',
      developerName: 'RUDRA DEVELOPERS',
      reraNumber: 'PR/GJ/GANDHINAGAR/2026/001',
      tagline: '2 BHK PODIUM HOMES',
      jurisdiction: 'Gandhinagar / Ahmedabad Jurisdiction',
    },
    {
      documentNumber: 'DST-2026-TEST01',
      bookingNumber: 'BK-2026-001',
      todayDate: '17/09/2026',
      customerName: 'RAJESHKUMAR MOHANBHAI PATEL',
      customerPan: 'ABCDE1234F',
      customerAddress: 'B-402, Santora, Tragad Underpass, Khoraj, Ahmedabad',
      customerAge: 38,
      customerOccupation: 'Business',
      unitNumber: 'A-402',
      towerName: 'Tower A',
      floorName: '4th Floor',
      carpetAreaSqft: 1450,
      totalAmount: 6500000,
    },
    [
      {
        amount: 500000,
        mode: 'RTGS',
        refNo: 'UTR-HDFC112233',
        date: '2026-06-01',
        bankName: 'HDFC Bank',
        branchName: 'SG Highway',
      },
      {
        amount: 6000000,
        mode: 'CHEQUE',
        refNo: 'CHQ-445566',
        date: '2026-09-15',
        bankName: 'State Bank of India',
        branchName: 'Ahmedabad Main',
      },
    ]
  );
  console.log('✔ Test 4 (Dastavej): Created', dastavej.filePath, 'Buffer size:', dastavej.buffer.length);

  console.log('=== ALL TESTS COMPLETED SUCCESSFULLY ===');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
