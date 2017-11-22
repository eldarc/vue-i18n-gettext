# Installation

### Direct Download / CDN

https://unpkg.com/vue-i18n-gettext/dist/vue-i18n-gettext

[unpkg.com](https://unpkg.com) provides NPM-based CDN links. The above link will always point to the latest release on NPM. You can also use a specific version/tag via URLs like https://unpkg.com/vue-i18n-gettext@0.0.1/dist/vue-i18n-gettext.js
 
Include vue-i18n-gettext after Vue and it will install itself automatically:

```html
<script src="https://unpkg.com/vue/dist/vue.js"></script>
<script src="https://unpkg.com/vue-i18n-gettext/dist/vue-i18n-gettext.js"></script>
```

### NPM

    $ npm install vue-i18n-gettext

### Yarn

    $ yarn add vue-i18n-gettext

When used with a module system, you must explicitly install the `vue-i18n-gettext` via `Vue.use()`:

```javascript
import Vue from 'vue'
import VueI18nGettext from 'vue-i18n-gettext'

Vue.use(VueI18nGettext)
```

You don't need to do this when using global script tags.

### Dev Build

You will have to clone directly from GitHub and build `vue-i18n-gettext` yourself if
you want to use the latest dev build.

    $ git clone https://github.com/eldarc/vue-i18n-gettext.git node_modules/vue-i18n-gettext
    $ cd node_modules/vue-i18n-gettext
    $ npm install
    $ npm run build
