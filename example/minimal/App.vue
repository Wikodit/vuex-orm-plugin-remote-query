<template>
  <div id="app">
    <button @click="toggle">Toggle</button>
    <Sub v-if="isOn" />
    <button @click="toggle2">Toggle</button>
    <SubVCC v-if="isOn2" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import Sub from './Sub.vue';
import SubVCC from './SubVCC.vue';

export default Vue.extend({
  components: { Sub, SubVCC },
  data() {
    return {
      isOn: true,
      isOn2: true,
    };
  },
  methods: {
    toggle() {
      this.isOn = !this.isOn;
    },
    toggle2() {
      this.isOn2 = !this.isOn2;
    },
  },
});
</script>
