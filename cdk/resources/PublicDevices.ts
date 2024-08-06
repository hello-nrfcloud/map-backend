import { aws_dynamodb as DynamoDB, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * Contains the resources to manage the information about public devices
 */
export class PublicDevices extends Construct {
	public readonly publicDevicesTable: DynamoDB.Table
	public readonly publicDevicesTableModelOwnerConfirmedIndex =
		'modelOwnerConfirmedIndex'
	public readonly idIndex = 'idIndex'
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
			indexName: this.idIndex,
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
	}
}
