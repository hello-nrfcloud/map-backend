---
exampleContext:
  deviceId: f1394b9a-a7c7-4a4a-ade2-bf2012f92e1f
  publicDeviceId: discloak-classify-nodosity
  ts: 1694503339523
  API: "https://api.nordicsemi.world/2024-04-15"
---

# History can be fetched for numeric LwM2M object resources

## Background

Given I have the device id for a shared `kartverket-vasstandsdata` device in
`deviceId` and the public device id in `publicDeviceId`

## Publish SenML via MQTT

Given I store `$millis()` into `ts`

And the device `${deviceId}` publishes this message to the topic
`m/senml/${deviceId}`

```json
[
  {
    "bn": "14230/0/",
    "bt": "$number{ts}",
    "n": "0",
    "v": 225.1
  },
  {
    "n": "1",
    "vs": "TRD"
  }
]
```

## Fetch the published data

When I `GET` `${API}/history?deviceId=${publicDeviceId}&instance=14230%2F0`

Then I should receive a
`https://github.com/hello-nrfcloud/proto-map/history/resource` response

And `$.query` of the last response should match

```json
{
  "ObjectID": 14230,
  "ObjectVersion": "1.0",
  "ObjectInstanceID": 0,
  "deviceId": "${publicDeviceId}",
  "binIntervalMinutes": 15
}
```

And `$.partialInstances[0]` of the last response should match

```json
{
  "0": 225.1,
  "99": "$number{ts}"
}
```
