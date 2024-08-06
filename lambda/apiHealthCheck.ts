import { fromEnv } from '@bifravst/from-env'
import { aResponse } from '@hello.nrfcloud.com/lambda-helpers/aResponse'
import { addVersionHeader } from '@hello.nrfcloud.com/lambda-helpers/addVersionHeader'
import { corsOPTIONS } from '@hello.nrfcloud.com/lambda-helpers/corsOPTIONS'
import { Context } from '@hello.nrfcloud.com/proto-map/api'
import middy from '@middy/core'
import { type APIGatewayProxyResultV2 } from 'aws-lambda'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'

const { version } = fromEnv({
	version: 'VERSION',
})(process.env)

const h = async (): Promise<APIGatewayProxyResultV2> =>
	aResponse(200, {
		'@context': Context.apiHealth,
		version,
	})

export const handler = middy()
	.use(addVersionHeader(version))
	.use(corsOPTIONS('POST'))
	.use(requestLogger())
	.handler(h)
