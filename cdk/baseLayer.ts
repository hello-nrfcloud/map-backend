import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import type pJson from '../package.json'

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'@bifravst/from-env',
	'@sinclair/typebox',
	'@hello.nrfcloud.com/proto-map',
	'@hello.nrfcloud.com/proto',
	'@middy/core',
	'@middy/input-output-logger',
	'lodash-es',
	'@bifravst/random-words',
	'@bifravst/timestream-helpers',
	'@aws-lambda-powertools/metrics',
	'@hello.nrfcloud.com/nrfcloud-api-helpers',
	'@hello.nrfcloud.com/lambda-helpers',
	'id128',
	'jsonwebtoken',
]

export const pack = async (): Promise<PackedLayer> =>
	packLayer({
		id: 'baseLayer',
		dependencies,
	})
