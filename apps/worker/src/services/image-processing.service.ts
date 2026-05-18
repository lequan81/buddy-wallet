/**
 * Image Processing Service - Pure Functions
 * @logicType worker
 *
 * Uses Bun.Image for native image processing with EXIF removal.
 * All processed images have EXIF metadata stripped after orientation correction.
 *
 * Moved from @repo/api to apps/worker to eliminate worker→API dependency.
 */

const MAX_PIXELS = 4096 * 4096;

export async function processAvatar(buffer: Buffer): Promise<{
	thumbnail: Buffer;
	medium: Buffer;
}> {
	const img = new Bun.Image(buffer, { maxPixels: MAX_PIXELS, autoOrient: true });

	const thumbnail = Buffer.from(
		await img
			.resize(64, 64, { fit: 'inside' })
			.webp({ quality: 85 })
			.bytes()
	);

	const medium = Buffer.from(
		await img
			.resize(400, 400, { fit: 'inside' })
			.webp({ quality: 85 })
			.bytes()
	);

	return { thumbnail, medium };
}

export async function processProof(buffer: Buffer): Promise<{
	display: Buffer;
	download: Buffer;
}> {
	const img = new Bun.Image(buffer, { maxPixels: MAX_PIXELS, autoOrient: true });

	const display = Buffer.from(
		await img
			.resize(1920, 1080, { fit: 'inside' })
			.webp({ quality: 80 })
			.bytes()
	);

	const download = Buffer.from(
		await img
			.resize(1920, 1080, { fit: 'inside' })
			.jpeg({ quality: 100 })
			.bytes()
	);

	return { display, download };
}
