import Vue from 'vue'
import plugin from '../../src/index'
import 'babel-polyfill' // promise and etc ...

Vue.config.productionTip = false
Vue.use(plugin)

window.Vue = Vue
