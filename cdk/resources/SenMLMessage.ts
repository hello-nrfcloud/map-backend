import {
	IoTActionRole,
	LambdaLogGroup,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	Duration,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	aws_logs as Logs,
	RemovalPolicy,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../BackendLambdas.js'
import type { PublicDevices } from './PublicDevices.js'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'

/**
 * Handle incoming SenML messages
 */
export class SenMLMessages extends Construct {
	public readonly importLogsFn: Lambda.IFunction
	constructor(
		parent: Construct,
		{
			baseLayer,
			lambdaSources,
			publicDevices,
		}: {
			baseLayer: Lambda.ILayerVersion
			lambdaSources: Pick<BackendLambdas, 'senMLToLwM2M' | 'senMLImportLogs'>
			publicDevices: PublicDevices
		},
	) {
		super(parent, 'senml-messages')

		const importLogs = new Logs.LogGroup(this, 'importLogs', {
			logGroupName: `${Stack.of(this).stackName}/senml-device-message-import`,
			retention: RetentionDays.ONE_MONTH,
			logGroupClass: Logs.LogGroupClass.INFREQUENT_ACCESS,
			removalPolicy: RemovalPolicy.DESTROY,
		})

		const fn = new Lambda.Function(this, 'fn', {
			handler: lambdaSources.senMLToLwM2M.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.minutes(15),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.senMLToLwM2M.zipFile),
			description:
				'Convert incoming SenML to LwM2M and store as objects in a named shadow.',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				IMPORT_LOGGROUP_NAME: importLogs.logGroupName,
			},
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['iot:UpdateThingShadow'],
					resources: ['*'],
				}),
			],
			...new LambdaLogGroup(this, 'fnLogs'),
		})
		publicDevices.publicDevicesTable.grantReadData(fn)
		importLogs.grantWrite(fn)

		const rule = new IoT.CfnTopicRule(this, 'rule', {
			topicRulePayload: {
				description: `Convert SenML messages to LwM2M`,
				ruleDisabled: false,
				awsIotSqlVersion: '2016-03-23',
				sql: [
					`SELECT * as message,`,
					`topic(4) as deviceId`,
					`FROM 'data/m/senml/+'`, // 'data/m/senml/<device Id>'
				].join(' '),
				actions: [
					{
						lambda: {
							functionArn: fn.functionArn,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: new IoTActionRole(this).roleArn,
						topic: 'errors',
					},
				},
			},
		})

		fn.addPermission('invokeByRule', {
			principal: new IAM.ServicePrincipal(
				'iot.amazonaws.com',
			) as IAM.IPrincipal,
			sourceArn: rule.attrArn,
		})

		this.importLogsFn = new Lambda.Function(this, 'importLogsFn', {
			handler: lambdaSources.senMLImportLogs.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: Duration.minutes(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdaSources.senMLImportLogs.zipFile),
			description: 'Returns the last import messages for a device.',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				IMPORT_LOGGROUP_NAME: importLogs.logGroupName,
			},
			...new LambdaLogGroup(this, 'importLogsFnLogs'),
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['logs:StartQuery', 'logs:GetQueryResults'],
					resources: [importLogs.logGroupArn],
				}),
			],
		})
		importLogs.grantRead(this.importLogsFn)
	}
}
