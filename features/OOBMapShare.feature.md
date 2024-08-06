---
exampleContext:
  fingerprint: 92b.y7i24q
  deviceId: oob-352656108602296
  publicDeviceId: outfling-swanherd-attaghan
  API: "https://api.nordicsemi.world/2024-04-15"
  email: alex@example.com
  jwt: eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6Ijg1NDdiNWIyLTdiNDctNDFlNC1iZjJkLTdjZGZmNDhiM2VhNCJ9.eyJAY29udGV4dCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9oZWxsby1ucmZjbG91ZC9wcm90by1tYXAvdXNlci1qd3QiLCJlbWFpbCI6ImVkYjJiZDM3QGV4YW1wbGUuY29tIiwiaWF0IjoxNzIyODcxNTYyLCJleHAiOjE3MjI5NTc5NjIsImF1ZCI6ImhlbGxvLm5yZmNsb3VkLmNvbSJ9.ALiHjxR7HIjuYQBvPVh5-GMs-2f-pMGs_FTz-x0HGzQ4amLASeUGEZ7X_y-_mgZpYu8VKGm6be0LtIIx9DgYBff1ASfmQH327rub0a2-DjXW-JUJQn_6t6H6_JhvPZ9jWBSzy3Tbpp9NmTUNmHgEwzyoctnmgp0oo26VEwc4r6YGQWkZ
---

# Sharing an out-of-box experience device on the map

> As a user I can share a Thingy:91 X directly on the map so the data can be
> compared with other devices and can be observed by users without needing to
> know the fingerprint.
>
> This works for the Thingy:91 X because they have credentials that already tie
> them to the nRF Cloud account that is used by `hello.nrfcloud.com/map`. The
> only thing the user needs to do is to consent to the sharing.
>
> Note: Users need to know the fingerprint of the device in order to prevent
> them sharing devices they don't have access to by guessing the IMEI.

## Background

Given I have the fingerprint for my device in `fingerprint`

And I have a random email in `email`

## Request confirmation token

When I `POST` to `${API}/auth` with

```json
{
  "email": "${email}"
}
```

Then the status code of the last response should be `201`

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

And I store `jwt` of the last response into `jwt`

## Share the device

> Using the device fingerprint I can share the device

Given the `Authorization` header of the next request is `Bearer ${jwt}`

When I `POST` to `${API}/share` with

```json
{
  "fingerprint": "${fingerprint}",
  "model": "thingy91x"
}
```

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/device`
response

And I store `id` of the last response into `publicDeviceId`

And I store `deviceId` of the last response into `deviceId`

## The sharing status of a device can be checked using the device ID

> Users should be able to determine whether a certain device is sharing data

When I `GET` to `${API}/device/${publicDeviceId}`

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/device`
response

And the last response should match

```json
{
  "id": "${publicDeviceId}",
  "deviceId": "${deviceId}",
  "model": "thingy91x"
}
```

## The sharing status of a device can be checked using the fingerprint

> Users should be able to determine whether a certain device is sharing data.
>
> This uses the fingerprint so it's not possible to just enumerate device IDs.

When I `GET` to `${API}/share/status?fingerprint=${fingerprint}`

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/device`
response

And the last response should match

```json
{
  "id": "${publicDeviceId}",
  "deviceId": "${deviceId}",
  "model": "thingy91x"
}
```
