export interface UploadedBlob {
  blobName: string;
  url: string;
  size: number;
}

export interface SignedUrl {
  signedUrl: string;
  blobName: string;
  expiresAt: Date;
}
