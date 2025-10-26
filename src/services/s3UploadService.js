import fs from 'fs';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import { Upload } from '@aws-sdk/lib-storage';
import multer from 'multer';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('video') ||
      file.mimetype.startsWith('image')
    ) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          'File is not a video or an image. Please upload only these two.',
          400
        )
      );
    }
  },
});

/**
 * Upload a large file to AWS S3 in parallel using the AWS SDK v3.
 * @param {string} filePath - The path to the file to upload.
 * @param {string} fileName - The name of the file to upload.
 * @returns {Promise<object>} - The result of the upload, which includes the
 *   `ETag` of the uploaded file.
 */
export const uploadLargeFile = async (filePath, fileName) => {
  console.log('We started');
  const parallelUpload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: fs.createReadStream(filePath), // Stream-based
      // ACL: 'public-read', // Set the ACL to public-read
    },
    partSize: 1024 * 1024 * 100, // 100MB chunks
    queueSize: 4, // Parallel uploads
  });

  console.log('We ended!');
  return parallelUpload.done();
};

export const videoUpload = upload.single('video');
export const attachmentUpload = upload.single('attachment');
