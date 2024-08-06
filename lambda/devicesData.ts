import {
	DynamoDBClient,
	QueryCommand,
	type QueryCommandInput,
} from '@aws-sdk/client-dynamodb'
import {
	GetThingShadowCommand,
	IoTDataPlaneClient,
	ResourceNotFoundException,
} from '@aws-sdk/client-iot-data-plane'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	validateInput,
	type ValidInput,
} from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { Context, PublicDeviceId } from '@hello.nrfcloud.com/proto-map/api'
import type { LwM2MObjectInstance } from '@hello.nrfcloud.com/proto-map/lwm2m'
import { shadowToObjects } from '@hello.nrfcloud.com/proto-map/lwm2m/aws'
import { models } from '@hello.nrfcloud.com/proto-map/models'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { consentDurationMS } from '../devices/consentDuration.js'

const {
	publicDevicesTableName,
	publicDevicesTableModelOwnerConfirmedIndex,
	version,
} = fromEnv({
	version: 'VERSION',
	publicDevicesTableName: 'PUBLIC_DEVICES_TABLE_NAME',
	publicDevicesTableModelOwnerConfirmedIndex:
		'PUBLIC_DEVICES_TABLE_MODEL_OWNER_CONFIRMED_INDEX_NAME',
})(process.env)

const db = new DynamoDBClient({})
const iotData = new IoTDataPlaneClient({})
const decoder = new TextDecoder()

const InputSchema = Type.Object({
	// Allows to search by the public device id
	ids: Type.Optional(Type.Array(PublicDeviceId)),
})

const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const devicesToFetch: { id: string; deviceId: string; model: string }[] = []
	const minConfirmTime = Date.now() - consentDurationMS

	for (const model of Object.keys(models)) {
		const queryInput: QueryCommandInput = {
			TableName: publicDevicesTableName,
			IndexName: publicDevicesTableModelOwnerConfirmedIndex,
			KeyConditionExpression: '#model = :model AND #ttl > :minConfirmTime',
			ExpressionAttributeNames: {
				'#id': 'id',
				'#deviceId': 'deviceId',
				'#model': 'model',
				'#ttl': 'ttl',
			},
			ExpressionAttributeValues: {
				':model': { S: model },
				':minConfirmTime': {
					N: Math.round(new Date(minConfirmTime).getTime() / 1000).toString(),
				},
			},
			ProjectionExpression: '#id, #deviceId',
		}

		if (context.validInput.ids !== undefined) {
			queryInput.ExpressionAttributeValues = {
				...(queryInput.ExpressionAttributeValues ?? {}),
				':ids': {
					SS: context.validInput.ids,
				},
			}
			queryInput.FilterExpression = 'contains(:ids, #id) '
		}

		console.log(JSON.stringify({ queryInput }))

		const { Items } = await db.send(new QueryCommand(queryInput))

		devicesToFetch.push(
			...(Items ?? [])
				.map((item) => unmarshall(item) as { id: string; deviceId: string })
				.map(({ id, deviceId }) => ({
					id,
					deviceId,
					model,
				})),
		)
	}

	console.log(JSON.stringify({ devicesToFetch }))

	const devices: Array<{
		id: string
		deviceId: string
		model: string
		state?: Array<LwM2MObjectInstance>
	}> = (
		await Promise.all(
			devicesToFetch.map(async ({ id, deviceId, model }) => {
				try {
					const shadow = await iotData.send(
						new GetThingShadowCommand({
							thingName: deviceId,
							shadowName: 'lwm2m',
						}),
					)
					return {
						id,
						deviceId,
						model,
						state:
							shadow.payload === undefined
								? []
								: shadowToObjects(
										JSON.parse(decoder.decode(shadow.payload)).state.reported,
									),
					}
				} catch (err) {
					if (err instanceof ResourceNotFoundException) {
						console.debug(`[${id}]: no shadow found for ${deviceId}.`)
					} else {
						console.error(err)
					}
					return { id, deviceId, model }
				}
			}),
		)
	).filter(({ state }) => state !== undefined)

	console.log(JSON.stringify(devices))

	return aResponse(
		200,
		{
			'@context': Context.devices,
			devices: devices.map((device) => ({
				'@context': Context.device,
				...device,
			})),
		},
		60 * 10,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.use(requestLogger())
	.use(
		validateInput(InputSchema, (event) => {
			const qs: Record<string, any> = event.queryStringParameters ?? {}
			if ('ids' in qs) qs.ids = qs.ids?.split(',') ?? []
			return qs
		}),
	)
	.handler(h)
