import { marshall } from '@aws-sdk/util-dynamodb'
import { alphabet, numbers } from '@hello.nrfcloud.com/proto/fingerprint'
import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { assertCall } from '../util/test/assertCall.js'
import { emailConfirmationTokensRepo } from './emailConfirmationTokensRepo.js'

void describe('emailConfirmationTokensRepo()', () => {
	void describe('requestToken()', () => {
		void it('should persist a users intent to verify their email', async () => {
			const send = mock.fn(async () => Promise.resolve({}))
			const now = new Date()

			await emailConfirmationTokensRepo({
				db: {
					send,
				} as any,
				TableName: 'some-table',
				now,
			}).requestToken({
				email: 'alex@example.com',
			})

			assertCall(send, {
				input: {
					TableName: 'some-table',
					Key: marshall({
						email: 'alex@example.com',
					}),
				},
			})

			assert.match(
				(send.mock.calls[0]?.arguments as any)?.[0]?.input
					.ExpressionAttributeValues[':confirmationToken'].S,
				new RegExp(`^[${alphabet.toUpperCase()}${numbers}]{6}$`),
				'A code should have been generated.',
			)
		})
	})
})
