import {
	type DynamoDBClient,
	PutItemCommand,
	GetItemCommand,
	UpdateItemCommand,
	QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { models } from '@hello.nrfcloud.com/proto-map'
import { consentDurationMS, consentDurationSeconds } from './consentDuration.js'
import { generateCode } from '@hello.nrfcloud.com/proto/fingerprint'
import { randomWords } from '@nordicsemiconductor/random-words'

export type PublicDeviceRecord = {
	/**
	 * This is the public ID of the device, a UUIDv4.
	 * Only the public ID should be shown.
	 *
	 * @example "fbb18b8e-c2f9-41fe-8cfa-4107e4e54d72"
	 */
	id: string
	/**
	 * This is the ID the device uses to connect to nRF Cloud
	 *
	 * @example "oob-352656108602296"
	 */
	secret__deviceId: string
	model: keyof typeof models
	ownerEmail: string
	ownershipConfirmationToken: string
	ownershipConfirmationTokenCreated: Date
	ownerConfirmed?: Date
	ttl: number
}

export type PublicDeviceRecordById = Pick<
	PublicDeviceRecord,
	'id' | 'model' | 'ownerConfirmed' | 'secret__deviceId'
>

const modelNames = Object.keys(models)

export type PublicDevice = Pick<PublicDeviceRecord, 'id' | 'model'>

type PublicDeviceRecordError = {
	error:
		| 'not_found'
		| 'not_confirmed'
		| 'confirmation_expired'
		| 'unsupported_model'
}

export const publicDevicesRepo = ({
	db,
	TableName,
	now,
	superUsersEmailDomain,
}: {
	db: DynamoDBClient
	TableName: string
	now?: Date
	superUsersEmailDomain?: string
}): {
	getByDeviceId: (
		deviceId: string,
	) => Promise<{ publicDevice: PublicDevice } | PublicDeviceRecordError>
	/**
	 * Contains all data, not intended to be shared publically.
	 */
	getPrivateRecordByDeviceId: (
		deviceId: string,
	) => Promise<{ device: PublicDeviceRecord } | PublicDeviceRecordError>
	share: (args: {
		deviceId: string
		model: string
		email: string
		generateToken?: () => string
		// Mark device as confirmed. Can only be used if email address is `...@nordicsemi.no`.
		confirmed?: true
	}) => Promise<
		| {
				error: Error
		  }
		| {
				publicDevice: {
					id: string
					ownershipConfirmationToken: string
				}
		  }
	>
	confirmOwnership: (args: {
		deviceId: string
		ownershipConfirmationToken: string
	}) => Promise<
		| {
				error: Error
		  }
		| {
				publicDevice: {
					id: string
				}
		  }
	>
} => {
	const getPrivateRecordByDeviceId = async (
		deviceId: string,
	): Promise<{ device: PublicDeviceRecord } | PublicDeviceRecordError> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: marshall({
					secret__deviceId: deviceId.toLowerCase(),
				}),
			}),
		)
		if (Item === undefined) return { error: 'not_found' }
		const device = unmarshall(Item) as PublicDeviceRecord
		if (device.ownerConfirmed === undefined || device.ownerConfirmed === null)
			return { error: 'not_confirmed' }
		const ownerConfirmed = new Date(device.ownerConfirmed)
		if (ownerConfirmed.getTime() + consentDurationMS < Date.now())
			return { error: 'confirmation_expired' }
		if (!modelNames.includes(device.model))
			return { error: 'unsupported_model' }
		return {
			device,
		}
	}

	return {
		getPrivateRecordByDeviceId,
		getByDeviceId: async (deviceId: string) => {
			const maybePublicDevice = await getPrivateRecordByDeviceId(deviceId)
			if ('error' in maybePublicDevice) return maybePublicDevice
			return {
				publicDevice: {
					id: maybePublicDevice.device.id,
					model: maybePublicDevice.device.model,
				},
			}
		},
		share: async ({ deviceId, model, email, generateToken, confirmed }) => {
			const id = randomWords({ numWords: 3 }).join('-')
			const ownershipConfirmationToken = (
				generateToken?.() ?? generateCode()
			).toUpperCase()

			if (
				confirmed === true &&
				!email.endsWith(`@${superUsersEmailDomain ?? 'nordicsemi.no'}`)
			) {
				throw new Error(
					`Only devices owned by ${superUsersEmailDomain ?? 'nordicsemi.no'} can be shared without confirmation!`,
				)
			}

			try {
				await db.send(
					new PutItemCommand({
						TableName,
						Item: marshall(
							{
								secret__deviceId: deviceId.toLowerCase(),
								id,
								ttl:
									Math.round((now ?? new Date()).getTime() / 1000) +
									consentDurationSeconds,
								model,
								ownerEmail: email,
								...(confirmed === true
									? {
											ownerConfirmed: (now ?? new Date()).toISOString(),
										}
									: {
											ownershipConfirmationToken,
											ownershipConfirmationTokenCreated: (
												now ?? new Date()
											).toISOString(),
										}),
							},
							{
								removeUndefinedValues: true,
							},
						),
						ConditionExpression: 'attribute_not_exists(secret__deviceId)',
					}),
				)
			} catch (err) {
				return {
					error: err as Error,
				}
			}

			return {
				publicDevice: {
					id,
					ownershipConfirmationToken,
				},
			}
		},
		confirmOwnership: async ({ deviceId, ownershipConfirmationToken }) => {
			try {
				const { Attributes } = await db.send(
					new UpdateItemCommand({
						TableName,
						Key: marshall({
							secret__deviceId: deviceId,
						}),
						UpdateExpression: 'SET #ownerConfirmed = :now',
						ExpressionAttributeNames: {
							'#ownerConfirmed': 'ownerConfirmed',
							'#token': 'ownershipConfirmationToken',
						},
						ExpressionAttributeValues: {
							':now': {
								S: (now ?? new Date()).toISOString(),
							},
							':token': {
								S: ownershipConfirmationToken,
							},
						},
						ConditionExpression: '#token = :token',
						ReturnValues: 'ALL_NEW',
					}),
				)
				return {
					publicDevice: {
						id: Attributes?.['id']?.S as string,
					},
				}
			} catch (err) {
				return { error: err as Error }
			}
		},
	}
}

export const getDeviceById =
	({
		db,
		TableName,
		idIndex,
		getByDeviceId,
	}: {
		db: DynamoDBClient
		TableName: string
		idIndex: string
		getByDeviceId: (
			deviceId: string,
		) => Promise<{ publicDevice: PublicDevice } | PublicDeviceRecordError>
	}): ((
		id: string,
	) => Promise<{ publicDevice: PublicDevice } | PublicDeviceRecordError>) =>
	async (id: string) => {
		const { Items } = await db.send(
			new QueryCommand({
				TableName,
				IndexName: idIndex,
				KeyConditionExpression: '#id = :id',
				ExpressionAttributeNames: {
					'#id': 'id',
					'#deviceId': 'secret__deviceId',
				},
				ExpressionAttributeValues: {
					':id': {
						S: id,
					},
				},
				ProjectionExpression: '#id, #deviceId',
			}),
		)
		const device = (Items ?? [])[0]
		if (device === undefined) return { error: 'not_found' }
		return await getByDeviceId(unmarshall(device).secret__deviceId)
	}
