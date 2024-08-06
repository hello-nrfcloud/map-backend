import {
	LambdaLogGroup,
	PackedLambdaFn,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { aws_ecr as ECR } from 'aws-cdk-lib'
import { Duration, aws_lambda as Lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import { STACK_NAME } from '../stackConfig.js'
import type { PublicDevices } from './PublicDevices.js'

export class DeviceManagementAPI extends Construct {
	public readonly createDevice: Lambda.IFunction

	constructor(
		parent: Construct,
		{
			baseLayer,
			lambdaSources,
			openSSLContainerImage,
			publicDevices,
		}: {
			baseLayer: Lambda.ILayerVersion
			lambdaSources: Pick<BackendLambdas, 'createDevice' | 'openSSL'>
			openSSLContainerImage: {
				repo: ECR.IRepository
				tag: string
			}
			publicDevices: PublicDevices
		},
	) {
		super(parent, 'deviceManagementAPI')

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

		this.createDevice = new PackedLambdaFn(
			this,
			'createDeviceFn',
			lambdaSources.createDevice,
			{
				description: 'Allows users to create credentials for devices',
				layers: [baseLayer],
				environment: {
					BACKEND_STACK_NAME: STACK_NAME,
					OPENSSL_LAMBDA_FUNCTION_NAME: openSSLFn.functionName,
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
				},
			},
		).fn
		openSSLFn.grantInvoke(this.createDevice)
		publicDevices.publicDevicesTable.grantReadData(this.createDevice)
	}
}
