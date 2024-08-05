import { Context } from '@hello.nrfcloud.com/proto-map/api'
import type { PublicDeviceRecord } from '../devices/publicDevicesRepo.js'

import jwt from 'jsonwebtoken'

export const deviceJWT = (
	device: Pick<PublicDeviceRecord, 'id' | 'deviceId' | 'model'>,
	{
		privateKey,
		keyId,
	}: {
		privateKey: string
		keyId: string
	},
): string =>
	jwt.sign(
		{
			'@context': Context.deviceJWT.toString(),
			id: device.id,
			deviceId: device.deviceId,
			model: device.model,
		},
		privateKey,
		{
			algorithm: 'ES512',
			expiresIn: '1h',
			audience: 'hello.nrfcloud.com',
			keyid: keyId,
		},
	)
