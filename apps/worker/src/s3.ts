import { STORAGE_CONFIG, buildS3Endpoint } from '@repo/config';
import { toOptional } from '@repo/utils';

const resolvedEndpoint = buildS3Endpoint(STORAGE_CONFIG.ENDPOINT, STORAGE_CONFIG.SSL);

export const s3Client = new Bun.S3Client({
	endpoint: toOptional(resolvedEndpoint),
	region: toOptional(STORAGE_CONFIG.REGION),
	bucket: toOptional(STORAGE_CONFIG.BUCKET),
	accessKeyId: toOptional(STORAGE_CONFIG.ACCESS_KEY),
	secretAccessKey: toOptional(STORAGE_CONFIG.SECRET_KEY),
	virtualHostedStyle: !STORAGE_CONFIG.FORCE_PATH_STYLE
});
