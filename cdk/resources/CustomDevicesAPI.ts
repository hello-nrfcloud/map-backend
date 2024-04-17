import { LambdaLogGroup } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { Permissions as SettingsPermissions } from '@hello.nrfcloud.com/nrfcloud-api-helpers/cdk'
import {
	Duration,
	aws_ecr as ECR,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import { STACK_NAME } from '../stackConfig.js'
import type { PublicDevices } from './PublicDevices.js'

export class CustomDevicesAPI extends Construct {
	public readonly createCredentials: Lambda.IFunction

	constructor(
		parent: Construct,
		{
			baseLayer,
			lambdaSources,
			openSSLContainerImage,
			publicDevices,
		}: {
			baseLayer: Lambda.ILayerVersion
			lambdaSources: Pick<BackendLambdas, 'createCredentials' | 'openSSL'>
			openSSLContainerImage: {
				repo: ECR.IRepository
				tag: string
			}
			publicDevices: PublicDevices
		},
	) {
		super(parent, 'customDevicesAPI')

		const openSSLFn = new Lambda.Function(this, 'openSSLFn', {
			handler: Lambda.Handler.FROM_IMAGE,
			architecture: Lambda.Architecture.X86_64,
			runtime: Lambda.Runtime.FROM_IMAGE,
			timeout: Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromEcrImage(openSSLContainerImage.repo, {
				tagOrDigest: openSSLContainerImage.tag,
				cmd: [lambdaSources.openSSL.handler],
			}),
			description: 'Allows to invoke OpenSSL',
			environment: {
				VERSION: this.node.getContext('version'),
				NODE_NO_WARNINGS: '1',
			},
			...new LambdaLogGroup(this, 'openSSLFnLogs'),
		})

		this.createCredentials = new Lambda.Function(this, 'createCredentialsFn', {
			handler: lambdaSources.createCredentials.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.createCredentials.zipFile),
			description: 'Allows users to create credentials for custom',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				NODE_NO_WARNINGS: '1',
				BACKEND_STACK_NAME: STACK_NAME,
				OPENSSL_LAMBDA_FUNCTION_NAME: openSSLFn.functionName,
				PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
			},
			...new LambdaLogGroup(this, 'createCredentialsFnLogs'),
			initialPolicy: [SettingsPermissions(Stack.of(this))],
		})
		openSSLFn.grantInvoke(this.createCredentials)
		publicDevices.publicDevicesTable.grantReadData(this.createCredentials)
	}
}
