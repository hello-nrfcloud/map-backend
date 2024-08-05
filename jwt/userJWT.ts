import { Context } from '@hello.nrfcloud.com/proto-map/api'

import jwt from 'jsonwebtoken'

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
			email,
		},
		privateKey,
		{
			algorithm: 'ES512',
			expiresIn: '24h',
			audience: 'hello.nrfcloud.com',
			keyid: keyId,
		},
	)
