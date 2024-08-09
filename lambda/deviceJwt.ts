import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
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
import { Context, PublicDeviceId } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { publicDevicesRepo } from '../devices/publicDevicesRepo.js'
import { deviceJWT } from '../jwt/deviceJWT.js'
import { getSettings } from '../settings/jwt.js'

const { TableName, version, idIndex, stackName } = fromEnv({
	version: 'VERSION',
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const InputSchema = Type.Object({
	id: PublicDeviceId,
})

const devicesRepo = publicDevicesRepo({ db, TableName, idIndex })

const jwtSettings = await getSettings({ ssm, stackName })

const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const maybeSharedDevice = await devicesRepo.getById(context.validInput.id)

	if ('error' in maybeSharedDevice) {
		throw new ProblemDetailError({
			title: `Device with id ${context.validInput.id} not shared: ${maybeSharedDevice.error}`,
			status: 404,
		})
	}

	return aResponse(
		201,
		{
			'@context': Context.deviceJWT,
			id: maybeSharedDevice.device.id,
			deviceId: maybeSharedDevice.device.deviceId,
			model: maybeSharedDevice.device.model,
			jwt: deviceJWT(maybeSharedDevice.device, jwtSettings),
		},
		60 * 50, // 50 Minutes
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.use(requestLogger())
	.use(validateInput(InputSchema))
	.use(problemResponse())
	.handler(h)
