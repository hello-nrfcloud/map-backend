import { aws_dynamodb as DynamoDB, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * Contains the resources to manage the information about public devices
 */
export class PublicDevices extends Construct {
	public readonly publicDevicesTable: DynamoDB.Table
	public readonly publicDevicesTableModelTTLIndex = 'modelTTLIndex'
	public readonly publicDevicesTableOwnerEmailIndex = 'ownerEmailIndex'
	public readonly publicDevicesTableIdIndex = 'idIndex'
	constructor(parent: Construct) {
		super(parent, 'public-devices')

		const isTest = this.node.getContext('isTest') === true

		// This table records the user consent for a certain device to be public
		this.publicDevicesTable = new DynamoDB.Table(this, 'table', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'deviceId',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: isTest ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
			pointInTimeRecovery: !isTest,
		})

		this.publicDevicesTable.addGlobalSecondaryIndex({
			indexName: this.publicDevicesTableIdIndex,
			partitionKey: {
				name: 'id',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'deviceId',
				type: DynamoDB.AttributeType.STRING,
			},
			projectionType: DynamoDB.ProjectionType.KEYS_ONLY,
		})

		this.publicDevicesTable.addGlobalSecondaryIndex({
			indexName: this.publicDevicesTableModelTTLIndex,
			partitionKey: {
				name: 'model',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'ttl',
				type: DynamoDB.AttributeType.NUMBER,
			},
			projectionType: DynamoDB.ProjectionType.INCLUDE,
			nonKeyAttributes: ['id', 'deviceId'],
		})

		this.publicDevicesTable.addGlobalSecondaryIndex({
			indexName: this.publicDevicesTableOwnerEmailIndex,
			partitionKey: {
				name: 'ownerEmail',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'ttl',
				type: DynamoDB.AttributeType.NUMBER,
			},
			projectionType: DynamoDB.ProjectionType.INCLUDE,
			nonKeyAttributes: ['id', 'deviceId', 'model'],
		})
	}
}
