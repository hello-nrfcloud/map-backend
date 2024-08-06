import { marshall } from '@aws-sdk/util-dynamodb'
import { ModelID } from '@hello.nrfcloud.com/proto-map/models'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it, mock } from 'node:test'
import { assertCall } from '../util/test/assertCall.js'
import { consentDurationSeconds } from './consentDuration.js'
import { publicDevicesRepo, toPublic } from './publicDevicesRepo.js'

void describe('publicDevicesRepo()', () => {
	void describe('getByDeviceId()', () => {
		void it('should fetch device data', async () => {
			const id = randomUUID()
			const send = mock.fn(async () =>
				Promise.resolve({
					Item: marshall({
						id,
						deviceId: 'some-device',
						model: 'thingy91x',
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
			ownerEmail: 'alex@example.com',
			ttl: Date.now(),
		})
		assert.deepEqual(record, {
			id,
			deviceId: 'some-device',
			model: ModelID.Thingy91x,
		})
	})
})
