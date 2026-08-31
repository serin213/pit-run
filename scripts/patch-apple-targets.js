const fs = require('fs');
const path = require('path');

const packageRoot = path.dirname(
  require.resolve('@bacons/apple-targets/package.json'),
);
const configurationPath = path.join(
  packageRoot,
  'build',
  'configuration-list.js',
);
const source = fs.readFileSync(configurationPath, 'utf8');
const widgetStart = source.indexOf('function createWidgetConfigurationList');
const widgetEnd = source.indexOf(
  'function createKeyboardConfigurationList',
  widgetStart,
);

if (widgetStart === -1 || widgetEnd === -1) {
  throw new Error(
    'Unable to locate @bacons/apple-targets widget build configuration.',
  );
}

const widgetSource = source.slice(widgetStart, widgetEnd);
const matches = widgetSource.match(/TARGETED_DEVICE_FAMILY: "1,2",/g) ?? [];

if (matches.length === 0) {
  if (
    (widgetSource.match(/TARGETED_DEVICE_FAMILY: "1",/g) ?? []).length === 2
  ) {
    process.exit(0);
  }
  throw new Error(
    'Unexpected @bacons/apple-targets widget device-family configuration.',
  );
}

if (matches.length !== 2) {
  throw new Error(
    `Expected 2 widget device-family settings, found ${matches.length}.`,
  );
}

const patchedWidgetSource = widgetSource.replace(
  /TARGETED_DEVICE_FAMILY: "1,2",/g,
  'TARGETED_DEVICE_FAMILY: "1",',
);
const patchedSource =
  source.slice(0, widgetStart) +
  patchedWidgetSource +
  source.slice(widgetEnd);

fs.writeFileSync(configurationPath, patchedSource, 'utf8');
