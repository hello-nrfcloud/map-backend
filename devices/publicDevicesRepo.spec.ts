import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { publicDevicesRepo, toPublic } from './publicDevicesRepo.js'
import { marshall } from '@aws-sdk/util-dynamodb'
import { assertCall } from '../util/test/assertCall.js'
import { randomUUID } from 'node:crypto'
import { consentDurationSeconds } from './consentDuration.js'
import {
	generateCode,
	alphabet,
	numbers,
} from '@hello.nrfcloud.com/proto/fingerprint'
import { ModelID } from '@hello.nrfcloud.com/proto-map/models'

void describe('publicDevicesRepo()', () => {
	void describe('getByDeviceId()', () => {
		void it('should fetch device data', async () => {
			const ownerConfirmed = new Date()
			const id = randomUUID()
			const send = mock.fn(async () =>
				Promise.resolve({
					Item: marshall({
						id,
						deviceId: 'some-device',
						model: 'thingy91x',
						ownerConfirmed: ownerConfirmed.toISOString(),
					}),
				}),
			)
			assert.deepEqual(
				await publicDevicesRepo({
					db: {
						send,
					} as any,
					TableName: 'some-table',
					idIndex: 'idIndex',
				}).getByDeviceId('some-device'),
				{
					device: {
						id,
						model: 'thingy91x',
						deviceId: 'some-device',
						ownerConfirmed: ownerConfirmed.toISOString(),
					},
				},
			)
			assertCall(send, {
				input: {
					TableName: 'some-table',
					Key: { deviceId: { S: 'some-device' } },
				},
			})
		})

		void it('should return error if device is not found', async () =>
			assert.deepEqual(
				await publicDevicesRepo({
					db: {
						send: async () => Promise.resolve({}),
					} as any,
					TableName: 'some-table',
					idIndex: 'idIndex',
				}).getByDeviceId('some-device'),
				{ error: 'not_found' },
			))
	})

	void describe('share()', () => {
		void it('should persist a users intent to share a device', async () => {
			const send = mock.fn(async () => Promise.resolve({}))
			const now = new Date()

			const res = await publicDevicesRepo({
				db: {
					send,
				} as any,
				TableName: 'some-table',
				now,
				idIndex: 'idIndex',
			}).share({
				deviceId: 'some-device',
				model: 'thingy91x',
				email: 'alex@example.com',
			})

			const id = ('device' in res && res.device.id) as string

			assert.match(id, /^[a-z0-9]{8}-[a-z0-9]{8}-[a-z0-9]{8}$/) // e.g. mistrist-manicate-lunation

			assertCall(send, {
				input: {
					TableName: 'some-table',
					Item: marshall({
						deviceId: 'some-device',
						id,
						ttl: Math.round(now.getTime() / 1000) + consentDurationSeconds,
						ownerEmail: 'alex@example.com',
					}),
				},
			})

			assert.match(
				(send.mock.calls[0]?.arguments as any)?.[0]?.input.Item
					.ownershipConfirmationToken.S,
				new RegExp(`^[${alphabet.toUpperCase()}${numbers}]{6}$`),
				'A code should have been generated.',
			)
		})
	})

	void describe('confirmOwnership()', () => {
		void it('should confirm the ownership by a user', async () => {
			const id = randomUUID()
			const ownershipConfirmationToken = generateCode()

			const send = mock.fn(async () =>
				Promise.resolve({
					Attributes: marshall({ id }),
				}),
			)

			const now = new Date()

			const res = await publicDevicesRepo({
				db: {
					send,
				} as any,
				TableName: 'some-table',
				now,
				idIndex: 'idIndex',
			}).confirmOwnership({
				deviceId: id,
				ownershipConfirmationToken,
			})

			assert.deepEqual(res, {
				device: {
					id,
				},
			})

			assertCall(send, {
				input: {
					TableName: 'some-table',
					Key: {
						deviceId: { S: id },
					},
					UpdateExpression: 'SET #ownerConfirmed = :now',
					ExpressionAttributeNames: {
						'#ownerConfirmed': 'ownerConfirmed',
						'#token': 'ownershipConfirmationToken',
					},
					ExpressionAttributeValues: {
						':now': { S: now.toISOString() },
						':token': { S: ownershipConfirmationToken },
					},
					ConditionExpression: '#token = :token',
					ReturnValues: 'ALL_NEW',
				},
			})
		})
	})
})

void describe('getById()', () => {
	void it(`it should return a device by it's public ID`, async () => {
		const id = randomUUID()
		const send = mock.fn<any>()
		send.mock.mockImplementationOnce(
			async () =>
				Promise.resolve({
					Items: [
						marshall({
							id,
							deviceId: 'some-device',
						}),
					],
				}),
			0,
		)
		send.mock.mockImplementationOnce(
			async () =>
				Promise.resolve({
					Item: marshall({
						id,
						deviceId: 'some-device',
						model: 'thingy91x',
						ownerConfirmed: new Date().toISOString(),
					}),
				}),
			1,
		)
		const res = await publicDevicesRepo({
			db: {
				send,
			} as any,
			TableName: 'some-table',
			idIndex: 'id-index',
		}).getById(id)

		assertCall(send, {
			input: {
				TableName: 'some-table',
				IndexName: 'id-index',
				KeyConditionExpression: '#id = :id',
				ExpressionAttributeNames: {
					'#id': 'id',
					'#deviceId': 'deviceId',
				},
				ExpressionAttributeValues: {
					':id': {
						S: id,
					},
				},
				ProjectionExpression: '#id, #deviceId',
			},
		})

		assertCall(
			send,
			{
				input: {
					TableName: 'some-table',
					Key: { deviceId: { S: 'some-device' } },
				},
			},
			1,
		)

		assert.deepEqual('device' in res && toPublic(res.device), {
			id,
			deviceId: 'some-device',
			model: 'thingy91x',
		})
	})
})

void describe('toPublic()', () => {
	void it('should convert a record to a publicly shareable record', () => {
		const id = randomUUID()
		const record = toPublic({
			id,
			deviceId: 'some-device',
			model: ModelID.Thingy91x,
			ownerConfirmed: new Date(),
			ownerEmail: 'alex@example.com',
			ownershipConfirmationToken: '123456',
			ownershipConfirmationTokenCreated: new Date(),
			ttl: Date.now(),
		})
		assert.deepEqual(record, {
			id,
			deviceId: 'some-device',
			model: ModelID.Thingy91x,
		})
	})
})
