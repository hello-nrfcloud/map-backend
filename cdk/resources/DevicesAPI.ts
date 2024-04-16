import { Duration, aws_iam as IAM, aws_lambda as Lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PublicDevices } from './PublicDevices.js'
import { LambdaLogGroup } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { BackendLambdas } from '../BackendLambdas.js'

export class DevicesAPI extends Construct {
	public readonly devicesFn: Lambda.IFunction

	constructor(
		parent: Construct,
		{
			baseLayer,
			lambdaSources,
			publicDevices,
		}: {
			publicDevices: PublicDevices
			baseLayer: Lambda.ILayerVersion
			lambdaSources: Pick<BackendLambdas, 'devicesData'>
		},
	) {
		super(parent, 'devicesAPI')

		this.devicesFn = new Lambda.Function(this, 'devicesFn', {
			handler: lambdaSources.devicesData.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.minutes(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.devicesData.zipFile),
			description:
				'Provides the data of the public devices to the map frontend',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
				PUBLIC_DEVICES_TABLE_MODEL_OWNER_CONFIRMED_INDEX_NAME:
					publicDevices.publicDevicesTableModelOwnerConfirmedIndex,
				NODE_NO_WARNINGS: '1',
			},
			...new LambdaLogGroup(this, 'devicesFnLogs'),
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['iot:GetThingShadow'],
					resources: ['*'],
				}),
			],
		})
		publicDevices.publicDevicesTable.grantReadData(this.devicesFn)
	}
}
