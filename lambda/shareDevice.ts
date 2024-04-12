import {
	ConditionalCheckFailedException,
	DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import { SESClient } from '@aws-sdk/client-ses'
import {
	formatTypeBoxErrors,
	validateWithTypeBox,
} from '@hello.nrfcloud.com/proto'
import { Context, Model } from '@hello.nrfcloud.com/proto-map/api'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { Type } from '@sinclair/typebox'
import lambda, { type APIGatewayProxyResultV2 } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import { publicDevicesRepo } from '../sharing/publicDevicesRepo.js'
import { sendOwnershipVerificationEmail } from './sendOwnershipVerificationEmail.js'

import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { SSMClient } from '@aws-sdk/client-ssm'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import { fingerprintRegExp } from '@hello.nrfcloud.com/proto/fingerprint'
import middy from '@middy/core'
import { getSettings } from '../settings/hello.js'

const { publicDevicesTableName, fromEmail, isTestString, version, stackName } =
	fromEnv({
		version: 'VERSION',
		publicDevicesTableName: 'PUBLIC_DEVICES_TABLE_NAME',
		fromEmail: 'FROM_EMAIL',
		isTestString: 'IS_TEST',
		stackName: 'STACK_NAME',
	})(process.env)

const isTest = isTestString === '1'

const db = new DynamoDBClient({})
const ses = new SESClient({})
const ssm = new SSMClient({})

const publicDevice = publicDevicesRepo({
	db,
	TableName: publicDevicesTableName,
})

const sendEmail = sendOwnershipVerificationEmail(ses, fromEmail)

const { track, metrics } = metricsForComponent(
	'shareDevice',
	'hello-nrfcloud-map',
)

const hello = await getSettings({ ssm, stackName })

const validateInput = validateWithTypeBox(
	Type.Intersect([
		Type.Union([
			// Out of box devices can be published using their fingerprint
			Type.Object({
				fingerprint: Type.RegExp(fingerprintRegExp),
			}),
			// This is used in the case a custom device needs to be published.
			Type.Object({
				model: Model,
			}),
		]),
		Type.Object({
			email: Type.RegExp(/.+@.+/, {
				title: 'Email',
				description:
					'The email of the owner of the device. They have to confirm the publication of the device every 30 days.',
			}),
		}),
	]),
)

const h = async (
	event: lambda.APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))

	const maybeValidInput = validateInput(JSON.parse(event.body ?? '{}'))
	if ('errors' in maybeValidInput) {
		return aProblem({
			title: 'Validation failed',
			status: 400,
			detail: formatTypeBoxErrors(maybeValidInput.errors),
		})
	}

	const { email } = maybeValidInput.value

	if ('fingerprint' in maybeValidInput.value) {
		// FIXME: validate fetch
		// '@context': 'https://github.com/hello-nrfcloud/proto/deviceIdentity',
		const { id: deviceId, model } = await (
			await fetch(
				new URL(
					`./device?${new URLSearchParams({ fingerprint: maybeValidInput.value.fingerprint }).toString()}`,
					hello.apiEndpoint,
				),
			)
		).json()
		return publish({
			deviceId,
			model,
			email,
		})
	} else {
		// TODO: limit the amount of devices that can be created by a user
		const deviceId = `map-${randomUUID()}`
		return publish({
			deviceId,
			model: maybeValidInput.value.model,
			email,
		})
	}
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
		generateToken: isTest ? () => '123456' : undefined,
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

	if (!isTest)
		await sendEmail({
			email,
			deviceId,
			ownershipConfirmationToken:
				maybePublished.publicDevice.ownershipConfirmationToken,
		})

	console.debug(JSON.stringify({ deviceId, model, email }))

	return aResponse(200, {
		'@context': Context.shareDevice.request,
		id: maybePublished.publicDevice.id,
		deviceId,
	})
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.use(logMetrics(metrics))
	.handler(h)
