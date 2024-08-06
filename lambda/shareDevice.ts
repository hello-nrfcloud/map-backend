import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import {
	ConditionalCheckFailedException,
	DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	validateInput,
	type ValidInput,
} from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { Context, Model } from '@hello.nrfcloud.com/proto-map/api'
import { fingerprintRegExp } from '@hello.nrfcloud.com/proto/fingerprint'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { publicDevicesRepo } from '../devices/publicDevicesRepo.js'
import { helloApi } from '../hello/api.js'
import { verifyUserToken } from '../jwt/verifyUserToken.js'
import { getSettings } from '../settings/hello.js'
import { getSettings as getJWTSettings } from '../settings/jwt.js'
import { withUser, type WithUser } from './middleware/withUser.js'

const { publicDevicesTableName, version, stackName, idIndex } = fromEnv({
	version: 'VERSION',
	publicDevicesTableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const publicDevice = publicDevicesRepo({
	db,
	TableName: publicDevicesTableName,
	idIndex,
})

const { track, metrics } = metricsForComponent(
	'shareDevice',
	'hello-nrfcloud-map',
)

const helloSettings = await getSettings({ ssm, stackName })

const jwtSettings = await getJWTSettings({ ssm, stackName })

// Out of box devices can be published using their fingerprint
const InputSchema = Type.Object({
	fingerprint: Type.RegExp(fingerprintRegExp),
	model: Model,
})

const hello = helloApi({
	endpoint: helloSettings.apiEndpoint,
})

const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & WithUser & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const { email } = context.user

	const maybeDevice = await hello.getDeviceByFingerprint(
		context.validInput.fingerprint,
	)
	if ('error' in maybeDevice) {
		return aProblem(maybeDevice.error)
	}
	const { id: deviceId } = maybeDevice.result
	return publish({
		deviceId,
		model: context.validInput.model,
		email,
	})
}

const publish = async ({
	deviceId,
	model,
	email,
}: {
	deviceId: string
	model: string
	email: string
}): Promise<APIGatewayProxyResultV2> => {
	const maybePublished = await publicDevice.share({
		deviceId,
		model,
		email,
	})
	if ('error' in maybePublished) {
		if (maybePublished.error instanceof ConditionalCheckFailedException) {
			return aProblem({
				title: `Failed to share device: ${maybePublished.error.message}`,
				status: 409,
			})
		}
		console.error(maybePublished.error)
		return aProblem({
			title: `Failed to share device: ${maybePublished.error.message}`,
			status: 500,
		})
	}

	track('deviceShared', MetricUnit.Count, 1)

	console.debug(JSON.stringify({ deviceId, model, email }))

	return aResponse(200, {
		'@context': Context.shareDevice.request,
		id: maybePublished.device.id,
		deviceId,
	})
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
