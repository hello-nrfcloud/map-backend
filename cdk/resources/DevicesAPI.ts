import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { aws_iam as IAM, type aws_lambda as Lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import type { PublicDevices } from './PublicDevices.js'

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

		this.devicesFn = new PackedLambdaFn(
			this,
			'devicesFn',
			lambdaSources.devicesData,
			{
				description:
					'Provides the data of the public devices to the map frontend',
				layers: [baseLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
					PUBLIC_DEVICES_TABLE_MODEL_TTL_INDEX_NAME:
						publicDevices.publicDevicesTableModelTTLIndex,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['iot:GetThingShadow'],
						resources: ['*'],
					}),
				],
			},
		).fn
		publicDevices.publicDevicesTable.grantReadData(this.devicesFn)
	}
}
