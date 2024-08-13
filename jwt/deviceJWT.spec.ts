import { randomWords } from '@bifravst/random-words'
import { ModelID } from '@hello.nrfcloud.com/proto-map/models'
import jwt from 'jsonwebtoken'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deviceJWT } from './deviceJWT.js'
import { generateJWTKeyPair } from './generateJWTKeyPair.js'

void describe('deviceJWT()', () => {
	void it('should return a JWT', async () => {
		const { privateKey, publicKey, keyId } = await generateJWTKeyPair()

		const deviceId = randomWords({ numWords: 3 }).join('-')
		const id = crypto.randomUUID()
		const ts = Math.floor(Date.now() / 1000)

		const token = deviceJWT(
			{
				deviceId,
				id,
				model: ModelID.Thingy91x,
			},
			{
				privateKey,
				keyId,
			},
		)

		const decoded = jwt.decode(token, { complete: true })
		jwt.verify(token, publicKey, {
			audience: 'hello.nrfcloud.com',
		}) as jwt.JwtPayload

		const header = decoded?.header as jwt.JwtHeader
		const payload = decoded?.payload as jwt.JwtPayload

		assert.equal(header.kid, keyId)
		assert.equal(header.alg, 'ES512')
		assert.equal(payload.aud, 'hello.nrfcloud.com')
		assert.equal(payload.deviceId, deviceId)
		assert.equal(payload.id, id)
		assert.equal(payload.model, 'thingy91x')
		assert.equal((payload.iat ?? 0) >= ts, true, 'Should not be in the past')
		assert.equal(
			payload.exp,
			(payload.iat ?? 0) + 3600,
			'Should be valid for an hour',
		)
	})
})
