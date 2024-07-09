import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import { aws_iam as IAM, type aws_lambda as Lambda, Stack } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import type { PublicDevices } from './PublicDevices.js'

export class ShareAPI extends Construct {
	public readonly shareFn: Lambda.IFunction
	public readonly confirmOwnershipFn: Lambda.IFunction
	public readonly sharingStatusFn: Lambda.IFunction
	public readonly sharingStatusFingerprintFn: Lambda.IFunction
	constructor(
		parent: Construct,
		{
			domain,
			baseLayer,
			lambdaSources,
			publicDevices,
		}: {
			domain: string
			publicDevices: PublicDevices
			baseLayer: Lambda.ILayerVersion
			lambdaSources: Pick<
				BackendLambdas,
				| 'shareDevice'
				| 'confirmOwnership'
				| 'sharingStatus'
				| 'sharingStatusFingerprint'
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
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
					FROM_EMAIL: `notification@${domain}`,
					IS_TEST: this.node.getContext('isTest') === true ? '1' : '0',
				},
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
				],
			},
		).fn
		publicDevices.publicDevicesTable.grantWriteData(this.shareFn)

		this.confirmOwnershipFn = new PackedLambdaFn(
			this,
			'confirmOwnershipFn',
			lambdaSources.confirmOwnership,
			{
				description:
					'Invoked by a user that wants confirm their device ownership.',
				layers: [baseLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantReadWriteData(this.confirmOwnershipFn)

		this.sharingStatusFn = new PackedLambdaFn(
			this,
			'sharingStatusFn',
			lambdaSources.sharingStatus,
			{
				description: 'Returns the sharing status of a device.',
				layers: [baseLayer],
				environment: {
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
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
					PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
				},
			},
		).fn
		publicDevices.publicDevicesTable.grantReadData(
			this.sharingStatusFingerprintFn,
		)
	}
}
