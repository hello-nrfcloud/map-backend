---
exampleContext:
  API: https://api.nordicsemi.world/2024-04-15
  email: alex@example.com
  jwt: eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6Ijg1NDdiNWIyLTdiNDctNDFlNC1iZjJkLTdjZGZmNDhiM2VhNCJ9.eyJAY29udGV4dCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9oZWxsby1ucmZjbG91ZC9wcm90by1tYXAvdXNlci1qd3QiLCJlbWFpbCI6ImVkYjJiZDM3QGV4YW1wbGUuY29tIiwiaWF0IjoxNzIyODcxNTYyLCJleHAiOjE3MjI5NTc5NjIsImF1ZCI6ImhlbGxvLm5yZmNsb3VkLmNvbSJ9.ALiHjxR7HIjuYQBvPVh5-GMs-2f-pMGs_FTz-x0HGzQ4amLASeUGEZ7X_y-_mgZpYu8VKGm6be0LtIIx9DgYBff1ASfmQH327rub0a2-DjXW-JUJQn_6t6H6_JhvPZ9jWBSzy3Tbpp9NmTUNmHgEwzyoctnmgp0oo26VEwc4r6YGQWkZ
  bulkOpsRequestId: e360a26b-0175-428e-bebf-9125a5a4db04
---

# Add Device

> Users can add their own device to the map. For that they first need to confirm
> their email address. Then they can add new devices and manage the devices that
> are associated with their email.

## Request confirmation token

Given I have a random email in `email`

When I `POST` to `${API}/auth` with

```json
{
  "email": "${email}"
}
```

Then the status code of the last response should be `201`

## Users should not be able to re-request a token right away

> This is to protect against sending too many emails to the same email.

When I `POST` to `${API}/auth` with

```json
{
  "email": "${email}"
}
```

Then the status code of the last response should be `409`

## Exchange the confirmation token for a JWT

> The user has acquired the confirmation token from their mailbox.  
> In the test system, the code is always `ABC123`

When I `POST` to `${API}/auth/jwt` with

```json
{
  "email": "${email}",
  "token": "ABC123"
}
```

Then the status code of the last response should be `201`

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/user-jwt`
response

And I store `jwt` of the last response into `jwt`

Then the JWT in `jwt` for the audience `hello.nrfcloud.com` should encode the
payload

```json
{
  "@context": "https://github.com/hello-nrfcloud/proto-map/user-jwt",
  "email": "${email}"
}
```

## Create a new device

> The user can now create a new device

Given I have a random UUIDv4 in `bulkOpsRequestId`

And this nRF Cloud API request is queued for a `POST /v1/devices` request

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "bulkOpsRequestId": "${bulkOpsRequestId}"
}
```

And the `Authorization` header of the next request is `Bearer ${jwt}`

When I `POST` to `${API}/device` with

```json
{
  "model": "thingy91x"
}
```

Then the status code of the last response should be `201`

And I should receive a
`https://github.com/hello-nrfcloud/proto-map/device/credentials` response
