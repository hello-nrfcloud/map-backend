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
}: {
	iotData: IoTDataPlaneClient
}): Array<StepRunner<Record<string, any>>> => [publishDeviceMessage(iotData)]
