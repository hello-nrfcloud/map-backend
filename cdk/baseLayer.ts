import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import pJson from '../package.json'

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'@nordicsemiconductor/from-env',
	'@sinclair/typebox',
	'@hello.nrfcloud.com/proto-map',
	'@hello.nrfcloud.com/proto',
	'@middy/core',
	'lodash-es',
	'@nordicsemiconductor/random-words',
	'@nordicsemiconductor/timestream-helpers',
	'@aws-lambda-powertools/metrics',
	'@hello.nrfcloud.com/nrfcloud-api-helpers',
	'@hello.nrfcloud.com/lambda-helpers',
]

export const pack = async (): Promise<PackedLayer> =>
	packLayer({
		id: 'baseLayer',
		dependencies,
	})
