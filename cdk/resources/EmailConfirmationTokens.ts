import { aws_dynamodb as DynamoDB, RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * Contains the table for verifying user's email addresses
 */
export class EmailConfirmationTokens extends Construct {
	public readonly table: DynamoDB.Table
	constructor(parent: Construct) {
		super(parent, 'email-confirmation-tokens')

		const isTest = this.node.getContext('isTest') === true

		this.table = new DynamoDB.Table(this, 'table', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'email',
				type: DynamoDB.AttributeType.STRING,
			},
			timeToLiveAttribute: 'ttl',
			removalPolicy: isTest ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
		})
	}
}
