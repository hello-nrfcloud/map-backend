import { ValidationError } from '@hello.nrfcloud.com/nrfcloud-api-helpers/api'
import { validateWithTypeBox } from '@hello.nrfcloud.com/proto'
import { UserJWTPayload } from '@hello.nrfcloud.com/proto-map/api'
import jwt from 'jsonwebtoken'

const validateUserJWTPayload = validateWithTypeBox(UserJWTPayload)

/**
 * Validate a user JWT
 */
export const verifyUserToken =
	(publicKeys: Map<string, string>) =>
	(
		token?: string,
	):
		| {
				user: {
					email: string
				}
		  }
		| { error: Error } => {
		try {
			if (token === undefined) return { error: new Error('No token provided') }

			const decoded = jwt.decode(token, { complete: true })

			const header = decoded?.header as jwt.JwtHeader
			const payload = decoded?.payload as jwt.JwtPayload

			if (header?.kid === undefined)
				return { error: new Error('No key ID found in JWT header') }

			const publicKey = publicKeys.get(header.kid)
			if (publicKey === undefined)
				return {
					error: new Error(`No public key found for key ID ${header.kid}`),
				}

			jwt.verify(token, publicKey, {
				audience: 'hello.nrfcloud.com',
			}) as jwt.JwtPayload

			const maybeValid = validateUserJWTPayload(payload)

			if ('errors' in maybeValid)
				return {
					error: new ValidationError(maybeValid.errors),
				}

			return {
				user: maybeValid.value,
			}
		} catch (err) {
			return { error: err as Error }
		}
	}
