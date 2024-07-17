import {
	codeBlockOrThrow,
	regExpMatchedStep,
	type StepRunner,
} from '@bifravst/bdd-markdown'
import { Type } from '@sinclair/typebox'
import jwt from 'jsonwebtoken'
import { check, closeTo, objectMatching } from 'tsmatchers'

const jwtVerify = ({
	publicKey,
	keyId,
}: {
	keyId: string
	publicKey: string
}) =>
	regExpMatchedStep(
		{
			regExp:
				/^the JWT in `(?<storageName>[^`]+)` for the audience `(?<audience>[^`]+)` should encode the payload$/,
			schema: Type.Object({
				storageName: Type.String(),
				audience: Type.String(),
			}),
		},
		async ({
			match: { storageName, audience },
			log: { progress },
			step,
			context,
		}) => {
			const expected = JSON.parse(codeBlockOrThrow(step).code)
			const token = context[storageName]
			progress(token)
			const decoded = jwt.verify(token, publicKey, {
				audience,
			}) as jwt.JwtPayload
			progress(JSON.stringify(decoded, null, 2))

			check(decoded).is(
				objectMatching({
					...expected,
					aud: audience,
					kid: keyId,
					iat: closeTo(Date.now() / 1000, 10),
					exp: closeTo(Date.now() / 1000 + 60 * 60, 10),
				}),
			)
		},
	)

export const steps = ({
	publicKey,
	keyId,
}: {
	publicKey: string
	keyId: string
}): Array<StepRunner<Record<string, any>>> => [jwtVerify({ publicKey, keyId })]
