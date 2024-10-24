import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { type aws_lambda as Lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import type { EmailConfirmationTokens } from './EmailConfirmationTokens.js'
import { permissions } from './ses.js'

export class UserAuthAPI extends Construct {
	public readonly requestTokenFn: Lambda.IFunction
	public readonly createJWTFn: Lambda.IFunction

	constructor(
		parent: Construct,
		{
			domain,
			baseLayer,
			jwtLayer,
			lambdaSources,
			emailConfirmationTokens,
		}: {
			domain: string
			emailConfirmationTokens: EmailConfirmationTokens
			baseLayer: Lambda.ILayerVersion
			jwtLayer: Lambda.ILayerVersion
			lambdaSources: Pick<BackendLambdas, 'requestToken' | 'userJwt'>
		},
	) {
		super(parent, 'userAuthAPI')

		this.requestTokenFn = new PackedLambdaFn(
			this,
			'requestTokenFn',
			lambdaSources.requestToken,
			{
				description: 'Invoked by a user to confirm their email address',
				layers: [baseLayer],
				environment: {
					EMAIL_CONFIRMATION_TOKENS_TABLE_NAME:
						emailConfirmationTokens.table.tableName,
					FROM_EMAIL: `notification@${domain}`,
					IS_TEST: this.node.getContext('isTest') === true ? '1' : '0',
				},
				initialPolicy: [permissions(this, domain)],
			},
		).fn
		emailConfirmationTokens.table.grantWriteData(this.requestTokenFn)

		this.createJWTFn = new PackedLambdaFn(
			this,
			'createJWTFnFn',
			lambdaSources.userJwt,
			{
				description: 'Returns a JWT for the user.',
				layers: [baseLayer, jwtLayer],
				environment: {
					EMAIL_CONFIRMATION_TOKENS_TABLE_NAME:
						emailConfirmationTokens.table.tableName,
				},
			},
		).fn
		emailConfirmationTokens.table.grantReadData(this.createJWTFn)
	}
}
