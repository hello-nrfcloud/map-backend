import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SESClient } from '@aws-sdk/client-ses'
import { fromEnv } from '@bifravst/from-env'
import { requestLogger } from '@hello.nrfcloud.com/lambda-helpers/requestLogger'
import middy from '@middy/core'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { listExpiringDevices } from '../devices/listExpiringDevices.js'
import { sendExpiryNotificationEmail } from '../email/sendExpiryNotificationEmail.js'

const { publicDevicesTableName, fromEmail, isTestString } = fromEnv({
	publicDevicesTableName: 'PUBLIC_DEVICES_TABLE_NAME',
	version: 'VERSION',
	fromEmail: 'FROM_EMAIL',
	isTestString: 'IS_TEST',
})({
	STACK_NAME,
	...process.env,
})
const list = listExpiringDevices({
	db: new DynamoDBClient({}),
	TableName: publicDevicesTableName,
})
const ses = new SESClient({})
const isTest = isTestString === '1'
const sendEmail = sendExpiryNotificationEmail(ses, fromEmail)

/**
 * Notify users that their devices expire soon
 */
const h = async (): Promise<void> => {
	const devices = await list(new Date(Date.now() + 1000 * 60 * 60 * 24 * 3))

	const devicesByEmail = devices.reduce(
		(acc, d) => {
			if (acc[d.ownerEmail] === undefined) {
				acc[d.ownerEmail] = []
			}
			acc[d.ownerEmail]!.push(d.id)
			return acc
		},
		{} as Record<string, Array<string>>,
	)

	for (const [email, ids] of Object.entries(devicesByEmail)) {
		console.debug(email, ids.join(', '))
		if (!isTest) {
			await sendEmail({
				email,
				ids,
			})
		}
	}
}

export const handler = middy().use(requestLogger()).handler(h)
