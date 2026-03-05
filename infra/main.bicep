param location string = resourceGroup().location
param appName string = 'cancel-${uniqueString(resourceGroup().id)}'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower(replace(appName, '-', ''))
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: appName
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {}
}
