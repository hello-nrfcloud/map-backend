import { Context } from '@hello.nrfcloud.com/proto-map/api'

import jwt from 'jsonwebtoken'
import { normalizeEmail } from '../users/normalizeEmail.js'

export const userJWT = (
	email: string,
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
			'@context': Context.userJWT.toString(),
			email: normalizeEmail(email),
		},
		privateKey,
		{
			algorithm: 'ES512',
			expiresIn: '24h',
			audience: 'hello.nrfcloud.com',
			keyid: keyId,
		},
	)
