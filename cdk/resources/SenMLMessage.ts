import {
	IoTActionRole,
	LambdaLogGroup,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	Duration,
	aws_iam as IAM,
	aws_iot as IoT,
	aws_lambda as Lambda,
	RemovalPolicy,
	aws_dynamodb as DynamoDB,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../packBackendLambdas.js'
import type { PublicDevices } from './PublicDevices.js'

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

		// Make message conversion results available
		const importLogs = new DynamoDB.Table(this, 'importLogsTable', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'publicDeviceId',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'importId',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
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
				PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
				IMPORT_LOGS_TABLE_NAME: importLogs.tableName,
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
		importLogs.grantReadWriteData(fn)

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
			description: 'Returns the last senML import results for a device.',
			layers: [baseLayer],
			environment: {
				VERSION: this.node.getContext('version'),
				IMPORT_LOGS_TABLE_NAME: importLogs.tableName,
				PUBLIC_DEVICES_TABLE_NAME: publicDevices.publicDevicesTable.tableName,
				PUBLIC_DEVICES_ID_INDEX_NAME: publicDevices.idIndex,
			},
			...new LambdaLogGroup(this, 'importLogsFnLogs'),
		})
		importLogs.grantReadData(this.importLogsFn)
		publicDevices.publicDevicesTable.grantReadData(this.importLogsFn)
	}
}
