/**
 * BuildTrack development seed.
 *
 * Creates "Patel Construction" with realistic projects, workers, materials,
 * expenses, tasks, attendance and daily reports so the app feels like a real
 * business from the first launch.
 *
 * Run:  npm run seed
 *
 * Demo login (created by this script):
 *   owner    → demo@buildtrack.app / Demo@123
 *   manager  → amit.patel@buildtrack.app / Demo@123
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Project } from '../models/Project';
import { Worker } from '../models/Worker';
import { Material } from '../models/Material';
import { MaterialTransaction } from '../models/MaterialTransaction';
import { Expense } from '../models/Expense';
import { Task } from '../models/Task';
import { DailyReport } from '../models/DailyReport';
import { Attendance } from '../models/Attendance';
import { Notification } from '../models/Notification';
import { ProjectNode } from '../models/ProjectNode';
import { Unit } from '../models/Unit';
import { Customer } from '../models/Customer';
import { Lead } from '../models/Lead';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { ConstructionStage, ensureDefaultStages } from '../models/ConstructionStage';
import { WorkItem } from '../models/WorkItem';
import { Contractor, ContractorContract, ContractorPayment } from '../models/Contractor';
import { Vendor } from '../models/Vendor';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Equipment } from '../models/Equipment';
import { Approval } from '../models/Approval';
import { Milestone } from '../models/Milestone';
import { utcDay, addDays, toDateString } from '../utils/dates';

const DEMO_PASSWORD = 'Demo@123';

function daysAgo(n: number): string {
  return toDateString(addDays(utcDay(new Date()), -n));
}

async function seed() {
  await connectDatabase();

  // ── Fresh start ────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    Project.deleteMany({}),
    Worker.deleteMany({}),
    Material.deleteMany({}),
    MaterialTransaction.deleteMany({}),
    Expense.deleteMany({}),
    Task.deleteMany({}),
    DailyReport.deleteMany({}),
    Attendance.deleteMany({}),
    Notification.deleteMany({}),
    ProjectNode.deleteMany({}),
    Unit.deleteMany({}),
    Customer.deleteMany({}),
    Lead.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    ConstructionStage.deleteMany({}),
    WorkItem.deleteMany({}),
    Contractor.deleteMany({}),
    ContractorContract.deleteMany({}),
    ContractorPayment.deleteMany({}),
    Vendor.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    Equipment.deleteMany({}),
    Approval.deleteMany({}),
    Milestone.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── Company & users ────────────────────────────────────────────
  const owner = await User.create({
    name: 'Rajesh Patel',
    email: 'demo@buildtrack.app',
    phone: '9825012345',
    passwordHash,
    role: 'owner',
  });

  const company = await Company.create({
    name: 'Patel Construction',
    ownerId: owner._id,
    phone: '9825012345',
    email: 'office@patelconstruction.in',
    address: '402, Silver Business Hub, Satellite, Ahmedabad, Gujarat 380015',
  });
  await User.updateOne({ _id: owner._id }, { companyId: company._id });

  const manager = await User.create({
    name: 'Amit Shah',
    email: 'amit.patel@buildtrack.app',
    phone: '9898011223',
    passwordHash,
    role: 'manager',
    companyId: company._id,
  });

  const engineer = await User.create({
    name: 'Kiran Desai',
    email: 'kiran.desai@buildtrack.app',
    phone: '9725045566',
    passwordHash,
    role: 'engineer',
    companyId: company._id,
  });

  // ── Projects ───────────────────────────────────────────────────
  const [greenValley, sunrise, shreeji] = await Project.create([
    {
      companyId: company._id,
      name: 'Green Valley Residency',
      projectCode: 'PRJ-0001',
      clientName: 'Nilesh Mehta',
      clientPhone: '9876500112',
      location: 'Bopal, Ahmedabad',
      address: 'TP-12, Bopal-Ghuma Road, Ahmedabad',
      projectType: 'residential',
      startDate: new Date(`${daysAgo(190)}T00:00:00Z`),
      expectedEndDate: new Date(`${toDateString(addDays(utcDay(new Date()), 115))}T00:00:00Z`),
      budget: 12_500_000,
      spentAmount: 0, // recalculated below
      status: 'active',
      progressPercentage: 58,
      description:
        'G+7 residential tower with 48 flats, clubhouse and basement parking. RCC frame structure with AAC block masonry.',
      projectManagerId: manager._id,
    },
    {
      companyId: company._id,
      name: 'Sunrise Commercial Complex',
      projectCode: 'PRJ-0002',
      clientName: 'Vadodara Retail Pvt Ltd',
      clientPhone: '9824499001',
      location: 'Vadodara, Gujarat',
      address: 'Plot 44, GIDC Makarpura, Vadodara',
      projectType: 'commercial',
      startDate: new Date(`${daysAgo(110)}T00:00:00Z`),
      expectedEndDate: new Date(`${toDateString(addDays(utcDay(new Date()), 250))}T00:00:00Z`),
      budget: 8_500_000,
      spentAmount: 0,
      status: 'active',
      progressPercentage: 34,
      description:
        'Two-storey retail complex with steel truss roofing, 60 car parking and utility block.',
      projectManagerId: manager._id,
    },
    {
      companyId: company._id,
      name: 'Shreeji Heights',
      projectCode: 'PRJ-0003',
      clientName: 'Jignesh Trivedi',
      clientPhone: '9925566778',
      location: 'Gota, Ahmedabad',
      address: 'FP-90, Gota Cross Road, Ahmedabad',
      projectType: 'residential',
      startDate: new Date(`${daysAgo(420)}T00:00:00Z`),
      expectedEndDate: new Date(`${daysAgo(20)}T00:00:00Z`),
      budget: 4_800_000,
      spentAmount: 0,
      status: 'completed',
      progressPercentage: 100,
      description: 'G+4 apartment building, 16 units. Handover completed.',
      projectManagerId: engineer._id,
    },
  ]);

  const projectIds = [greenValley._id, sunrise._id, shreeji._id];

  // ── Workers ────────────────────────────────────────────────────
  const workerSeed = [
    ['Ramesh Solanki', 'mason', 850, 'Brick & block masonry', greenValley._id],
    ['Bharat Vaghela', 'helper', 550, null, greenValley._id],
    ['Dinesh Parmar', 'electrician', 950, 'Conduit wiring & DB fitting', greenValley._id],
    ['Suresh Rathod', 'carpenter', 800, 'Shuttering & finishing carpentry', greenValley._id],
    ['Manoj Chauhan', 'operator', 1000, 'Tower crane operator', greenValley._id],
    ['Kalpesh Mistry', 'painter', 700, 'Putty, primer & emulsion', greenValley._id],
    ['Vikram Thakor', 'plumber', 850, 'CPVC & drainage lines', greenValley._id],
    ['Arjun Bhoi', 'helper', 550, null, greenValley._id],
    ['Lalji Suthar', 'carpenter', 750, 'Centering work', sunrise._id],
    ['Naresh Gohil', 'welder', 900, 'Structural fabrication', sunrise._id],
    ['Prakash Rabari', 'mason', 800, 'Plaster & coping', sunrise._id],
    ['Deepak Solanki', 'helper', 500, null, sunrise._id],
    ['Hiren Patel', 'electrician', 900, 'HT/LT panels', sunrise._id],
    ['Chandrakant Joshi', 'painter', 650, 'Weather-proof coating', shreeji._id],
    ['Mohan Harijan', 'mason', 700, 'Tile fixing', shreeji._id],
    ['Girish Prajapati', 'operator', 950, 'JCB & roller operator', sunrise._id],
  ] as const;

  const workers = await Worker.insertMany(
    workerSeed.map(([name, workerType, dailyWage, skill, projectId], i) => ({
      companyId: company._id,
      name,
      phone: `98${String(25000000 + i * 111111).slice(0, 8)}`,
      workerType,
      dailyWage,
      skill: skill ?? undefined,
      projectId,
      joiningDate: new Date(`${daysAgo(120 + i * 9)}T00:00:00Z`),
      status: 'active' as const,
    })),
  );

  const gvWorkers = workers.filter((w) => String(w.projectId) === String(greenValley._id));

  // ── Attendance: two days ago, yesterday & a few today ──────────
  const attendanceDocs: any[] = [];
  for (const dayOffset of [-2, -1]) {
    const date = addDays(utcDay(new Date()), dayOffset);
    gvWorkers.forEach((w, i) => {
      let status = 'present';
      if (dayOffset === -1 && i === 1) status = 'half_day';
      if (dayOffset === -1 && i === 4) status = 'absent';
      if (dayOffset === -2 && i === 5) status = 'leave';
      attendanceDocs.push({
        companyId: company._id,
        projectId: greenValley._id,
        workerId: w._id,
        date: utcDay(date),
        status,
        checkIn: status === 'present' || status === 'half_day' ? '08:30' : null,
        checkOut: status === 'present' ? '18:00' : status === 'half_day' ? '13:00' : null,
        overtimeHours: status === 'present' && i % 4 === 0 ? 2 : 0,
        markedBy: engineer._id,
      });
    });
  }
  // Today: only the first three marked so there's room to demo "Mark All Present".
  gvWorkers.slice(0, 3).forEach((w, i) => {
    const status = i === 2 ? 'half_day' : 'present';
    attendanceDocs.push({
      companyId: company._id,
      projectId: greenValley._id,
      workerId: w._id,
      date: utcDay(new Date()),
      status,
      checkIn: '08:30',
      checkOut: status === 'present' ? null : '13:00',
      overtimeHours: 0,
      markedBy: engineer._id,
    });
  });
  await Attendance.insertMany(attendanceDocs);

  // ── Materials ──────────────────────────────────────────────────
  const materialRows: Array<[any, string, string, string, number, number, number, number | null, string]> = [
    // project, name, category, unit, currentStock, minimumStock, avgPrice, openingStockDaysAgo, supplier
    [greenValley._id, 'UltraTech OPC 53 Grade Cement', 'cement', 'bag', 96, 150, 398, 12, 'Shakti Building Materials'],
    [greenValley._id, 'TMT Fe500D 12mm Steel', 'steel', 'kg', 420, 800, 68, 9, 'Radha Krishna Steels'],
    [greenValley._id, 'River Sand (washed)', 'sand', 'brass', 6.5, 4, 5200, 15, 'Sabarmati Sand Supply'],
    [greenValley._id, 'Clay Bricks (Class A)', 'bricks', 'piece', 18500, 10000, 9.5, 20, 'Bopal Brick Works'],
    [greenValley._id, 'Coarse Aggregate 20mm', 'aggregate', 'brass', 3.2, 2, 4300, 14, 'Aravali Crushers'],
    [greenValley._id, 'Vitrified Tiles 600x600', 'tiles', 'box', 85, 40, 780, 30, 'Kajaria Depot Ahmedabad'],
    [greenValley._id, 'Asian Paints Primer', 'paint', 'litre', 140, 60, 210, 25, 'Colour World Satellite'],
    [sunrise._id, 'Ambuja PPC Cement', 'cement', 'bag', 240, 120, 385, 8, 'Shakti Building Materials'],
    [sunrise._id, 'TMT Fe500 16mm Steel', 'steel', 'kg', 2600, 1200, 66, 10, 'Radha Krishna Steels'],
    [sunrise._id, 'River Sand', 'sand', 'brass', 9, 5, 4800, 11, 'Narmada Sand Traders'],
    [sunrise._id, 'Structural Steel ISMB 150', 'steel', 'kg', 3400, 1500, 74, 18, 'JSW Vadodara Distributor'],
    [sunrise._id, 'CPVC Pipe 25mm', 'plumbing', 'meter', 320, 200, 145, 22, 'Supreme Sanitary House'],
    [sunrise._id, 'Finolex Wire 2.5 sqmm', 'electrical', 'roll', 26, 15, 1890, 21, 'Maruti Electricals'],
    [shreeji._id, 'AAC Blocks 600x200x150', 'other', 'piece', 0, 0, 52, null, 'Eco Block Industries'],
  ];

  const materials: any[] = [];
  for (const row of materialRows) {
    const [projectId, name, category, unit, currentStock, minimumStock, averagePrice, restockDaysAgo, supplier] = row;
    const doc: any = {
      companyId: company._id,
      projectId,
      name,
      category,
      unit,
      currentStock,
      minimumStock,
      averagePrice,
      supplier,
    };
    if (restockDaysAgo != null) {
      doc.lastRestockedAt = new Date(`${daysAgo(restockDaysAgo)}T09:00:00Z`);
    }
    materials.push(await Material.create(doc));
  }

  // ── Material transactions (consistent ledger) ─────────────────
  const txns: any[] = [];
  const cementGV = materials[0];
  const steelGV = materials[1];
  const sandGV = materials[2];
  const cementSR = materials[7];

  txns.push(
    {
      companyId: company._id,
      projectId: greenValley._id,
      materialId: cementGV._id,
      type: 'purchase',
      quantity: 400,
      unitPrice: 395,
      totalAmount: 158_000,
      supplier: 'Shakti Building Materials',
      invoiceNumber: 'SBM/24-25/1187',
      date: utcDay(daysAgo(12)),
      notes: 'Slab casting supply — Tower A',
      createdBy: engineer._id,
    },
    {
      companyId: company._id,
      projectId: greenValley._id,
      materialId: steelGV._id,
      type: 'purchase',
      quantity: 1800,
      unitPrice: 67,
      totalAmount: 120_600,
      supplier: 'Radha Krishna Steels',
      invoiceNumber: 'RKS/3392',
      date: utcDay(daysAgo(9)),
      createdBy: engineer._id,
    },
    {
      companyId: company._id,
      projectId: greenValley._id,
      materialId: steelGV._id,
      type: 'usage',
      quantity: -1380,
      unitPrice: 67,
      totalAmount: 0,
      date: utcDay(daysAgo(8)),
      notes: 'Column & beam reinforcement — 4th floor slab',
      createdBy: engineer._id,
    },
    {
      companyId: company._id,
      projectId: greenValley._id,
      materialId: sandGV._id,
      type: 'purchase',
      quantity: 8,
      unitPrice: 5150,
      totalAmount: 41_200,
      supplier: 'Sabarmati Sand Supply',
      date: utcDay(daysAgo(15)),
      createdBy: manager._id,
    },
    {
      companyId: company._id,
      projectId: greenValley._id,
      materialId: sandGV._id,
      type: 'usage',
      quantity: -1.5,
      date: utcDay(daysAgo(13)),
      notes: 'Masonry mortar mix',
      createdBy: engineer._id,
    },
    {
      companyId: company._id,
      projectId: sunrise._id,
      materialId: cementSR._id,
      type: 'purchase',
      quantity: 300,
      unitPrice: 382,
      totalAmount: 114_600,
      supplier: 'Shakti Building Materials',
      invoiceNumber: 'SBM/24-25/1203',
      date: utcDay(daysAgo(8)),
      createdBy: manager._id,
    },
  );
  await MaterialTransaction.insertMany(txns);

  // ── Expenses ───────────────────────────────────────────────────
  const expenseRows: Array<[any, string, string, number, string, number, string]> = [
    // project, title, category, amount, paymentMethod, date(daysAgo), description
    [greenValley._id, 'Cement purchase — Tower A slab', 'materials', 158_000, 'bank_transfer', 12, '400 bags UltraTech OPC 53 via Shakti Building Materials'],
    [greenValley._id, 'Steel purchase Fe500D 12mm', 'materials', 120_600, 'bank_transfer', 9, '1800 kg TMT bars for column reinforcement'],
    [greenValley._id, 'Weekly labour payment', 'labor', 84_500, 'cash', 7, '8 workers × weekly wages incl. overtime'],
    [greenValley._id, 'River sand delivery', 'materials', 41_200, 'upi', 15, '8 brass washed river sand'],
    [greenValley._id, 'Tower crane hire — October', 'equipment', 65_000, 'bank_transfer', 18, 'Monthly rental incl. operator fuel'],
    [greenValley._id, 'Site electricity bill', 'electricity', 23_400, 'upi', 5, 'Torrent power connection — site office + tower hoist'],
    [greenValley._id, 'Tempo freight — bricks', 'transportation', 9_600, 'cash', 10, '2 trips from Bopal brick works'],
    [greenValley._id, 'Safety helmets & harnesses', 'miscellaneous', 12_800, 'card', 22, 'PPE stock replenishment'],
    [greenValley._id, 'Shuttering plates rent', 'equipment', 28_000, 'cash', 4, 'Centreing material for slab pour'],
    [greenValley._id, 'Water tanker supply', 'maintenance', 7_200, 'cash', 3, 'Curing water — 6 tankers'],
    [greenValley._id, 'Team lunch — slab completion', 'food', 4_300, 'upi', 8, 'Traditional treat after Tower A slab casting'],
    [sunrise._id, 'Cement purchase — foundation', 'materials', 114_600, 'bank_transfer', 8, '300 bags Ambuja PPC'],
    [sunrise._id, 'Fabrication labour', 'labor', 56_000, 'cash', 6, 'Truss fabrication team — 2 weeks'],
    [sunrise._id, 'Excavator on hire', 'equipment', 42_000, 'bank_transfer', 13, 'Foundation excavation — 7 days'],
    [sunrise._id, 'Diesel for machinery', 'transportation', 18_500, 'card', 2, 'JCB + tractor trolley fuel'],
    [sunrise._id, 'Building plan approval fees', 'permits', 35_000, 'bank_transfer', 30, 'VMC town planning charges'],
    [sunrise._id, 'Surveyor charges', 'miscellaneous', 15_000, 'upi', 27, 'Total station survey & marking'],
    [shreeji._id, 'Final painting labour', 'labor', 62_000, 'cash', 45, 'Interior emulsion — all 16 units'],
    [shreeji._id, 'Lift installation final payment', 'equipment', 310_000, 'bank_transfer', 50, 'Otis 6-passenger lift — completion milestone'],
    [shreeji._id, 'Compound wall & gate', 'materials', 88_000, 'bank_transfer', 40, 'RCC fence with MS gate'],
  ];

  const expenseDocs = expenseRows.map(([projectId, title, category, amount, paymentMethod, ago, description], i) => ({
    companyId: company._id,
    projectId,
    title,
    category,
    amount,
    paymentMethod,
    date: utcDay(daysAgo(ago)),
    description,
    createdBy: i % 3 === 0 ? engineer._id : manager._id,
  }));
  await Expense.insertMany(expenseDocs);

  // Recalculate spent amounts from actual expense sums (single source of truth).
  const sums = await Expense.aggregate([
    { $match: { companyId: company._id } },
    { $group: { _id: '$projectId', total: { $sum: '$amount' } } },
  ]);
  for (const s of sums) {
    await Project.updateOne({ _id: s._id }, { $set: { spentAmount: Math.round(s.total) } });
  }

  // ── Tasks ──────────────────────────────────────────────────────
  await Task.insertMany([
    {
      companyId: company._id, projectId: greenValley._id,
      title: 'Slab casting — Tower A, 4th floor', priority: 'urgent', status: 'in_progress',
      dueDate: utcDay(addDays(utcDay(new Date()), 1)), assignedTo: engineer._id, createdBy: manager._id,
      description: 'Coordinate RMC booking, pump placement and curing schedule.',
    },
    {
      companyId: company._id, projectId: greenValley._id,
      title: 'Electrical conduit rough-in — Floor 2', priority: 'high', status: 'blocked',
      dueDate: utcDay(daysAgo(3)), assignedTo: engineer._id, createdBy: manager._id,
      description: 'Waiting on architect approval for revised DB locations.',
    },
    {
      companyId: company._id, projectId: greenValley._id,
      title: 'Brickwork — Tower B, 2nd floor', priority: 'medium', status: 'in_progress',
      dueDate: utcDay(addDays(utcDay(new Date()), 4)), assignedTo: manager._id, createdBy: owner._id,
    },
    {
      companyId: company._id, projectId: greenValley._id,
      title: 'Reorder TMT steel before stock-out', priority: 'urgent', status: 'todo',
      dueDate: utcDay(addDays(utcDay(new Date()), 2)), assignedTo: manager._id, createdBy: engineer._id,
      description: 'Only ~420 kg left against minimum 800 kg. Raise PO with Radha Krishna Steels.',
    },
    {
      companyId: company._id, projectId: greenValley._id,
      title: 'Plumbing sleeve openings — slab 4', priority: 'high', status: 'todo',
      dueDate: utcDay(addDays(utcDay(new Date()), 3)), assignedTo: engineer._id, createdBy: manager._id,
    },
    {
      companyId: company._id, projectId: greenValley._id,
      title: 'Site office diesel generator service', priority: 'low', status: 'todo',
      dueDate: utcDay(addDays(utcDay(new Date()), 9)), createdBy: owner._id,
    },
    {
      companyId: company._id, projectId: greenValley._id,
      title: 'Third-party cube test — grade M25', priority: 'medium', status: 'completed',
      dueDate: utcDay(daysAgo(6)), assignedTo: engineer._id, createdBy: manager._id,
      completedAt: new Date(Date.now() - 6 * 86_400_000),
    },
    {
      companyId: company._id, projectId: sunrise._id,
      title: 'Steel truss erection — Bay 2 & 3', priority: 'high', status: 'in_progress',
      dueDate: utcDay(addDays(utcDay(new Date()), 6)), assignedTo: engineer._id, createdBy: owner._id,
    },
    {
      companyId: company._id, projectId: sunrise._id,
      title: 'Anchor bolt torque check', priority: 'medium', status: 'completed',
      dueDate: utcDay(daysAgo(4)), assignedTo: manager._id, createdBy: engineer._id,
      completedAt: new Date(Date.now() - 4 * 86_400_000),
    },
    {
      companyId: company._id, projectId: sunrise._id,
      title: 'Parking grade slab PCC', priority: 'medium', status: 'todo',
      dueDate: utcDay(addDays(utcDay(new Date()), 8)), createdBy: manager._id,
    },
    {
      companyId: company._id, projectId: sunrise._id,
      title: 'Fire line NOC follow-up with FSO', priority: 'high', status: 'blocked',
      dueDate: utcDay(daysAgo(1)), assignedTo: owner._id, createdBy: manager._id,
      description: 'FSO asked for revised layout showing hydrant spacing.',
    },
    {
      companyId: company._id, projectId: shreeji._id,
      title: 'Snag list closure — Unit 301 & 304', priority: 'medium', status: 'completed',
      dueDate: utcDay(daysAgo(25)), assignedTo: engineer._id, createdBy: owner._id,
      completedAt: new Date(Date.now() - 25 * 86_400_000),
    },
  ]);

  // ── Daily reports ──────────────────────────────────────────────
  await DailyReport.insertMany([
    {
      companyId: company._id, projectId: greenValley._id,
      date: utcDay(daysAgo(1)), weather: 'sunny',
      summary: 'Steady progress on 4th floor slab preparation. Steel binding completed on two bays.',
      workCompleted: 'Beam & slab shuttering tightened for bay 3–4. Column reinforcement cover blocks fixed. Masonry started on 2nd floor Tower B.',
      workersPresent: 6, materialsUsed: 'TMT 12mm ~380 kg, binding wire 8 kg, cover blocks 200 pcs',
      issues: 'Crane hydraulic leak reported in evening — operator says usable but monitor closely.',
      safetyNotes: 'All workers using harnesses at slab edge. Safety toolbox talk conducted at 8:30 AM.',
      tomorrowPlan: 'Start electrical conduiting in slab before pour. Book RMC for morning slot.',
      photos: [], createdBy: engineer._id,
    },
    {
      companyId: company._id, projectId: greenValley._id,
      date: utcDay(daysAgo(2)), weather: 'humid',
      workCompleted: 'Slab centering continued. Curing of 3rd floor columns done twice daily.',
      workersPresent: 7, materialsUsed: 'Shuttering plates ~120 nos, props 60 nos',
      tomorrowPlan: 'Complete shuttering and start steel binding.',
      createdBy: engineer._id,
    },
    {
      companyId: company._id, projectId: greenValley._id,
      date: utcDay(daysAgo(3)), weather: 'cloudy',
      workCompleted: 'Brickwork on 2nd floor reached lintel level in flats 201–204.',
      workersPresent: 5,
      issues: 'Sand quality from last lot slightly silty — informed supplier.',
      tomorrowPlan: 'Continue brickwork; plaster samples for client approval.',
      createdBy: engineer._id,
    },
    {
      companyId: company._id, projectId: sunrise._id,
      date: utcDay(daysAgo(1)), weather: 'sunny',
      workCompleted: 'Bay 2 truss bolted at 60%. Anchor bolts torqued to spec and logged.',
      workersPresent: 5, materialsUsed: 'ISMB sections 1.2 tonne, high-tensile bolts 3 boxes',
      safetyNotes: 'Welding screens installed near storage shed. Fire extinguisher refilled.',
      tomorrowPlan: 'Crane lift for ridge purlins — need road closure coordination.',
      createdBy: manager._id,
    },
    {
      companyId: company._id, projectId: sunrise._id,
      date: utcDay(daysAgo(2)), weather: 'windy',
      workCompleted: 'Base plates grouted. Survey verified column verticality within tolerance.',
      workersPresent: 4,
      issues: 'High wind gusts stopped crane operations after 3 PM.',
      createdBy: manager._id,
    },
    {
      companyId: company._id, projectId: shreeji._id,
      date: utcDay(daysAgo(21)), weather: 'sunny',
      workCompleted: 'Final snag items closed in Units 301/304. Common area deep cleaning done.',
      workersPresent: 3,
      tomorrowPlan: 'Handover walkthrough with client scheduled.',
      createdBy: engineer._id,
    },
  ]);

  // ── Notifications ──────────────────────────────────────────────
  await Notification.insertMany([
    {
      userId: owner._id,
      title: 'TMT Fe500D 12mm stock is running low',
      message: 'Green Valley Residency: only 420 kg left (minimum 800 kg). Consider reordering.',
      type: 'low_stock',
      relatedProjectId: greenValley._id,
    },
    {
      userId: owner._id,
      title: '₹1,58,000 expense was added to Green Valley Residency',
      message: '"Cement purchase — Tower A slab" recorded by Kiran Desai.',
      type: 'expense',
      relatedProjectId: greenValley._id,
    },
    {
      userId: owner._id,
      title: "Task 'Electrical conduit rough-in — Floor 2' is overdue",
      message: 'Blocked for 3 days waiting on architect approval.',
      type: 'overdue_task',
      relatedProjectId: greenValley._id,
    },
    {
      userId: manager._id,
      title: 'Green Valley Residency crossed 50% completion',
      message: 'Construction progress at Bopal is now 58%.',
      type: 'milestone',
      relatedProjectId: greenValley._id,
      isRead: true,
    },
  ]);

  // ══════════════════════════════════════════════════════════════
  //  ERP expansion seed data
  // ══════════════════════════════════════════════════════════════

  const accountant = await User.create({
    name: 'Meera Joshi',
    email: 'meera.joshi@buildtrack.app',
    phone: '9904112233',
    passwordHash,
    role: 'accountant',
    companyId: company._id,
  });
  const salesManager = await User.create({
    name: 'Rahul Bhatt',
    email: 'rahul.bhatt@buildtrack.app',
    phone: '9913445566',
    passwordHash,
    role: 'sales_manager',
    companyId: company._id,
  });
  const supervisor = await User.create({
    name: 'Jignesh Bhoi',
    email: 'jignesh.bhoi@buildtrack.app',
    phone: '9879223344',
    passwordHash,
    role: 'supervisor',
    companyId: company._id,
    assignedProjects: [greenValley._id],
  });

  // ── Project structure (Module 2) ───────────────────────────────
  const phase1 = await ProjectNode.create({
    companyId: company._id, projectId: greenValley._id, parentId: null,
    nodeType: 'phase', name: 'Phase 1', order: 1, createdBy: manager._id, progressPercentage: 58,
  });
  const towerA = await ProjectNode.create({
    companyId: company._id, projectId: greenValley._id, parentId: phase1._id,
    nodeType: 'block', name: 'Tower A', order: 1, createdBy: manager._id, progressPercentage: 72,
  });
  const towerB = await ProjectNode.create({
    companyId: company._id, projectId: greenValley._id, parentId: phase1._id,
    nodeType: 'block', name: 'Tower B', order: 2, createdBy: manager._id, progressPercentage: 44,
  });
  const floorsA: any[] = [];
  for (let f = 1; f <= 4; f += 1) {
    floorsA.push(await ProjectNode.create({
      companyId: company._id, projectId: greenValley._id, parentId: towerA._id,
      nodeType: 'floor', name: `Floor ${f}`, order: f,
      createdBy: manager._id, progressPercentage: f === 1 ? 100 : f === 2 ? 90 : f === 3 ? 70 : 30,
    }));
  }
  const floorB1 = await ProjectNode.create({
    companyId: company._id, projectId: greenValley._id, parentId: towerB._id,
    nodeType: 'floor', name: 'Floor 1', order: 1, createdBy: manager._id, progressPercentage: 80,
  });

  const unitDefs: Array<{ unitNumber: string; type: string; area: number; value: number; floorNode: any; status: string; facing?: string }> = [];
  const perFloorValue = 6_500_000;
  floorsA.forEach((floorNode, idx) => {
    for (let u = 1; u <= 3; u += 1) {
      unitDefs.push({
        unitNumber: `A${idx + 1}0${u}`,
        type: u === 3 ? '3 BHK' : '2 BHK',
        area: u === 3 ? 1650 : 1250,
        value: u === 3 ? Math.round(perFloorValue * 1.25) : perFloorValue,
        floorNode,
        status: idx === 0 ? 'sold' : idx === 1 ? 'booked' : 'available',
        facing: u === 1 ? 'East' : u === 2 ? 'North' : 'West',
      });
    }
  });
  for (let u = 1; u <= 3; u += 1) {
    unitDefs.push({
      unitNumber: `B10${u}`,
      type: '2 BHK',
      area: 1250,
      value: perFloorValue,
      floorNode: floorB1,
      status: u === 1 ? 'reserved' : 'available',
      facing: 'East',
    });
  }

  // ── Customers (Module 4) ───────────────────────────────────────
  const customersData = [
    { name: 'Nilesh Mehta', phone: '9876500112', email: 'nilesh.mehta@gmail.com', city: 'Ahmedabad', state: 'Gujarat', pan: 'ABCPT1234F', aadhaar: '432112345678', occupation: 'Textile Trader', leadSource: 'walk_in', stage: 'possession' as const },
    { name: 'Hetal Shah', phone: '9825112233', email: 'hetal.shah@yahoo.in', city: 'Ahmedabad', state: 'Gujarat', pan: 'AAECS9911K', aadhaar: null as string | null, occupation: 'Doctor', leadSource: 'reference', stage: 'booking' as const },
    { name: 'Sanjay Trivedi', phone: '9724556677', email: null as string | null, city: 'Gandhinagar', state: 'Gujarat', pan: null as string | null, aadhaar: null as string | null, occupation: 'Bank Manager', leadSource: 'website', stage: 'payment' as const },
    { name: 'Priya Deshmukh', phone: '9960334455', email: 'priya.d@gmail.com', city: 'Pune', state: 'Maharashtra', pan: 'BXPPD4567L', aadhaar: null as string | null, occupation: 'Software Engineer', leadSource: 'instagram', stage: 'negotiation' as const },
  ];
  const customers: any[] = [];
  for (const c of customersData) {
    customers.push(await Customer.create({
      companyId: company._id,
      projectId: greenValley._id,
      ...c,
      timeline: [{ stage: c.stage, note: 'Seeded history', date: new Date() }],
      assignedTo: salesManager._id,
    }));
  }

  // Attach sold/booked units to customers with bookings + payments.
  const units = [] as any[];
  let bookingSeq = 1;
  const paymentsToInsert: any[] = [];
  const bookingsCreated: any[] = [];

  async function createUnitWithSale(def: typeof unitDefs[number], customerIdx: number | null) {
    const unit = await Unit.create({
      companyId: company._id,
      projectId: greenValley._id,
      blockId: def.floorNode.parentId ?? null,
      floorId: def.floorNode._id,
      phaseId: phase1._id,
      unitNumber: def.unitNumber,
      unitType: def.type,
      areaSqft: def.area,
      carpetAreaSqft: Math.round(def.area * 0.8),
      superBuiltupAreaSqft: Math.round(def.area * 1.15),
      facing: def.facing ?? null,
      ratePerSqft: Math.round(def.value / def.area),
      totalValue: def.value,
      status: customerIdx == null ? def.status.toLowerCase() : def.status.toLowerCase(),
    });
    units.push(unit);
    if (customerIdx != null) {
      const customer = customers[customerIdx];
      const booking = await Booking.create({
        companyId: company._id,
        projectId: greenValley._id,
        unitId: unit._id,
        customerId: customer._id,
        bookingNumber: `BKG-${String(bookingSeq).padStart(4, '0')}`,
        bookingDate: utcDay(daysAgo(40 - bookingSeq * 5)),
        bookingAmount: 250_000,
        totalValue: unit.totalValue,
        salesManagerId: salesManager._id,
        status: def.status === 'sold' ? 'sold' : 'confirmed',
        createdBy: salesManager._id,
      });
      bookingSeq += 1;
      bookingsCreated.push(booking);

      const paidRatio = def.status === 'sold' ? 1 : 0.35;
      const paidAmount = Math.round(unit.totalValue * paidRatio);
      paymentsToInsert.push({
        companyId: company._id,
        projectId: greenValley._id,
        bookingId: booking._id,
        customerId: customer._id,
        unitId: unit._id,
        paymentNumber: '',
        amount: paidAmount,
        paymentType: def.status === 'sold' ? 'final' : 'installment',
        method: 'bank_transfer',
        dueDate: utcDay(daysAgo(20)),
        paidDate: utcDay(daysAgo(18)),
        status: 'paid',
        recordedBy: accountant._id,
      });
      if (def.status !== 'sold') {
        const dueDate = addDays(utcDay(new Date()), -12);
        paymentsToInsert.push({
          companyId: company._id,
          projectId: greenValley._id,
          bookingId: booking._id,
          customerId: customer._id,
          unitId: unit._id,
          paymentNumber: '',
          amount: Math.round(unit.totalValue * 0.15),
          paymentType: 'installment' as const,
          method: 'bank_transfer',
          dueDate,
          status: 'pending' as const,
          recordedBy: accountant._id,
        });
      }
      unit.currentCustomerId = customer._id;
      unit.currentBookingId = booking._id;
      await unit.save();
      return booking;
    }
    return null;
  }

  // A101/A102/A103 sold to customer 0; A201 booked by customer 1; A202 booked by customer 2.
  await createUnitWithSale(unitDefs[0], 0);
  await createUnitWithSale(unitDefs[1], 0);
  await createUnitWithSale(unitDefs[2], 0);
  await createUnitWithSale(unitDefs[3], 1);
  await createUnitWithSale(unitDefs[4], 2);
  for (let i = 5; i < unitDefs.length; i += 1) {
    await createUnitWithSale(unitDefs[i], null);
  }

  // ── Leads (Module 5) ───────────────────────────────────────────
  await Lead.insertMany([
    {
      companyId: company._id, projectId: greenValley._id,
      name: 'Kunal Kapadia', phone: '9898012345', source: 'facebook', stage: 'contacted',
      interestedIn: '2 BHK East facing', budgetMin: 5_500_000, budgetMax: 6_500_000,
      assignedTo: salesManager._id,
      followUps: [{ date: utcDay(addDays(utcDay(new Date()), -3)), note: 'Intro call done', done: true }],
      nextFollowUpDate: utcDay(addDays(utcDay(new Date()), 2)),
      notes: [{ text: 'Prefers higher floor', author: salesManager._id, createdAt: new Date() }],
    },
    {
      companyId: company._id, projectId: greenValley._id,
      name: 'Bhavna Soni', phone: '9725098765', source: 'broker', stage: 'site_visit_scheduled',
      interestedIn: '3 BHK', budgetMin: 7_000_000, budgetMax: 8_500_000,
      assignedTo: salesManager._id,
      nextFollowUpDate: utcDay(addDays(utcDay(new Date()), 1)),
      followUps: [{ date: utcDay(addDays(utcDay(new Date()), 1)), note: 'Site visit at 11 AM', done: false }],
    },
    {
      companyId: company._id, projectId: sunrise._id,
      name: 'Devendra Rathod', phone: '9925512345', source: 'walk_in', stage: 'negotiation',
      interestedIn: 'Retail shop, ground floor', budgetMin: 9_000_000, budgetMax: 11_000_000,
      assignedTo: salesManager._id,
      notes: [{ text: 'Wants 4% discount on upfront payment', author: salesManager._id, createdAt: new Date() }],
      nextFollowUpDate: utcDay(addDays(utcDay(new Date()), 3)),
    },
    {
      companyId: company._id, projectId: greenValley._id,
      name: 'Ashish Vyas', phone: '9879332211', source: 'website', stage: 'proposal_sent',
      interestedIn: '2 BHK West', assignedTo: salesManager._id,
      nextFollowUpDate: utcDay(addDays(utcDay(new Date()), -1)),
      followUps: [{ date: utcDay(addDays(utcDay(new Date()), -1)), note: 'Share cost sheet', done: false }],
    },
    {
      companyId: company._id, projectId: shreeji._id,
      name: 'Manish Parikh', phone: '9825556677', source: 'reference', stage: 'lost',
      lostReason: 'Chose a competitor near Gota bridge', assignedTo: salesManager._id,
    },
  ]);

  // Payment numbers after all inserts.
  let paySeq = 1;
  for (const p of paymentsToInsert) p.paymentNumber = `PAY-${String(paySeq++).padStart(4, '0')}`;
  await Payment.insertMany(paymentsToInsert);

  // Booking approval pending on the reserved unit flow (demo).
  await Approval.create({
    companyId: company._id,
    projectId: greenValley._id,
    entityType: 'expense',
    entityId: null,
    title: 'Weekly diesel purchase — ₹18,500',
    amount: 18_500,
    requestedBy: engineer._id,
    steps: [
      { level: 0, role: 'site_engineer', label: 'site engineer', status: 'approved', actedBy: engineer._id, actedAt: new Date(), comment: 'Raised by me' },
      { level: 1, role: 'project_manager', label: 'project manager', status: 'pending' },
      { level: 2, role: 'owner', label: 'owner', status: 'pending' },
    ],
    currentLevel: 1,
    status: 'pending',
  });

  // ── Construction stages + work items (Modules 9/10) ───────────
  await ensureDefaultStages(company._id, greenValley._id);
  const stageProgress: Record<string, [number, string]> = {
    excavation: [100, 'completed'],
    foundation: [100, 'completed'],
    rcc_structure: [75, 'in_progress'],
    brickwork: [55, 'in_progress'],
    plaster: [25, 'in_progress'],
    electrical: [20, 'in_progress'],
    plumbing: [15, 'in_progress'],
  };
  const stages = await ConstructionStage.find({ projectId: greenValley._id });
  for (const s of stages) {
    const cfg = stageProgress[s.name];
    if (cfg) {
      s.progressPercentage = cfg[0];
      s.status = cfg[1] as any;
      s.startDate = new Date(`${daysAgo(180)}T00:00:00Z`);
      s.endDate = s.progressPercentage >= 100 ? new Date(`${daysAgo(90)}T00:00:00Z`) : null;
      await s.save();
    }
  }

  await WorkItem.insertMany([
    { companyId: company._id, projectId: greenValley._id, nodeId: floorsA[0]._id, name: 'Slab casting & curing', stageName: 'rcc_structure', progressPercentage: 100, status: 'completed', startDate: new Date(`${daysAgo(120)}T00:00:00Z`), endDate: new Date(`${daysAgo(60)}T00:00:00Z`), createdBy: engineer._id },
    { companyId: company._id, projectId: greenValley._id, nodeId: floorsA[0]._id, name: 'Brickwork & plaster', stageName: 'brickwork', progressPercentage: 100, status: 'completed', startDate: new Date(`${daysAgo(80)}T00:00:00Z`), endDate: new Date(`${daysAgo(20)}T00:00:00Z`), createdBy: engineer._id },
    { companyId: company._id, projectId: greenValley._id, nodeId: floorsA[1]._id, name: 'Column reinforcement', stageName: 'rcc_structure', progressPercentage: 95, status: 'in_progress', startDate: new Date(`${daysAgo(70)}T00:00:00Z`), createdBy: engineer._id },
    { companyId: company._id, projectId: greenValley._id, nodeId: floorsA[2]._id, name: 'Slab centering & steel', stageName: 'rcc_structure', progressPercentage: 70, status: 'in_progress', startDate: new Date(`${daysAgo(40)}T00:00:00Z`), createdBy: engineer._id },
    { companyId: company._id, projectId: greenValley._id, nodeId: floorsA[3]._id, name: 'Shuttering work', stageName: 'rcc_structure', progressPercentage: 30, status: 'in_progress', startDate: new Date(`${daysAgo(12)}T00:00:00Z`), createdBy: engineer._id },
    { companyId: company._id, projectId: greenValley._id, nodeId: floorB1._id, name: 'Masonry — Tower B F1', stageName: 'brickwork', progressPercentage: 80, status: 'in_progress', startDate: new Date(`${daysAgo(50)}T00:00:00Z`), createdBy: engineer._id },
  ]);

  // ── Contractors & contracts (Modules 12/13) ────────────────────
  const [shreeContractor, jalContractor, voltContractor] = await Contractor.create([
    { companyId: company._id, name: 'Bhikhabhai Rathod', companyName: 'Shreeji RCC Works', phone: '9824455667', workTypes: ['rcc'], gstNumber: '24ABCDE1234F1Z5' },
    { companyId: company._id, name: 'Vinod Mistri', companyName: 'Jal Plumbing Solutions', phone: '9909988776', workTypes: ['plumbing'] },
    { companyId: company._id, name: 'Alpesh Katariya', companyName: 'Volt Electricals', phone: '9714778899', workTypes: ['electrical', 'other'], gstNumber: '24AACCV5678K1Z2' },
  ]);
  const contractRCC = await ContractorContract.create({
    companyId: company._id, projectId: greenValley._id, contractorId: shreeContractor._id,
    scope: 'RCC frame — slabs, columns & beams (Tower A+B)', contractValue: 3_200_000, paidAmount: 1_850_000,
    startDate: new Date(`${daysAgo(170)}T00:00:00Z`), status: 'active',
  });
  const contractPlumb = await ContractorContract.create({
    companyId: company._id, projectId: greenValley._id, contractorId: jalContractor._id,
    scope: 'CPVC plumbing lines — all towers', contractValue: 900_000, paidAmount: 300_000,
    startDate: new Date(`${daysAgo(90)}T00:00:00Z`), status: 'active',
  });
  await ContractorContract.create({
    companyId: company._id, projectId: sunrise._id, contractorId: voltContractor._id,
    scope: 'HT/LT panels & site electrification', contractValue: 650_000, paidAmount: 650_000,
    startDate: new Date(`${daysAgo(100)}T00:00:00Z`), endDate: new Date(`${daysAgo(10)}T00:00:00Z`), status: 'completed',
  });
  await ContractorPayment.insertMany([
    { companyId: company._id, projectId: greenValley._id, contractId: contractRCC._id, contractorId: shreeContractor._id, paymentType: 'advance', amount: 600_000, date: utcDay(daysAgo(165)), method: 'bank_transfer', reference: 'NEFT/88231', createdBy: manager._id },
    { companyId: company._id, projectId: greenValley._id, contractId: contractRCC._id, contractorId: shreeContractor._id, paymentType: 'running_bill', amount: 750_000, date: utcDay(daysAgo(80)), method: 'cheque', reference: 'CHQ/551203', createdBy: manager._id },
    { companyId: company._id, projectId: greenValley._id, contractId: contractRCC._id, contractorId: shreeContractor._id, paymentType: 'running_bill', amount: 500_000, date: utcDay(daysAgo(21)), method: 'bank_transfer', createdBy: accountant._id },
    { companyId: company._id, projectId: greenValley._id, contractId: contractPlumb._id, contractorId: jalContractor._id, paymentType: 'advance', amount: 200_000, date: utcDay(daysAgo(85)), method: 'upi', createdBy: manager._id },
    { companyId: company._id, projectId: greenValley._id, contractId: contractPlumb._id, contractorId: jalContractor._id, paymentType: 'running_bill', amount: 100_000, date: utcDay(daysAgo(30)), method: 'cash', createdBy: supervisor._id },
  ]);

  // ── Vendor + purchase orders (Modules 14/15) ───────────────────
  const vendorShakti = await Vendor.create({
    companyId: company._id, name: 'Shakti Building Materials', contactPerson: 'Pareshbhai Shah',
    phone: '9825077889', email: 'sales@shaktibuildmat.in', address: 'Ring Road, Sarkhej, Ahmedabad',
    gstNumber: '24AABCS1429P1ZF', materialsSupplied: ['cement', 'sand', 'aggregate'],
  });
  const vendorRadha = await Vendor.create({
    companyId: company._id, name: 'Radha Krishna Steels', contactPerson: 'Mukesh Agrawal',
    phone: '9377778899', gstNumber: '24AAECR8811M1ZQ', materialsSupplied: ['steel'],
  });
  const poCement = await PurchaseOrder.create({
    companyId: company._id, projectId: greenValley._id, vendorId: vendorShakti._id,
    poNumber: 'PO-0001',
    items: [
      { materialName: 'UltraTech OPC 53 Grade Cement', category: 'cement', quantity: 400, unit: 'bag', rate: 395, amount: 158_000 },
      { materialName: 'River Sand (washed)', category: 'sand', quantity: 4, unit: 'brass', rate: 5200, amount: 20_800 },
    ],
    totalAmount: 178_800, paidAmount: 178_800, status: 'closed',
    orderedAt: new Date(`${daysAgo(16)}T09:00:00Z`), deliveredAt: new Date(`${daysAgo(13)}T15:00:00Z`),
    closedAt: new Date(`${daysAgo(12)}T10:00:00Z`), invoiceNumber: 'SBM/24-25/1187',
    expectedDeliveryDate: utcDay(daysAgo(13)),
    requestedBy: manager._id, approvedBy: owner._id,
  });
  const poSteel = await PurchaseOrder.create({
    companyId: company._id, projectId: greenValley._id, vendorId: vendorRadha._id,
    poNumber: 'PO-0002',
    items: [
      { materialName: 'TMT Fe500D 12mm Steel', category: 'steel', quantity: 1500, unit: 'kg', rate: 68, amount: 102_000 },
    ],
    totalAmount: 102_000, paidAmount: 50_000, status: 'delivered',
    orderedAt: new Date(`${daysAgo(10)}T11:00:00Z`), deliveredAt: new Date(`${daysAgo(9)}T17:30:00Z`),
    invoiceNumber: 'RKS/3401', expectedDeliveryDate: utcDay(daysAgo(9)),
    requestedBy: engineer._id, approvedBy: owner._id,
  });
  await PurchaseOrder.create({
    companyId: company._id, projectId: greenValley._id, vendorId: vendorShakti._id,
    poNumber: 'PO-0003',
    items: [
      { materialName: 'Ambuja PPC Cement', category: 'cement', quantity: 250, unit: 'bag', rate: 385, amount: 96_250 },
    ],
    totalAmount: 96_250, paidAmount: 0, status: 'approved',
    expectedDeliveryDate: utcDay(addDays(utcDay(new Date()), 5)),
    requestedBy: manager._id,
  });
  await Approval.create({
    companyId: company._id,
    projectId: greenValley._id,
    entityType: 'purchase_order',
    entityId: poSteel._id,
    title: `PO ${poSteel.poNumber}`,
    amount: poSteel.totalAmount,
    requestedBy: engineer._id,
    steps: [
      { level: 0, role: 'site_engineer', label: 'site engineer', status: 'approved', actedBy: engineer._id, actedAt: new Date(), comment: 'Raised by me' },
      { level: 1, role: 'project_manager', label: 'project manager', status: 'approved', actedBy: manager._id, actedAt: new Date() },
      { level: 2, role: 'owner', label: 'owner', status: 'approved', actedBy: owner._id, actedAt: new Date() },
    ],
    currentLevel: 3,
    status: 'approved',
    completedAt: new Date(),
  });
  void poCement;

  // ── Equipment (Module 16) ──────────────────────────────────────
  await Equipment.insertMany([
    {
      companyId: company._id, projectId: greenValley._id,
      equipmentNumber: 'EQ-CRANE-01', name: 'Tower Crane — Zoomlion 5610', type: 'crane',
      ownership: 'rented', rentalCostPerDay: 2200, operatingHours: 1450,
      fuelCostTotal: 96_000, maintenanceCostTotal: 42_000, status: 'active',
      usageEntries: [
        { date: utcDay(daysAgo(2)), hoursUsed: 9, fuelCost: 3200 },
        { date: utcDay(daysAgo(1)), hoursUsed: 10, fuelCost: 3400 },
      ],
    },
    {
      companyId: company._id, projectId: greenValley._id,
      equipmentNumber: 'EQ-MIXER-02', name: 'Concrete Mixer 10/7', type: 'mixer',
      ownership: 'owned', purchaseCost: 185_000, purchaseDate: new Date(`${daysAgo(400)}T00:00:00Z`),
      operatingHours: 2600, fuelCostTotal: 74_000, maintenanceCostTotal: 28_500, status: 'active',
      usageEntries: [{ date: utcDay(daysAgo(1)), hoursUsed: 7, fuelCost: 1100 }],
    },
    {
      companyId: company._id, projectId: sunrise._id,
      equipmentNumber: 'EQ-GEN-01', name: 'Silent DG 62.5 kVA', type: 'generator',
      ownership: 'owned', purchaseCost: 720_000, purchaseDate: new Date(`${daysAgo(300)}T00:00:00Z`),
      operatingHours: 1900, fuelCostTotal: 210_000, maintenanceCostTotal: 36_000, status: 'maintenance',
    },
    {
      companyId: company._id, projectId: null,
      equipmentNumber: 'EQ-JCB-01', name: 'JCB 3DX', type: 'jcb',
      ownership: 'rented', rentalCostPerDay: 2800, fuelCostTotal: 158_000, maintenanceCostTotal: 0, status: 'idle',
    },
  ]);

  // ── Milestones (Module 19) ─────────────────────────────────────
  await Milestone.insertMany([
    { companyId: company._id, projectId: greenValley._id, name: 'Foundation Complete', dueDate: utcDay(daysAgo(120)), completedAt: new Date(`${daysAgo(118)}T00:00:00Z`), status: 'completed' },
    { companyId: company._id, projectId: greenValley._id, name: 'Structure Complete', dueDate: utcDay(addDays(utcDay(new Date()), 25)), status: 'upcoming' },
    { companyId: company._id, projectId: greenValley._id, name: 'Brickwork Complete', dueDate: utcDay(addDays(utcDay(new Date()), 60)), status: 'upcoming' },
    { companyId: company._id, projectId: greenValley._id, name: 'Finishing Complete', dueDate: utcDay(addDays(utcDay(new Date()), -6)), status: 'upcoming' },
    { companyId: company._id, projectId: greenValley._id, name: 'Handover Ready', dueDate: utcDay(addDays(utcDay(new Date()), 115)), status: 'upcoming' },
    { companyId: company._id, projectId: sunrise._id, name: 'Structure Complete', dueDate: utcDay(addDays(utcDay(new Date()), 90)), status: 'upcoming' },
  ]);

  console.log('✅ Seed complete!\n');
  console.log('   Demo credentials:');
  console.log('   ─ Owner        → demo@buildtrack.app / Demo@123');
  console.log('   ─ Manager      → amit.patel@buildtrack.app / Demo@123');
  console.log('   ─ Engineer     → kiran.desai@buildtrack.app / Demo@123');
  console.log('   ─ Accountant   → meera.joshi@buildtrack.app / Demo@123');
  console.log('   ─ Sales Mgr    → rahul.bhatt@buildtrack.app / Demo@123');
  console.log('   ─ Supervisor   → jignesh.bhoi@buildtrack.app / Demo@123');
  void projectIds;
}

seed()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Seed failed:', err instanceof Error ? err.message : err);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });

void env;
