import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

/**
 * Image storage strategy:
 *  - When Cloudinary credentials are configured, uploads go to Cloudinary.
 *  - Otherwise files are written to local disk (server/uploads) and served
 *    statically from /uploads so the app remains fully functional in dev.
 */
if (env.cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const isCloudinaryEnabled = () => env.cloudinaryConfigured;

export { cloudinary };
