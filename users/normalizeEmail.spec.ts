import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeEmail } from './normalizeEmail.js'

void describe('normalizeEmail()', () => {
	void it('lower-case an email', () => {
		assert.equal(normalizeEmail('Alex@Example.Com'), 'alex@example.com')
	})

	void it('should remove extensions', () => {
		assert.equal(
			normalizeEmail('Alex+Extension@Example.Com'),
			'alex@example.com',
		)
	})
})
