import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import middy from '@middy/core'
import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import { getSettings } from '../settings/jwt.js'

const { version, stackName } = fromEnv({
	version: 'VERSION',
	stackName: 'STACK_NAME',
})(process.env)

const ssm = new SSMClient({})

const jwtSettings = await getSettings({ ssm, stackName })

const h = async (): Promise<APIGatewayProxyResultV2> => {
	return {
		statusCode: 200,
		headers: {
			'content-type': 'application/json',
			'Cache-Control': `public, max-age=${600}`,
		},
		body: JSON.stringify({
			'@context': 'https://datatracker.ietf.org/doc/html/rfc7517',
			keys: [
				{
					alg: 'ES512',
					kid: jwtSettings.keyId,
					use: 'sig',
					key: jwtSettings.publicKey,
				},
			],
		}),
	}
}

export const handler = middy().use(addVersionHeader(version)).handler(h)
