import uuid from './uuid'
import { stripVData, stripHTMLWhitespace } from './util'

export default function (Vue, marked) {
  return {
    name: 'translate',

    created () {
      this.msgid = ''
      this.msgidHTML = false

      // Replace n with a value from the params if they are set.
      // If n isn't a string than it's assumed that a numeric value has been passed, and that value will be used
      // to determine the plural form (instead of the replace).
      if (this.tN && (typeof this.tN === 'string') && this.tParams) {
        this._tN = this.tN.trim()

        if (this.tParams.hasOwnProperty(this._tN) && this.tParams[this._tN]) {
          this._tN = this.tParams[this._tN]
        } else {
          this._tN = undefined
        }
      } else {
        this._tN = this.tN
      }

      this.isPlural = this._tN !== undefined && this.tPlural !== undefined
      if (!this.isPlural && (this._tN || this.tPlural)) {
        throw new Error(`\`t-n\` and \`t-plural\` attributes must be used together: ${this.msgid}.`)
      }

      // Only raw content needs to be stored, before mounting.
      // This is required to get the correct string from the translations.
      // If there is only text, then it will be extracted from `_renderChildren`.
      // If there are HTML elements than a new helper component is initialized and `_renderChildren` are passed to it.
      // The helper component should be mounted manually silently.
      // From there the `innerHTML` is taken and white spaces removed. Also data-v attributes are removed.
      // The `vue-gettext-tools` extract option will also strip white spaces, so that keys can be matched.
      if (this.$options._renderChildren) {
        if (this.$options._renderChildren.length &&
          this.$options._renderChildren.length === 1 &&
          this.$options._renderChildren[0].hasOwnProperty('text') &&
          this.$options._renderChildren[0].text !== undefined &&
          this.$options._renderChildren[0].hasOwnProperty('tag') &&
          this.$options._renderChildren[0].tag === undefined) {
          this.msgid = this.$options._renderChildren[0].text.trim()
        } else {
          const self = this

          // Mount helper component.
          const HelperComponent = Vue.component('i18n-helper-component', {
            render: function (createElement) {
              return createElement(
                'div',
                self.$options._renderChildren
              )
            }
          })

          const component = new HelperComponent().$mount()

          // Set the string to be the innerHTML of the helper component, but striped of white spaces and Vue's automatically added data-v attributes.
          this.msgid = stripVData(stripHTMLWhitespace(component.$el.innerHTML).trim())
          this.msgidHTML = true
          component.$destroy()
        }
      }
    },

    props: {
      tag: {
        type: String,
        default: 'span'
      },
      tN: {
        type: [String, Number],
        required: false
      },
      tPlural: {
        type: String,
        required: false
      },
      tContext: {
        type: String,
        required: false
      },
      tComment: {
        type: String,
        required: false
      },
      tParams: {
        type: Object,
        required: false
      },
      md: {
        required: false
      },
      markdown: {
        required: false
      }
    },

    computed: {
      translation () {
        let translation = null

        if (this.isPlural && this.tContext) {
          translation = this.$npgettext(this.tContext, this.msgid, this.isPlural ? this.tPlural : null, this._tN)
        } else if (this.isPlural) {
          translation = this.$ngettext(this.msgid, this.isPlural ? this.tPlural : null, this._tN)
        } else if (this.tContext) {
          translation = this.$pgettext(this.tContext, this.msgid)
        } else {
          translation = this.$gettext(this.msgid)
        }

        // Interpolate values from the parent component and from the parameters object.
        translation = this.$_i(translation, Object.assign(this.$parent, typeof this.tParams === 'object' ? this.tParams : {}))

        if (marked !== undefined && (this.markdown !== undefined && this.markdown !== false) || (this.md !== undefined && this.md !== false)) {
          this.msgidHTML = true
          return marked(translation)
        } else {
          return translation
        }
      }
    },

    render (createElement) {
      // https://vuejs.org/v2/guide/conditional.html#Controlling-Reusable-Elements-with-key
      // https://vuejs.org/v2/api/#key
      if (!this.$vnode.key) {
        this.$vnode.key = uuid()
      }

      // https://github.com/vuejs/vue/blob/a4fcdb/src/compiler/parser/index.js#L209
      return createElement(this.tag, [this.translation])
    },

    mounted () {
      if (this.msgidHTML) {
        this.$el.innerHTML = this.$el.innerText
      }
    }
  }
}
