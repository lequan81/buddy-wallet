export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export function getDeviceInfo(): { deviceName: string; deviceType: DeviceType } {
	if (typeof navigator === 'undefined') {
		return { deviceName: 'Web Browser', deviceType: 'desktop' };
	}

	const ua = navigator.userAgent;
	let deviceType: DeviceType = 'desktop';

	// Device detection
	const typePatterns = [
		{ regex: /tablet|ipad|playbook|silk/i, type: 'tablet' as const },
		{ regex: /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i, type: 'mobile' as const }
	];

	for (const { regex, type } of typePatterns) {
		if (regex.test(ua)) {
			deviceType = type;
			break;
		}
	}

	// Browser detection - more specific patterns first
	const browsers = [
		{ regex: /Edg\//i, name: 'Edge' },
		{ regex: /OPR\//i, name: 'Opera' },
		{ regex: /Firefox/i, name: 'Firefox' },
		{ regex: /CriOS/i, name: 'Chrome' }, // Chrome on iOS
		{ regex: /Chrome/i, name: 'Chrome' },
		{ regex: /Safari/i, name: 'Safari' },
	];

	let browser = '';
	for (const { regex, name } of browsers) {
		if (regex.test(ua)) {
			browser = name;
			break;
		}
	}

	// OS detection
	const os = [
		{ regex: /Windows/i, name: 'Windows' },
		{ regex: /Macintosh|Mac OS X/i, name: 'macOS' },
		{ regex: /Linux/i, name: 'Linux' },
		{ regex: /Android/i, name: 'Android' },
		{ regex: /iOS|iPhone|iPad/i, name: 'iOS' }
	];

	let osName = '';
	for (const { regex, name } of os) {
		if (regex.test(ua)) {
			osName = name;
			break;
		}
	}

	// Build device name with better fallback
	let deviceName: string;
	if (browser && osName) {
		deviceName = `${browser} on ${osName}`;
	} else if (browser) {
		deviceName = browser;
	} else if (osName) {
		deviceName = `Browser on ${osName}`;
	} else {
		deviceName = 'Web Browser';
	}

	return { deviceName, deviceType };
}
