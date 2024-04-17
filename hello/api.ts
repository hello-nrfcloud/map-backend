import {
	DeviceIdentity,
	typedFetch,
	type TypedFetchResponse,
} from '@hello.nrfcloud.com/proto/hello'

export const helloApi = ({
	endpoint,
	fetchImplementation,
}: {
	endpoint: URL
	fetchImplementation?: typeof fetch
}): {
	getDeviceByFingerprint: (
		fingerprint: string,
	) => Promise<TypedFetchResponse<typeof DeviceIdentity>>
} => {
	const getDeviceByFingerprintRequest = typedFetch({
		responseBodySchema: DeviceIdentity,
		fetchImplementation,
	})
	return {
		getDeviceByFingerprint: async (fingerprint: string) =>
			getDeviceByFingerprintRequest(
				new URL(
					`./device?${new URLSearchParams({ fingerprint }).toString()}`,
					endpoint,
				),
			),
	}
}
