import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	validateInput,
	type ValidInput,
} from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { devices as devicesApi } from '@hello.nrfcloud.com/nrfcloud-api-helpers/api'
import { getAPISettings } from '@hello.nrfcloud.com/nrfcloud-api-helpers/settings'
import {
	Context,
	Model,
	type DeviceCredentials,
} from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type, type Static } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { publicDevicesRepo } from '../devices/publicDevicesRepo.js'
import { verifyUserToken } from '../jwt/verifyUserToken.js'
import { NRF_CLOUD_ACCOUNT } from '../settings/account.js'
import { getSettings } from '../settings/jwt.js'
import { withUser, type WithUser } from './middleware/withUser.js'

const {
	backendStackName,
	stackName,
	openSslLambdaFunctionName,
	publicDevicesTableName,
	idIndex,
	version,
} = fromEnv({
	backendStackName: 'BACKEND_STACK_NAME',
	stackName: 'STACK_NAME',
	openSslLambdaFunctionName: 'OPENSSL_LAMBDA_FUNCTION_NAME',
	publicDevicesTableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	version: 'VERSION',
})({
	STACK_NAME,
	...process.env,
})
const ssm = new SSMClient({})

const { apiKey, apiEndpoint } = await getAPISettings({
	ssm,
	stackName: backendStackName,
	account: NRF_CLOUD_ACCOUNT,
})()

const client = devicesApi({
	endpoint: apiEndpoint,
	apiKey,
})

const lambda = new LambdaClient({})

const repo = publicDevicesRepo({
	db: new DynamoDBClient({}),
	TableName: publicDevicesTableName,
	idIndex,
})

const { track, metrics } = metricsForComponent(
	'createDevice',
	'hello-nrfcloud-map',
)

const jwtSettings = await getSettings({ ssm, stackName })

const InputSchema = Type.Object({
	model: Model,
})

/**
 * This registers a device, which allows arbitrary users to showcase their products on the map.
 */
const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & WithUser & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const deviceId = 'map-' + randomUUID()

	const maybePublished = await repo.share({
		deviceId,
		model: 'custom',
		email: context.user.email,
	})
	if ('error' in maybePublished) {
		console.error(maybePublished.error)
		return aProblem({
			title: `Failed to share device: ${maybePublished.error.message}`,
			status: 500,
		})
	}

	const { privateKey, certificate } = JSON.parse(
		(
			await lambda.send(
				new InvokeCommand({
					FunctionName: openSslLambdaFunctionName,
					Payload: JSON.stringify({
						id: deviceId,
						email: context.user.email,
					}),
				}),
			)
		).Payload?.transformToString() ?? '',
	)

	const deviceDetails = {
		deviceId,
		subType: 'map-custom',
		tags: ['map-custom'],
		certPem: certificate,
	}
	console.debug(`Registering`, JSON.stringify(deviceDetails))

	const registration = await client.register([deviceDetails])

	if ('error' in registration) {
		console.error(
			deviceId,
			`registration failed`,
			JSON.stringify(registration.error),
		)
		return aProblem({
			title: `Registration failed: ${registration.error.message}`,
			status: 500,
		})
	}

	console.log(deviceId, `Registered devices with nRF Cloud`)
	console.log(deviceId, `Bulk ops ID:`, registration.bulkOpsRequestId)

	track('credentialsCreated', MetricUnit.Count, 1)

	const res: Static<typeof DeviceCredentials> = {
		'@context': Context.deviceCredentials.toString(),
		id: maybePublished.device.id,
		deviceId,
		credentials: {
			privateKey,
			certificate,
		},
	}

	return aResponse(
		201,
		{
			...res,
			'@context': Context.deviceCredentials,
		},
		0,
		{
			'x-bulk-ops-request-id': registration.bulkOpsRequestId,
		},
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.use(logMetrics(metrics))
	.use(requestLogger())
	.use(validateInput(InputSchema))
	.use(
		withUser({
			verify: verifyUserToken(
				new Map([[jwtSettings.keyId, jwtSettings.publicKey]]),
			),
		}),
	)
	.handler(h)
