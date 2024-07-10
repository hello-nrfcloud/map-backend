import { Type } from '@sinclair/typebox'

const disallowedChars = '@;" '
const rx = new RegExp(
	`^[^${disallowedChars}]{1,256}@[^${disallowedChars}]{3,253}$`,
	'i',
)
export const Email = Type.RegExp(rx, {
	title: 'Email',
	description:
		'The email of the owner of the device. They have to confirm the publication of the device every 30 days.',
})
