import type { models } from '@hello.nrfcloud.com/proto-map/models'

export type PublicDeviceRecord = {
	/**
	 * This is the public ID of the device, a UUIDv4.
	 * Only the public ID should be shown.
	 *
	 * @example "fbb18b8e-c2f9-41fe-8cfa-4107e4e54d72"
	 */
	id: string
	/**
	 * This is the ID the device uses to connect to nRF Cloud
	 *
	 * @example "oob-352656108602296"
	 */
	deviceId: string
	model: keyof typeof models
	ownerEmail: string
	ttl: number
}
