import { models } from '@hello.nrfcloud.com/proto-map'
import { DeviceId } from '@hello.nrfcloud.com/proto-map/api'
import type { ProblemDetail } from '@hello.nrfcloud.com/proto/hello'
import { Type, type Static } from '@sinclair/typebox'
import { typedFetch } from './typedFetch.js'

const Model = Type.Union(
	Object.keys(models).map((model) => Type.Literal(model)),
)

export const helloApi = ({
	endpoint,
	fetchImplementation,
}: {
	endpoint: URL
	fetchImplementation?: typeof fetch
}): {
	getDeviceByFingerprint: (fingerprint: string) => Promise<
		| {
				error: Omit<Static<typeof ProblemDetail>, '@context'>
		  }
		| {
				result: {
					id: string
					model: Static<typeof Model>
				}
		  }
	>
} => ({
	getDeviceByFingerprint: async (fingerprint: string) =>
		typedFetch({
			url: new URL(
				`./device?${new URLSearchParams({ fingerprint }).toString()}`,
				endpoint,
			),
			RequestBodySchema: Type.Undefined(),
			ResponseBodySchema: Type.Object({
				id: DeviceId,
				model: Model,
			}),
			fetchImplementation,
		})(),
})
