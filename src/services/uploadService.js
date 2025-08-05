import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

import AppError from '../utils/appError.js';

const options = {
  min: 10000000000,
  max: 20000000000,
  integer: true,
};

cloudinary.config({
  cloud_name: 'thasquirrie',
  api_key: '756853117967378',
  api_secret: 'bHqQJYg2vBDc6jlfmsvK3CYKPjY',
});

const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    console.log({ file });
    cb(null, file.originalname);
  },
});
const multerFilter = (req, file, cb) => {
  console.log(file.mimetype);
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(
      new AppError('File is not an image. Please upload only an image.', 400),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter: multerFilter,
});

export const uploadAttachments = upload.fields([
  {
    name: 'documents',
    maxCount: 4,
  },
  {
    name: 'image',
    maxCount: 1,
  },
]);

export const uploadUserImage = upload.single('image');

export const uploadFile = upload.single('attachment');
export const uploadDocument = upload.single('document');
