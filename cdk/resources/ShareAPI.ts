import {
	Duration,
	aws_lambda as Lambda,
	aws_iam as IAM,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PublicDevices } from './PublicDevices.js'
import { LambdaLogGroup } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { BackendLambdas } from '../BackendLambdas.js'
import { Permissions } from '@hello.nrfcloud.com/nrfcloud-api-helpers/cdk'

export class ShareAPI extends Construct {
	public readonly shareFn: Lambda.IFunction
	public readonly confirmOwnershipFn: Lambda.IFunction
	public readonly sharingStatusFn: Lambda.IFunction
	constructor(
		parent: Construct,
		{
			baseLayer,
			lambdaSources,
			publicDevices,
		}: {
			publicDevices: PublicDevices
			baseLayer: Lambda.ILayerVersion
			lambdaSources: Pick<
				BackendLambdas,
				'shareDevice' | 'confirmOwnership' | 'sharingStatus'
			>
		},
	) {
		super(parent, 'shareAPI')

		const domain = this.node.getContext('domain')

		this.shareFn = new Lambda.Function(this, 'shareFn', {
			handler: lambdaSources.shareDevice.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.shareDevice.zipFile),
			description: 'Invoked by a user that wants to share a device',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				FROM_EMAIL: `notification@${domain}`,
				NODE_NO_WARNINGS: '1',
				IS_TEST: this.node.getContext('isTest') === true ? '1' : '0',
				STACK_NAME: Stack.of(this).stackName,
			},
			...new LambdaLogGroup(this, 'shareFnLogs'),
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ses:SendEmail'],
					resources: [
						`arn:aws:ses:${Stack.of(parent).region}:${
							Stack.of(parent).account
						}:identity/${domain}`,
					],
					conditions: {
						StringLike: {
							'ses:FromAddress': `notification@${domain}`,
						},
					},
				}),
				Permissions(Stack.of(this)),
			],
		})
		publicDevices.publicDevicesTable.grantWriteData(this.shareFn)

		this.confirmOwnershipFn = new Lambda.Function(this, 'confirmOwnershipFn', {
			handler: lambdaSources.confirmOwnership.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.confirmOwnership.zipFile),
			description:
				'Invoked by a user that wants confirm their device ownership.',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				NODE_NO_WARNINGS: '1',
			},
			...new LambdaLogGroup(this, 'confirmOwnershipFnLogs'),
		})
		publicDevices.publicDevicesTable.grantReadWriteData(this.confirmOwnershipFn)

		this.sharingStatusFn = new Lambda.Function(this, 'sharingStatusFn', {
			handler: lambdaSources.sharingStatus.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.sharingStatus.zipFile),
			description: 'Returns the sharing status of a device.',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				NODE_NO_WARNINGS: '1',
			},
			...new LambdaLogGroup(this, 'sharingStatusFnLogs'),
		})
		publicDevices.publicDevicesTable.grantReadData(this.sharingStatusFn)
	}
}
