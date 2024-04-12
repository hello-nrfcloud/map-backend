import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { runFolder } from '@nordicsemiconductor/bdd-markdown'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import chalk from 'chalk'
import path from 'node:path'
import type { StackOutputs as BackendStackOutputs } from '../cdk/stacks/BackendStack.js'
import { STACK_NAME } from '../cdk/stacks/stackConfig.js'
import { steps as storageSteps } from '@hello.nrfcloud.com/bdd-markdown-steps/storage'
import {
	steps as randomSteps,
	email,
	IMEI,
} from '@hello.nrfcloud.com/bdd-markdown-steps/random'
import { steps as deviceSteps } from './steps/device.js'
import { steps as RESTSteps } from '@hello.nrfcloud.com/bdd-markdown-steps/REST'
import { IoTDataPlaneClient } from '@aws-sdk/client-iot-data-plane'
import { slashless } from '@hello.nrfcloud.com/nrfcloud-api-helpers/api'

/**
 * This file configures the BDD Feature runner
 * by loading the configuration for the test resources
 * (like AWS services) and providing the required
 * step runners and reporters.
 */

const iotData = new IoTDataPlaneClient({})

const backendConfig = await stackOutput(
	new CloudFormationClient({}),
)<BackendStackOutputs>(STACK_NAME)

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

runner
	.addStepRunners(...storageSteps)
	.addStepRunners(
		...randomSteps({
			email,
			'device ID': () => `oob-${IMEI()}`,
		}),
	)
	.addStepRunners(...RESTSteps)
	.addStepRunners(
		...deviceSteps({
			iotData,
		}),
	)

const res = await runner.run({
	API: slashless(new URL(backendConfig.APIURL)),
})

await Promise.all(cleaners.map(async (fn) => fn()))

console.error(`Writing to stdout ...`)
process.stdout.write(JSON.stringify(res, null, 2), () => {
	console.error(`Done`, res.ok ? chalk.green('OK') : chalk.red('ERROR'))
})
