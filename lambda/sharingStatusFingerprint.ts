import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import {
	validateInput,
	type ValidInput,
} from '@hello.nrfcloud.com/lambda-helpers/validateInput'
import { Context } from '@hello.nrfcloud.com/proto-map/api'
import { fingerprintRegExp } from '@hello.nrfcloud.com/proto/fingerprint'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from 'aws-lambda'
import { publicDevicesRepo, toPublic } from '../devices/publicDevicesRepo.js'
import { helloApi } from '../hello/api.js'
import { getSettings } from '../settings/hello.js'

const { TableName, version, idIndex, stackName } = fromEnv({
	version: 'VERSION',
	TableName: 'PUBLIC_DEVICES_TABLE_NAME',
	idIndex: 'PUBLIC_DEVICES_ID_INDEX_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const InputSchema = Type.Object({
	fingerprint: Type.RegExp(fingerprintRegExp),
})

const devicesRepo = publicDevicesRepo({ db, TableName, idIndex })

const helloSettings = await getSettings({ ssm, stackName })

const hello = helloApi({
	endpoint: helloSettings.apiEndpoint,
})

const h = async (
	event: APIGatewayProxyEventV2,
	context: ValidInput<typeof InputSchema> & LambdaContext,
): Promise<APIGatewayProxyResultV2> => {
	const maybeDevice = await hello.getDeviceByFingerprint(
		context.validInput.fingerprint,
	)
	if ('error' in maybeDevice) {
		return aProblem(maybeDevice.error)
	}
	const { id: deviceId } = maybeDevice.result

	console.log(JSON.stringify(maybeDevice))

	const maybeSharedDevice = await devicesRepo.getByDeviceId(deviceId)

	console.log(JSON.stringify(maybeSharedDevice))

	if ('error' in maybeSharedDevice) {
		return aProblem({
			title: `Device with fingerprint ${context.validInput.fingerprint} not shared: ${maybeSharedDevice.error}`,
			status: 404,
		})
	}

	return aResponse(
		200,
		{
			'@context': Context.device,
			...toPublic(maybeSharedDevice.device),
		},
		60 * 60 * 24,
	)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('GET'))
	.use(requestLogger())
	.use(validateInput(InputSchema))
	.handler(h)
