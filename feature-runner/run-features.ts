import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { runFolder } from '@bifravst/bdd-markdown'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import chalk from 'chalk'
import path from 'node:path'
import type { StackOutputs as BackendStackOutputs } from '../cdk/BackendStack.js'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { steps as storageSteps } from '@hello.nrfcloud.com/bdd-markdown-steps/storage'
import { steps as randomSteps } from '@hello.nrfcloud.com/bdd-markdown-steps/random'
import { steps as deviceSteps } from './steps/device.js'
import { steps as jwtSteps } from './steps/jwt.js'
import { steps as RESTSteps } from '@hello.nrfcloud.com/bdd-markdown-steps/REST'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { fromEnv } from '@bifravst/from-env'
import { mock as httpApiMock } from '@bifravst/http-api-mock/mock'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { slashless } from '@hello.nrfcloud.com/nrfcloud-api-helpers/api'
import { SSMClient } from '@aws-sdk/client-ssm'
import { getSettings } from '../settings/jwt.js'

/**
 * This file configures the BDD Feature runner
 * by loading the configuration for the test resources
 * (like AWS services) and providing the required
 * step runners and reporters.
 */

const iotData = new IoTDataPlaneClient({})
const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const { mockApiEndpoint, responsesTableName } = fromEnv({
	mockApiEndpoint: 'HTTP_API_MOCK_API_URL',
	responsesTableName: 'HTTP_API_MOCK_RESPONSES_TABLE_NAME',
	requestsTableName: 'HTTP_API_MOCK_REQUESTS_TABLE_NAME',
})(process.env)

const backendConfig = await stackOutput(
	new CloudFormationClient({}),
)<BackendStackOutputs>(STACK_NAME)

const jwtSettings = await getSettings({ ssm, stackName: STACK_NAME })

const print = (arg: unknown) =>
	typeof arg === 'object' ? JSON.stringify(arg) : arg
const start = Date.now()
const ts = () => {
	const diff = Date.now() - start
	return chalk.gray(`[${(diff / 1000).toFixed(3).padStart(8, ' ')}]`)
}

const runner = await runFolder({
	folder: path.join(process.cwd(), 'features'),
	name: 'hello.nrfcloud.com/map backend',
	logObserver: {
		onDebug: (info, ...args) =>
			console.error(
				ts(),
				chalk.magenta.dim(info.step.keyword),
				chalk.magenta(info.step.title),
				...args.map((arg) => chalk.cyan(print(arg))),
			),
		onError: (info, ...args) =>
			console.error(
				ts(),
				chalk.magenta.dim(info.step.keyword),
				chalk.magenta(info.step.title),
				...args.map((arg) => chalk.cyan(print(arg))),
			),
		onInfo: (info, ...args) =>
			console.error(
				ts(),
				chalk.magenta.dim(info.step.keyword),
				chalk.magenta(info.step.title),
				...args.map((arg) => chalk.cyan(print(arg))),
			),
		onProgress: (info, ...args) =>
			console.error(
				ts(),
				chalk.magenta.dim(info.step.keyword),
				chalk.magenta(info.step.title),
				...args.map((arg) => chalk.cyan(print(arg))),
			),
	},
})

const cleaners: (() => Promise<void>)[] = []

const helloAPIBasePath = 'hello-api'
runner
	.addStepRunners(...storageSteps)
	.addStepRunners(...randomSteps())
	.addStepRunners(...RESTSteps)
	.addStepRunners(
		...deviceSteps({
			iotData,
			httpApiMock: httpApiMock({
				db,
				responsesTable: responsesTableName,
			}),
			helloAPIBasePath,
			db,
			publicDevicesTableName: backendConfig.publicDevicesTableName,
			idIndex: backendConfig.publicDevicesTableIdIndexName,
		}),
	)
	.addStepRunners(
		...jwtSteps({ publicKey: jwtSettings.publicKey, keyId: jwtSettings.keyId }),
	)

const res = await runner.run({
	API: slashless(new URL(backendConfig.APIURL)),
	helloAPI: new URL(`${mockApiEndpoint}${helloAPIBasePath}`),
})

await Promise.all(cleaners.map(async (fn) => fn()))

console.error(`Writing to stdout ...`)
process.stdout.write(JSON.stringify(res, null, 2), () => {
	console.error(`Done`, res.ok ? chalk.green('OK') : chalk.red('ERROR'))
})
