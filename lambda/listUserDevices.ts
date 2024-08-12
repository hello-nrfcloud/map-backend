import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { problemResponse } from '@hello.nrfcloud.com/lambda-helpers/problemResponse'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import { Context, type UserDevices } from '@hello.nrfcloud.com/proto-map/api'
import { models } from '@hello.nrfcloud.com/proto-map/models'
import middy from '@middy/core'
import { type Static } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { listDevicesByEmail } from '../devices/listDevicesByEmail.js'
import { verifyUserToken } from '../jwt/verifyUserToken.js'
import { getSettings } from '../settings/jwt.js'
import { withUser, type WithUser } from './middleware/withUser.js'

const { stackName, publicDevicesTableName, ownerEmailIndex, version } = fromEnv(
	{
		stackName: 'STACK_NAME',
		publicDevicesTableName: 'PUBLIC_DEVICES_TABLE_NAME',
		ownerEmailIndex: 'PUBLIC_DEVICES_OWNER_EMAIL_INDEX_NAME',
		version: 'VERSION',
	},
)({
	STACK_NAME,
	...process.env,
})
const repo = {
	listByEmail: listDevicesByEmail({
		db: new DynamoDBClient({}),
		TableName: publicDevicesTableName,
		emailIndexName: ownerEmailIndex,
	}),
}
const jwtSettings = await getSettings({ ssm: new SSMClient({}), stackName })

/**
 * List user devices
 */
const h = async (
	event: APIGatewayProxyEventV2,
	context: WithUser & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const devices = await repo.listByEmail(context.user.email)

	const res: Static<typeof UserDevices> = {
		'@context': Context.userDevices.toString(),
		devices: devices
			// Filter out devices with unknown models
			.filter((d) => isModel(d.model))
			.map((d) => ({
				id: d.id,
				deviceId: d.deviceId,
				model: d.model,
				expires: new Date(d.ttl * 1000).toISOString(),
			})),
	}

	return aResponse(
		200,
		{
			...res,
			'@context': Context.userDevices,
		},
		60,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.use(requestLogger())
	.use(
		withUser({
			verify: verifyUserToken(
				new Map([[jwtSettings.keyId, jwtSettings.publicKey]]),
			),
		}),
	)
	.use(problemResponse())
	.handler(h)

const isModel = (model: string): model is string =>
	Object.keys(models).includes(model)
