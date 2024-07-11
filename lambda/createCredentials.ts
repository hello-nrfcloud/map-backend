import { getAPISettings } from '@hello.nrfcloud.com/nrfcloud-api-helpers/settings'
import { SSMClient } from '@aws-sdk/client-ssm'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { devices as devicesApi } from '@hello.nrfcloud.com/nrfcloud-api-helpers/api'
import { publicDevicesRepo } from '../devices/publicDevicesRepo.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import middy from '@middy/core'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { NRF_CLOUD_ACCOUNT } from '../settings/account.js'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'

const {
	backendStackName,
	openSslLambdaFunctionName,
	publicDevicesTableName,
	idIndex,
	version,
} = fromEnv({
	backendStackName: 'BACKEND_STACK_NAME',
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
	'createCredentials',
	'hello-nrfcloud-map',
)

/**
 * This registers a device, which allows arbitrary users to showcase their products on the map.
 */
const h = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event }))

	const { deviceId } = JSON.parse(event.body ?? '{}')

	if (deviceId.startsWith('map-') === false)
		return aProblem({
			status: 400,
			title: 'Credentials can only be created for devices.',
		})

	const maybePublicDevice = await repo.getByDeviceId(deviceId)

	if ('error' in maybePublicDevice) {
		return aProblem({
			status: 400,
			title: `Invalid device ID ${deviceId}: ${maybePublicDevice.error}`,
		})
	}

	const { ownerEmail: email } = maybePublicDevice.device

	const { privateKey, certificate } = JSON.parse(
		(
			await lambda.send(
				new InvokeCommand({
					FunctionName: openSslLambdaFunctionName,
					Payload: JSON.stringify({
						id: deviceId,
						email,
					}),
				}),
			)
		).Payload?.transformToString() ?? '',
	)

	const registration = await client.register([
		{
			deviceId,
			subType: 'map',
			tags: ['map'],
			certPem: certificate,
		},
	])

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

	return aResponse(
		200,
		{
			'@context': new URL(
				'https://github.com/hello-nrfcloud/proto-map/device-credentials',
			),
			credentials: {
				privateKey,
				certificate,
			},
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
	.handler(h)
