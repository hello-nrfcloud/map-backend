import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { type aws_lambda as Lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import type { PublicDevices } from './PublicDevices.js'

export class ShareAPI extends Construct {
	public readonly shareFn: Lambda.IFunction
	public readonly sharingStatusFn: Lambda.IFunction
	public readonly deviceJwtFn: Lambda.IFunction
	public readonly sharingStatusFingerprintFn: Lambda.IFunction
	public readonly listUserDevicesFn: Lambda.IFunction
	public readonly extendDeviceSharingFn: Lambda.IFunction
	constructor(
		parent: Construct,
		{
			baseLayer,
			jwtLayer,
			lambdaSources,
			publicDevices,
		}: {
			publicDevices: PublicDevices
			baseLayer: Lambda.ILayerVersion
			jwtLayer: Lambda.ILayerVersion
			lambdaSources: Pick<
				BackendLambdas,
				| 'shareDevice'
				| 'sharingStatus'
				| 'sharingStatusFingerprint'
				| 'deviceJwt'
				| 'listUserDevices'
				| 'extendDeviceSharing'
			>
		},
	) {
		super(parent, 'shareAPI')

		this.shareFn = new PackedLambdaFn(
			this,
			'shareFn',
			lambdaSources.shareDevice,
			{
				description: 'Invoked by a user that wants to share a device',
				layers: [baseLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.publicDevicesTableIdIndex,
					IS_TEST: this.node.getContext('isTest') === true ? '1' : '0',
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantWriteData(this.shareFn)

		this.sharingStatusFn = new PackedLambdaFn(
			this,
			'sharingStatusFn',
			lambdaSources.sharingStatus,
			{
				description: 'Returns the sharing status of a device.',
				layers: [baseLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.publicDevicesTableIdIndex,
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantReadData(this.sharingStatusFn)

		this.sharingStatusFingerprintFn = new PackedLambdaFn(
			this,
			'sharingStatusFingerprintFn',
			lambdaSources.sharingStatusFingerprint,
			{
				description:
					'Returns the sharing status of a device using the fingerprint.',
				layers: [baseLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.publicDevicesTableIdIndex,
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantReadData(
			this.sharingStatusFingerprintFn,
		)

		this.deviceJwtFn = new PackedLambdaFn(
			this,
			'deviceJwtFn',
			lambdaSources.deviceJwt,
			{
				description:
					'Returns a JWT for the device, confirming that it is shared.',
				layers: [baseLayer, jwtLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.publicDevicesTableIdIndex,
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantReadData(this.deviceJwtFn)

		this.listUserDevicesFn = new PackedLambdaFn(
			this,
			'listUserDevicesFn',
			lambdaSources.listUserDevices,
			{
				description: 'List user devices',
				layers: [baseLayer, jwtLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_OWNER_EMAIL_INDEX_NAME:
						publicDevices.publicDevicesTableOwnerEmailIndex,
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantReadData(this.listUserDevicesFn)

		this.extendDeviceSharingFn = new PackedLambdaFn(
			this,
			'extendDeviceSharingFn',
			lambdaSources.extendDeviceSharing,
			{
				description: 'Extend the time a devices sharing expires by 30 days',
				layers: [baseLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.publicDevicesTableIdIndex,
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantWriteData(this.extendDeviceSharingFn)
	}
}
