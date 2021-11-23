import Vue from 'vue';
import Vuex from 'vuex';
import RQPlugin from '../../src/index';
import App from './App.vue';

Vue.use(Vuex);

const store = new Vuex.Store({ state: {} });

RQPlugin.install({
  axiosConfig: {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    baseURL: 'https://jsonplaceholder.typicode.com/',
  },
})(store);

// eslint-disable-next-line no-new
new Vue({
  el: '#app',
  store,
  render: (h) => h(App),
});
