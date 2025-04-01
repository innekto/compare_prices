import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { v4 as uuidv4 } from 'uuid';

type CloudinaryResponse = UploadApiResponse | UploadApiErrorResponse;

@Injectable()
export class CloudinaryService {
  async uploadFile(
    buffer: Buffer,
    fileName: string,
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>((resolve, reject) => {
      const uniqueFileName = `${fileName}-${Date.now()}-${uuidv4()}.json`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: uniqueFileName,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }
}
