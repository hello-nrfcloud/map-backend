import {
	PayloadFormatIndicator,
	PublishCommand,
	type IoTDataPlaneClient,
} from '@aws-sdk/client-iot-data-plane'
import {
	codeBlockOrThrow,
	regExpMatchedStep,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import { Type } from '@sinclair/typebox'
import { fingerprintGenerator } from '@hello.nrfcloud.com/proto/fingerprint'
import { IMEI, email } from '@hello.nrfcloud.com/bdd-markdown-steps/random'
import type { HttpAPIMock } from '@bifravst/http-api-mock/mock'
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { publicDevicesRepo } from '../../devices/publicDevicesRepo.js'
import { models } from '@hello.nrfcloud.com/proto-map/models'

const getCurrentWeekNumber = (): number => {
	const now = new Date()
	const firstOfJanuary = new Date(now.getFullYear(), 0, 1)
	return Math.ceil(
		((now.getTime() - firstOfJanuary.getTime()) / 86400000 +
			firstOfJanuary.getDay() +
			1) /
			7,
	)
}

const oobDeviceWithFingerprint = (
	httpApiMock: HttpAPIMock,
	helloAPIBasePath: string,
) =>
	regExpMatchedStep(
		{
			regExp:
				/^I have the fingerprint for my device in `(?<storageName>[^`]+)`$/,
			schema: Type.Object({
				storageName: Type.String({ minLength: 1 }),
			}),
		},
		async ({ match: { storageName }, log: { progress }, context }) => {
			const now = new Date()
			const fingerprint = fingerprintGenerator(
				parseInt(
					`${(now.getFullYear() - 2000).toString()}${getCurrentWeekNumber()}`,
					10,
				),
			)()
			progress(`Fingerprint: ${fingerprint}`)
			context[storageName] = fingerprint
			const deviceId = `oob-${IMEI()}`
			progress(`DeviceID: ${deviceId}`)

			await httpApiMock.response(
				`GET ${helloAPIBasePath}/device?fingerprint=${fingerprint}`,
				{
					status: 200,
					headers: new Headers({
						'content-type': 'application/json; charset=utf-8',
					}),
					body: JSON.stringify({
						'@context':
							'https://github.com/hello-nrfcloud/proto/deviceIdentity',
						id: deviceId,
						model: 'PCA20035+solar',
					}),
				},
				true,
			)
		},
	)

const modelIDs = Object.keys(models)

const sharedDevice = (
	db: DynamoDBClient,
	publicDevicesTableName: string,
	idIndex: string,
) =>
	regExpMatchedStep(
		{
			regExp:
				/^I have the device id for a shared `(?<modelName>[^`]+)` device in `(?<idStorageName>[^`]+)` and the public device id in `(?<publicIdStorageName>[^`]+)`$/,
			schema: Type.Object({
				modelName: Type.Union(modelIDs.map((model) => Type.Literal(model))),
				idStorageName: Type.String({ minLength: 1 }),
				publicIdStorageName: Type.String({ minLength: 1 }),
			}),
		},
		async ({
			match: { modelName, idStorageName, publicIdStorageName },
			log: { progress },
			context,
		}) => {
			const deviceId = crypto.randomUUID()
			progress(`Device ID: ${deviceId}`)
			context[idStorageName] = deviceId
			const repo = publicDevicesRepo({
				db,
				TableName: publicDevicesTableName,
				superUsersEmailDomain: 'example.com',
				idIndex,
			})
			const d = await repo.share({
				deviceId,
				model: modelName,
				email: email(),
				confirmed: true,
			})
			if ('error' in d)
				throw new Error(`Could not share device: ${d.error.message}!`)
			context[publicIdStorageName] = d.device.id
		},
	)

const publishDeviceMessage = (iotData: IoTDataPlaneClient) =>
	regExpMatchedStep(
		{
			regExp:
				/^the device `(?<id>[^`]+)` publishes this message to the topic `(?<topic>[^`]+)`$/,
			schema: Type.Object({
				id: Type.String(),
				topic: Type.String(),
			}),
		},
		async ({ match: { id, topic }, log: { progress }, step }) => {
			const message = JSON.parse(codeBlockOrThrow(step).code)

			progress(`Device id ${id} publishes to topic ${topic}`)
			// The message bridge receives messages from nRF Cloud and publishes them under the data/ topic
			const mqttTopic = `data/${topic}`
			progress('publishing', message, mqttTopic)
			await iotData.send(
				new PublishCommand({
					topic: mqttTopic,
					contentType: 'application/json',
					payloadFormatIndicator: PayloadFormatIndicator.UTF8_DATA,
					payload: JSON.stringify(message),
				}),
			)
		},
	)

export const steps = ({
	iotData,
	httpApiMock,
	helloAPIBasePath,
	db,
	publicDevicesTableName,
	idIndex,
}: {
	iotData: IoTDataPlaneClient
	httpApiMock: HttpAPIMock
	helloAPIBasePath: string
	db: DynamoDBClient
	publicDevicesTableName: string
	idIndex: string
}): Array<StepRunner<Record<string, any>>> => [
	publishDeviceMessage(iotData),
	oobDeviceWithFingerprint(httpApiMock, helloAPIBasePath),
	sharedDevice(db, publicDevicesTableName, idIndex),
]
