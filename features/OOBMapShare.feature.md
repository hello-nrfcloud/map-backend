---
exampleContext:
  fingerprint: 92b.y7i24q
  deviceId: oob-352656108602296
  publicDeviceId: outfling-swanherd-attaghan
  API: "https://api.nordicsemi.world/2024-04-15"
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

## Share the device

> Using the device fingerprint I can share the device

When I `POST` to `${API}/share` with

```json
{
  "fingerprint": "${fingerprint}",
  "email": "${email}"
}
```

Then I should receive a
`https://github.com/hello-nrfcloud/proto-map/share-device-request` response

And I store `id` of the last response into `publicDeviceId`

And I store `deviceId` of the last response into `deviceId`

## Confirm the email

When I `POST` to `${API}/share/confirm` with

```json
{
  "deviceId": "${deviceId}",
  "token": "123456"
}
```

Then I should receive a
`https://github.com/hello-nrfcloud/proto-map/share-device-ownership-confirmed`
response

## The sharing status of a device can be checked using the device ID

> Users should be able to determine whether a certain device is sharing data

When I `GET` to `${API}/device/${publicDeviceId}`

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/device`
response

And the last response should match

```json
{
  "id": "${publicDeviceId}",
  "model": "PCA20035+solar"
}
```

## The sharing status of a device can be checked using the fingerprint

> Users should be able to determine whether a certain device is sharing data

When I `GET` to `${API}/share/status?fingerprint=${fingerprint}`

Then I should receive a `https://github.com/hello-nrfcloud/proto-map/device`
response

And the last response should match

```json
{
  "id": "${publicDeviceId}",
  "model": "PCA20035+solar"
}
```
