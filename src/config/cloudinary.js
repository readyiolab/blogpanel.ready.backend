const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { cloudinaryFolder } = require('./dotenvConfig');

// Configure Cloudinary with credentials from environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer to use Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: cloudinaryFolder,
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
        public_id: (req, file) => {
            // Remove extension and whitespace from original name to create a safe public ID
            const name = file.originalname.split('.')[0].replace(/\s+/g, '-');
            return `${name}-${Date.now()}`;
        },
    },
});

// Create Multer upload instance
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

/**
 * Delete an image previously uploaded to this app's Cloudinary folder.
 * URLs from other folders or hosts are ignored.
 */
const destroyUploadedImage = (imageUrl) => {
    if (!imageUrl || !imageUrl.includes('cloudinary.com') || !imageUrl.includes(`/${cloudinaryFolder}/`)) {
        return Promise.resolve();
    }
    const filenameWithExt = imageUrl.split('/').pop();
    const publicId = filenameWithExt.split('.')[0];
    return cloudinary.uploader.destroy(`${cloudinaryFolder}/${publicId}`).catch((error) => {
        console.error('Failed to delete image from Cloudinary:', error);
    });
};

module.exports = {
    cloudinary,
    upload,
    destroyUploadedImage,
};
