import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import {
	ConditionalCheckFailedException,
	DynamoDBClient,
} from '@aws-sdk/client-dynamodb'
import { SESClient } from '@aws-sdk/client-ses'
import { fromEnv } from '@bifravst/from-env'
import { aProblem } from '@hello.nrfcloud.com/lambda-helpers/aProblem'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import {
	formatTypeBoxErrors,
	validateWithTypeBox,
} from '@hello.nrfcloud.com/proto'
import { Email } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { emailConfirmationTokensRepo } from '../users/emailConfirmationTokensRepo.js'
import { sendEmailVerificationEmail } from './sendEmailVerificationEmail.js'

const { emailConfirmationTokensTableName, fromEmail, isTestString, version } =
	fromEnv({
		version: 'VERSION',
		emailConfirmationTokensTableName: 'EMAIL_CONFIRMATION_TOKENS_TABLE_NAME',
		fromEmail: 'FROM_EMAIL',
		isTestString: 'IS_TEST',
	})(process.env)

const isTest = isTestString === '1'

const db = new DynamoDBClient({})
const ses = new SESClient({})

const tokensRepo = emailConfirmationTokensRepo({
	db,
	TableName: emailConfirmationTokensTableName,
})

const sendEmail = sendEmailVerificationEmail(ses, fromEmail)

const { track, metrics } = metricsForComponent(
	'requestToken',
	'hello-nrfcloud-map',
)

const validateInput = validateWithTypeBox(
	Type.Object({
		email: Email,
	}),
)

const h = async (
	event: APIGatewayProxyEventV2,
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

	const maybeToken = await tokensRepo.requestToken({
		email,
		generateToken: isTest ? () => 'ABC123' : undefined,
	})
	if ('error' in maybeToken) {
		if (maybeToken.error instanceof ConditionalCheckFailedException) {
			return aProblem({
				title: `Failed to request token: ${maybeToken.error.message}`,
				status: 409,
			})
		}
		console.error(maybeToken.error)
		return aProblem({
			title: `Failed to request token: ${maybeToken.error.message}`,
			status: 500,
		})
	}

	track('tokenCreated', MetricUnit.Count, 1)

	if (!isTest)
		await sendEmail({
			email,
			confirmationToken: maybeToken.user.confirmationToken,
		})

	console.debug(JSON.stringify({ email }))

	return aResponse(201)
}

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.use(logMetrics(metrics))
	.handler(h)
