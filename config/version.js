const fs = require('fs')
const pack = require('../package.json')

// update installation.md
const installation = fs
  .readFileSync('./gitbook/installation.md', 'utf-8')
  .replace(
    /https:\/\/unpkg\.com\/vue-i18n-gettext@[\d.]+.[\d]+\/dist\/vue-i18n-gettext\.js/,
    'https://unpkg.com/vue-i18n-gettext@' + pack.version + '/dist/vue-i18n-gettext.js.'
  )
fs.writeFileSync('./gitbook/installation.md', installation)
