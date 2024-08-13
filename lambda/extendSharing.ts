import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
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
import { models } from '@hello.nrfcloud.com/proto-map/models'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { getById } from '../devices/getById.js'
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
const byId = getById({ db: new DynamoDBClient({}), TableName, idIndex })
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
			Key: marshall({ email: normalizeEmail(email) }),
			UpdateExpression:
				'SET #confirmationToken = :confirmationToken, #ttl = :ttl, #rerequestAfter = :rerequestAfter',
			ConditionExpression:
				'attribute_not_exists(email) OR #ttl < :now OR #rerequestAfter < :now',
			ExpressionAttributeNames: {
				'#confirmationToken': 'confirmationToken',
				'#ttl': 'ttl',
				'#rerequestAfter': 'rerequestAfter',
			},
			ExpressionAttributeValues: {
				':confirmationToken': {
					S: confirmationToken,
				},
				':ttl': {
					N: `${Math.floor(expires.getTime() / 1000)}`,
				},
				':rerequestAfter': {
					N: `${Math.floor(rerequestAfter.getTime() / 1000)}`,
				},
				':now': {
					N: `${Math.floor((now?.getTime() ?? Date.now()) / 1000)}`,
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

const isModel = (model: string): model is string =>
	Object.keys(models).includes(model)
