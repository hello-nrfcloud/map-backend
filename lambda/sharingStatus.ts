import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
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
import { Context, DeviceId } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { publicDevicesRepo, toPublic } from '../devices/publicDevicesRepo.js'

const { TableName, version, idIndex } = fromEnv({
	version: 'VERSION',
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
})(process.env)

const db = new DynamoDBClient({})

const InputSchema = Type.Object({
	id: DeviceId,
})

const devicesRepo = publicDevicesRepo({ db, TableName, idIndex })

const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const maybeDevice = await devicesRepo.getById(context.validInput.id)

	console.log(JSON.stringify(maybeDevice))

	if ('error' in maybeDevice) {
		throw new ProblemDetailError({
			title: `Device ${context.validInput.id} not shared: ${maybeDevice.error}`,
			status: 404,
		})
	}

	return aResponse(
		200,
		{
			'@context': Context.device,
			...toPublic(maybeDevice.device),
		},
		60 * 60 * 24,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.use(requestLogger())
	.use(validateInput(InputSchema))
	.use(problemResponse())
	.handler(h)
