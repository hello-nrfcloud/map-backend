import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	type aws_lambda as Lambda,
	Duration,
	aws_events_targets as EventTargets,
	aws_events as Events,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import type { PublicDevices } from './PublicDevices.js'
import { permissions } from './ses.js'

export class Notifications extends Construct {
	constructor(
		parent: Construct,
		{
			domain,
			baseLayer,
			lambdaSources,
			publicDevices,
		}: {
			domain: string
			baseLayer: Lambda.ILayerVersion
			lambdaSources: Pick<BackendLambdas, 'notifyAboutExpiringDevices'>
			publicDevices: PublicDevices
		},
	) {
		super(parent, 'notifications')

		const notifyAboutExpiringDevicesFn = new PackedLambdaFn(
			this,
			'notifyAboutExpiringDevicesFn',
			lambdaSources.notifyAboutExpiringDevices,
			{
				description: 'Notify users that their devices expire soon',
				layers: [baseLayer],
				environment: {
					FROM_EMAIL: `notification@${domain}`,
					IS_TEST: this.node.getContext('isTest') === true ? '1' : '0',
					PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				},
				initialPolicy: [permissions(this, domain)],
			},
		).fn
		publicDevices.publicDevicesTable.grantReadData(notifyAboutExpiringDevicesFn)

		const rule = new Events.Rule(this, 'rule', {
			description: `Rule to schedule email notifications`,
			schedule: Events.Schedule.rate(Duration.days(1)),
		})
		rule.addTarget(
			new EventTargets.LambdaFunction(notifyAboutExpiringDevicesFn),
		)
	}
}
