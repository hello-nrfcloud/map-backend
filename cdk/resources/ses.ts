import { aws_iam as IAM, Stack } from 'aws-cdk-lib'
import type { Construct } from 'constructs'

export const permissions = (
	stack: Construct,
	domain: string,
): IAM.PolicyStatement =>
	new IAM.PolicyStatement({
		actions: ['ses:SendEmail'],
		resources: [
			`arn:aws:ses:${Stack.of(stack).region}:${
				Stack.of(stack).account
			}:identity/${domain}`,
		],
		conditions: {
			StringLike: {
				'ses:FromAddress': `notification@${domain}`,
			},
		},
	})
