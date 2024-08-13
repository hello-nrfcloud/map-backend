import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { marshall } from '@aws-sdk/util-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import {
	ProblemDetailError,
	problemResponse,
} from '@hello.nrfcloud.com/lambda-helpers/problemResponse'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	validateInput,
	type ValidInput,
} from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { PublicDeviceId } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { getDeviceId } from '../devices/getDeviceId.js'
import { verifyUserToken } from '../jwt/verifyUserToken.js'
import { getSettings } from '../settings/jwt.js'
import { withUser, type WithUser } from './middleware/withUser.js'

const { stackName, TableName, idIndex, version } = fromEnv({
	stackName: 'STACK_NAME',
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	version: 'VERSION',
})({
	STACK_NAME,
	...process.env,
})
const db = new DynamoDBClient({})
const byId = getDeviceId({ db, TableName, idIndex })
const jwtSettings = await getSettings({ ssm: new SSMClient({}), stackName })

const InputSchema = Type.Object({
	id: PublicDeviceId,
})

/**
 * Extend the time a devices sharing expires by 30 days
 */
const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & WithUser & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const maybeDevice = await byId(context.validInput.id)

	if ('error' in maybeDevice) {
		throw new ProblemDetailError({
			title: `Device ${context.validInput.id} not shared: ${maybeDevice.error}`,
			status: 404,
		})
	}

	await db.send(
		new UpdateItemCommand({
			TableName,
			Key: marshall({ deviceId: maybeDevice.deviceId }),
			UpdateExpression: 'SET #ttl = :newTTL',
			ExpressionAttributeNames: {
				'#ttl': 'ttl',
			},
			ExpressionAttributeValues: {
				':newTTL': {
					N: `${Math.floor(Date.now() / 1000 + 30 * 24 * 60 * 60)}`,
				},
			},
		}),
	)

	return aResponse(200)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.use(requestLogger())
	.use(validateInput(InputSchema))
	.use(
		withUser({
			verify: verifyUserToken(
				new Map([[jwtSettings.keyId, jwtSettings.publicKey]]),
			),
		}),
	)
	.use(problemResponse())
	.handler(h)
