import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { type aws_lambda as Lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'

/**
 * Provides the .well-known/jwks.json endpoint
 */
export class JWKS extends Construct {
	public readonly jwksFn: Lambda.IFunction
	constructor(
		parent: Construct,
		{
			baseLayer,
			jwtLayer,
			lambdaSources,
		}: {
			baseLayer: Lambda.ILayerVersion
			jwtLayer: Lambda.ILayerVersion
			lambdaSources: Pick<BackendLambdas, 'jwks'>
		},
	) {
		super(parent, 'JWKS')

		this.jwksFn = new PackedLambdaFn(this, 'jwksFn', lambdaSources.jwks, {
			description: 'Serve the JWT public key',
			layers: [baseLayer, jwtLayer],
		}).fn
	}
}
