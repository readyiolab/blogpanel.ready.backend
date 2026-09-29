const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { uploadFolder, cloudinaryFolder, spaces } = require('./dotenvConfig');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

const cloudinaryEnabled = Boolean(
    process.env.CLOUDINARY_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryEnabled) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
}

// Spaces is S3-compatible. The signing region must be us-east-1; the real
// region is in the endpoint. Checksums are only sent when required because
// Spaces rejects the newer default checksum headers.
const s3 = spaces.enabled
    ? new S3Client({
        endpoint: spaces.endpoint,
        region: 'us-east-1',
        forcePathStyle: false,
        credentials: { accessKeyId: spaces.key, secretAccessKey: spaces.secret },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
    })
    : null;

const safeBaseName = (originalname) => path.parse(originalname).name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';

const buildSpacesUpload = () => {
    const memoryUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: MAX_FILE_SIZE },
        fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_TYPES[file.mimetype])),
    });

    const pushToSpaces = async (req, res, next) => {
        if (!req.file) return next();
        try {
            const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            const key = `${uploadFolder}/${safeBaseName(req.file.originalname)}-${suffix}.${IMAGE_TYPES[req.file.mimetype]}`;
            await s3.send(new PutObjectCommand({
                Bucket: spaces.bucket,
                Key: key,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
                ACL: 'public-read',
                CacheControl: 'public, max-age=31536000, immutable',
            }));
            req.file.path = `${spaces.publicUrl}/${key}`;
            next();
        } catch (error) {
            next(error);
        }
    };

    return { single: (field) => [memoryUpload.single(field), pushToSpaces] };
};

const buildCloudinaryUpload = () => multer({
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: cloudinaryFolder,
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
            public_id: (req, file) => `${safeBaseName(file.originalname)}-${Date.now()}`,
        },
    }),
    limits: { fileSize: MAX_FILE_SIZE },
});

// Admin panel uploads go to DigitalOcean Spaces when configured, otherwise Cloudinary.
const upload = spaces.enabled ? buildSpacesUpload() : buildCloudinaryUpload();

const spacesPrefix = spaces.enabled ? `${spaces.publicUrl}/${uploadFolder}/` : null;

/** True for images this app uploaded (and may therefore delete). */
const isManagedImage = (imageUrl) => {
    if (!imageUrl) return false;
    if (spacesPrefix && imageUrl.startsWith(spacesPrefix)) return true;
    return cloudinaryEnabled
        && imageUrl.includes('res.cloudinary.com')
        && imageUrl.includes(`/${cloudinaryFolder}/`);
};

/**
 * Delete an image previously uploaded by this app (Spaces or Cloudinary).
 * Any other URL is ignored. Never throws.
 */
const destroyUploadedImage = (imageUrl) => {
    if (!isManagedImage(imageUrl)) return Promise.resolve();

    if (spacesPrefix && imageUrl.startsWith(spacesPrefix)) {
        const key = imageUrl.slice(spaces.publicUrl.length + 1).split('?')[0];
        return s3.send(new DeleteObjectCommand({ Bucket: spaces.bucket, Key: key })).catch((error) => {
            console.error('Failed to delete image from Spaces:', error.message);
        });
    }

    const publicId = imageUrl.split('/').pop().split('.')[0];
    return cloudinary.uploader.destroy(`${cloudinaryFolder}/${publicId}`).catch((error) => {
        console.error('Failed to delete image from Cloudinary:', error);
    });
};

module.exports = {
    upload,
    isManagedImage,
    destroyUploadedImage,
    storageDriver: spaces.enabled ? 'spaces' : 'cloudinary',
};
