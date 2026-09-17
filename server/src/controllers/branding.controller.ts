import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Project } from '../models/Project';
import { Company } from '../models/Company';
import { ApiError, sendSuccess } from '../utils/apiResponse';
import type { AuthUser } from '../types';

type Req = Request & { validatedBody?: any };

const BRANDING_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'branding');

function ensureBrandingDir() {
  if (!fs.existsSync(BRANDING_UPLOAD_DIR)) {
    fs.mkdirSync(BRANDING_UPLOAD_DIR, { recursive: true });
  }
}

/** Get complete Project Configuration (Branding, Theme, Receipt Config, Rules) */
export async function getProjectConfiguration(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  const company = await Company.findById(user.companyId);

  // Provide company fallback if project fields are empty
  const branding = {
    ...project.branding,
    companyName: project.branding?.companyName || company?.name || 'Real Estate Developer',
    developerName: project.branding?.developerName || project.builderName || company?.name || 'Developer',
    phone: project.branding?.phone || company?.phone || '',
    email: project.branding?.email || company?.email || '',
    officeAddress: project.branding?.officeAddress || company?.address || '',
    siteAddress: project.branding?.siteAddress || project.address || project.location || '',
    gstNumber: project.branding?.gstNumber || company?.gstin || '',
    reraNumber: project.branding?.reraNumber || project.reraNumber || '',
    logoUrl: project.branding?.logoUrl || company?.logo || null,
  };

  sendSuccess(res, {
    project: {
      _id: project._id,
      name: project.name,
      projectCode: project.projectCode,
      location: project.location,
      address: project.address,
      status: project.status,
      branding,
      theme: project.theme,
      receiptConfig: project.receiptConfig,
      legalDocConfig: project.legalDocConfig,
      bookingRules: project.bookingRules,
      paymentRules: project.paymentRules,
    },
  });
}

/** Update Project Branding */
export async function updateProjectBranding(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;
  const body = req.validatedBody || req.body;

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  project.branding = {
    ...project.branding,
    ...body,
  };

  // Sync with root properties for backward compatibility
  if (body.developerName) project.builderName = body.developerName;
  if (body.reraNumber) project.reraNumber = body.reraNumber;

  await project.save();
  sendSuccess(res, { branding: project.branding }, 'Project branding updated successfully');
}

/** Upload / Replace Project Logo */
export async function uploadProjectLogo(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  ensureBrandingDir();
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const singleFile = req.file;

  if (!files && !singleFile) {
    throw ApiError.badRequest('No logo file uploaded');
  }

  const logoFile = singleFile || files?.logo?.[0];
  const logoDarkFile = files?.logoDark?.[0];

  if (logoFile) {
    const ext = path.extname(logoFile.originalname) || '.png';
    const filename = `logo_${projectId}_${Date.now()}${ext}`;
    const filePath = path.join(BRANDING_UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, logoFile.buffer);

    // Clean up old logo if it was local
    if (project.branding?.logoUrl?.startsWith('/uploads/branding/')) {
      const oldPath = path.resolve(process.cwd(), project.branding.logoUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    if (!project.branding) project.branding = {};
    project.branding.logoUrl = `/uploads/branding/${filename}`;
  }

  if (logoDarkFile) {
    const ext = path.extname(logoDarkFile.originalname) || '.png';
    const filenameDark = `logo_dark_${projectId}_${Date.now()}${ext}`;
    const filePathDark = path.join(BRANDING_UPLOAD_DIR, filenameDark);
    fs.writeFileSync(filePathDark, logoDarkFile.buffer);

    if (project.branding?.logoDarkUrl?.startsWith('/uploads/branding/')) {
      const oldDarkPath = path.resolve(process.cwd(), project.branding.logoDarkUrl.replace(/^\//, ''));
      if (fs.existsSync(oldDarkPath)) {
        try { fs.unlinkSync(oldDarkPath); } catch {}
      }
    }

    if (!project.branding) project.branding = {};
    project.branding.logoDarkUrl = `/uploads/branding/${filenameDark}`;
  }

  await project.save();
  sendSuccess(res, { branding: project.branding }, 'Logo updated successfully');
}

/** Delete Project Logo (reverts to default) */
export async function deleteProjectLogo(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;
  const isDark = req.query.mode === 'dark';

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  if (project.branding) {
    const targetUrl = isDark ? project.branding.logoDarkUrl : project.branding.logoUrl;
    if (targetUrl?.startsWith('/uploads/branding/')) {
      const oldPath = path.resolve(process.cwd(), targetUrl.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    if (isDark) {
      project.branding.logoDarkUrl = null;
    } else {
      project.branding.logoUrl = null;
    }
    await project.save();
  }

  sendSuccess(res, { branding: project.branding }, 'Logo deleted successfully');
}

/** Update Project Theming Colors */
export async function updateProjectTheme(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;
  const body = req.validatedBody || req.body;

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  project.theme = {
    ...project.theme,
    ...body,
  };

  await project.save();
  sendSuccess(res, { theme: project.theme }, 'Project theme colors updated successfully');
}

/** Update Receipt Configuration */
export async function updateReceiptConfig(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;
  const body = req.validatedBody || req.body;

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  project.receiptConfig = {
    ...project.receiptConfig,
    ...body,
  };

  await project.save();
  sendSuccess(res, { receiptConfig: project.receiptConfig }, 'Receipt configuration updated successfully');
}

/** Update Project Business Rules (Booking & Payment) */
export async function updateProjectRules(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;
  const body = req.validatedBody || req.body;

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  if (body.bookingRules) {
    project.bookingRules = { ...project.bookingRules, ...body.bookingRules };
  }
  if (body.paymentRules) {
    project.paymentRules = { ...project.paymentRules, ...body.paymentRules };
  }

  await project.save();
  sendSuccess(res, { bookingRules: project.bookingRules, paymentRules: project.paymentRules }, 'Project rules updated successfully');
}

/** Update Legal Document Configuration (Banakhat / Dastavej) */
export async function updateLegalDocConfig(req: Req, res: Response) {
  const user = req.user! as AuthUser;
  const { projectId } = req.params;
  const body = req.validatedBody || req.body;

  const project = await Project.findOne({ _id: projectId, companyId: user.companyId });
  if (!project) throw ApiError.notFound('Project not found');

  project.legalDocConfig = {
    ...project.legalDocConfig,
    ...body,
  };

  await project.save();
  sendSuccess(res, { legalDocConfig: project.legalDocConfig }, 'Legal document configuration updated successfully');
}

